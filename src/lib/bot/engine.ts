import {
  fetchCurrentBtcMarket,
  fetchMidpointPrices,
  fetchMarketResolution,
  fetchClobResolution,
  getSecondsRemaining,
} from "../polymarket/markets";
import { evaluateStrategy } from "./strategy";
import { executeBuy, executeSell, recordResolution } from "./executor";
import { arbTick, getArbState, getArbStats, setArbCallbacks, getArbCapitalDeployed } from "./arbitrage";
import { getSettings, getCumulativePnl, getTotalTradeCount, getTodayPnl, getConsecutiveLosses, getConsecutiveWins, getTodayLossCount } from "../db/queries";
import { startMarketScanner, stopMarketScanner, getActiveMarkets, getActiveMarketForAsset, getRecentOutcomes, markOutcomeResolved } from "../prices/market-scanner";
import { getClobClient } from "../polymarket/client";
import { logger } from "../logger";
import type {
  BotState,
  BotStatus,
  ConnectionStatus,
  MarketInfo,
  MarketPrices,
  MarketStatus,
  Position,
  SSEEvent,
  TradeRecord,
  WindowPosition,
  ActiveMarketState,
  CapitalState,
  CircuitBreakerState,
  AlertItem,
  MarketAsset,
  BotSettings,
  ArbWindowState,
  ArbStats,
} from "@/types";

// ---- Global Bot State (singleton, lives in the server process) ----

let botStatus: BotStatus = "stopped";
let connectionStatus: ConnectionStatus = "disconnected";
let lastAction = "Idle";
let lastActionTime: string | null = null;

let currentMarket: MarketInfo | null = null;
let currentPrices: MarketPrices | null = null;
let currentPosition: Position | null = null;

// Multi-market positions
const windowPositions: Map<string, WindowPosition> = new Map();

// Cache MarketInfo for positions so we can resolve them after market rotates
const marketInfoCache: Map<string, MarketInfo> = new Map();

// Track last resolution attempt time per position to avoid hammering the API
const lastResolutionAttempt: Map<string, number> = new Map();
const RESOLUTION_RETRY_MS = 5000; // Only retry resolution every 5 seconds

// Circuit breaker
let circuitBreakerTriggered = false;
let circuitBreakerReason: string | null = null;
let circuitBreakerResumeAt: string | null = null;

// Alerts feed
const alerts: AlertItem[] = [];
let alertCounter = 0;

// Main loop interval handle
let loopInterval: ReturnType<typeof setInterval> | null = null;
let marketRefreshInterval: ReturnType<typeof setInterval> | null = null;

// Standalone price broadcast interval (runs independent of bot)
let priceBroadcastInterval: ReturnType<typeof setInterval> | null = null;

// Cached settings
let cachedSettings: BotSettings | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_MS = 5000;

function getCachedSettings(): BotSettings {
  const now = Date.now();
  if (!cachedSettings || now - settingsCacheTime > SETTINGS_CACHE_MS) {
    cachedSettings = getSettings();
    settingsCacheTime = now;
  }
  return cachedSettings;
}

export function invalidateSettingsCache() {
  cachedSettings = null;
  settingsCacheTime = 0;
}

// CLOB client readiness
let clobReady = false;

// Track last logged decision per asset to avoid spamming
const lastLoggedDecision: Record<string, { reason: string; time: number }> = {};

// SSE subscribers
const sseListeners: Set<(event: SSEEvent) => void> = new Set();

// Track whether the scanner has been auto-started for dashboard display
let scannerAutoStarted = false;

// ---- SSE Broadcasting ----

function ensureScannerRunning() {
  if (scannerAutoStarted) return;
  scannerAutoStarted = true;
  const settings = getCachedSettings();
  startMarketScanner(settings.enabledAssets);
  logger.info("[Engine] Auto-started market scanner for dashboard");
}

// Cache serialized outcomes so we only send them when changed
let lastOutcomesJson = "";

function ensurePriceBroadcast() {
if (priceBroadcastInterval) return;
let emptyCount = 0;
// Broadcast active-market prices from scanner every 2s (reduced for VPS performance)
priceBroadcastInterval = setInterval(() => {
  if (sseListeners.size === 0) return;
  const settings = getCachedSettings();
  const activeMarketsRecord: Record<string, ActiveMarketState> = {};
  for (const am of getActiveMarkets()) {
    activeMarketsRecord[am.asset] = am;
  }

  // Log periodic warnings when no markets are found (helps debug VPS issues)
  if (Object.keys(activeMarketsRecord).length === 0) {
    emptyCount++;
    if (emptyCount === 5 || emptyCount % 30 === 0) {
      logger.warn(`[Engine] No active markets found after ${emptyCount} broadcast cycles — Polymarket API may be unreachable from this server`);
      broadcastLog(`? No market data — Polymarket API may be unreachable from this server. Check logs for details.`);
    }
  } else {
    emptyCount = 0;
  }

    // Only include recentOutcomes when the data actually changed
    const outcomes = getRecentOutcomes(settings.enabledAssets);
    const outcomesJson = JSON.stringify(outcomes);
    const outcomesChanged = outcomesJson !== lastOutcomesJson;
    if (outcomesChanged) lastOutcomesJson = outcomesJson;

    broadcast({
      type: "price",
      data: {
        markets: activeMarketsRecord,
        ...(outcomesChanged ? { recentOutcomes: outcomes } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  }, 2000);
}

export function subscribeSSE(listener: (event: SSEEvent) => void): () => void {
ensureScannerRunning();
ensurePriceBroadcast();

  sseListeners.add(listener);
  listener({
    type: "state",
    data: getState(),
    timestamp: new Date().toISOString(),
  });
  return () => sseListeners.delete(listener);
}

function broadcast(event: SSEEvent) {
  for (const listener of sseListeners) {
    try {
      listener(event);
    } catch {
      sseListeners.delete(listener);
    }
  }
}

function broadcastState() {
  broadcast({
    type: "state",
    data: getState(),
    timestamp: new Date().toISOString(),
  });
}

function broadcastTrade(trade: TradeRecord) {
  broadcast({
    type: "trade",
    data: trade,
    timestamp: new Date().toISOString(),
  });
}

function broadcastLog(message: string) {
  broadcast({
    type: "log",
    data: { message },
    timestamp: new Date().toISOString(),
  });
}

function addAlert(severity: AlertItem["severity"], message: string, asset?: MarketAsset) {
  const alert: AlertItem = {
    id: `alert-${++alertCounter}`,
    timestamp: new Date().toISOString(),
    severity,
    message,
    asset,
  };
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.length = 100;
  broadcast({
    type: "alert",
    data: alert,
    timestamp: alert.timestamp,
  });
}

// ---- Capital & Risk ----

function getCapitalState(settings: BotSettings): CapitalState {
  let deployed = 0;
  for (const pos of windowPositions.values()) {
    deployed += pos.costBasis;
  }

  // Include arb capital currently deployed in open positions
  const arbDeployed = getArbCapitalDeployed();
  deployed += arbDeployed;

  const todayPnl = getTodayPnl();
  const todayLosses = getTodayLossCount();
  const consecutiveWins = getConsecutiveWins();

  return {
    totalBankroll: settings.totalBankroll,
    deployed,
    available: Math.max(0, settings.maxTotalExposure - deployed),
    maxExposure: settings.maxTotalExposure,
    todayPnl,
    winStreak: consecutiveWins,
    totalLosses: todayLosses,
  };
}

function checkCircuitBreaker(settings: BotSettings): boolean {
  if (circuitBreakerTriggered) {
    if (circuitBreakerResumeAt) {
      const resumeTime = new Date(circuitBreakerResumeAt).getTime();
      if (Date.now() >= resumeTime) {
        circuitBreakerTriggered = false;
        circuitBreakerReason = null;
        circuitBreakerResumeAt = null;
        addAlert("info", "Circuit breaker cooldown ended. Bot resumed.");
        return false;
      }
    }
    return true;
  }

  const todayPnl = getTodayPnl();
  if (todayPnl < -settings.dailyLossLimit) {
    circuitBreakerTriggered = true;
    circuitBreakerReason = `Daily loss $${Math.abs(todayPnl).toFixed(2)} exceeded limit $${settings.dailyLossLimit}`;
    const resumeAt = new Date(Date.now() + 4 * 3600 * 1000);
    circuitBreakerResumeAt = resumeAt.toISOString();
    addAlert("error", `Circuit breaker triggered: ${circuitBreakerReason}. Pausing for 4 hours.`);
    return true;
  }

  const todayLosses = getTodayLossCount();
  if (todayLosses >= settings.lossLimit) {
    circuitBreakerTriggered = true;
    circuitBreakerReason = `${todayLosses} losses today (limit: ${settings.lossLimit})`;
    addAlert("error", `Circuit breaker triggered: ${circuitBreakerReason}. Bot stopped.`);
    return true;
  }

  return false;
}

// ---- State Getters ----

export function getState(): BotState {
  const settings = getCachedSettings();
  const secondsRemaining = getSecondsRemaining();

  let eligible = false;
  let ineligibleReason: string | undefined;

  if (!currentMarket) {
    ineligibleReason = "No active market found";
  } else if (!currentPrices) {
    ineligibleReason = "Waiting for price data";
  } else {
    const secsLeft = secondsRemaining;
    if (secsLeft > settings.highConfTimeMax) {
      ineligibleReason = `${(secsLeft / 60).toFixed(1)}m remaining (need <= ${Math.floor(settings.highConfTimeMax / 60)}m)`;
    } else if (
      currentPrices.leadingPrice < settings.highConfEntryMin ||
      currentPrices.leadingPrice > settings.highConfEntryMax
    ) {
      ineligibleReason = `Price $${currentPrices.leadingPrice.toFixed(4)} outside range $${settings.highConfEntryMin}-$${settings.highConfEntryMax}`;
    } else {
      eligible = true;
    }
  }

  const marketStatus: MarketStatus = {
    market: currentMarket,
    prices: currentPrices,
    secondsRemaining,
    eligible,
    ineligibleReason,
  };

  // Build active markets record
  const activeMarketsRecord: Record<string, ActiveMarketState> = {};
  for (const am of getActiveMarkets()) {
    activeMarketsRecord[am.asset] = am;
  }

  // Build positions record
  const positionsRecord: Record<string, WindowPosition> = {};
  for (const [key, pos] of windowPositions) {
    positionsRecord[key] = pos;
  }

  return {
    status: botStatus,
    connection: connectionStatus,
    lastAction,
    lastActionTime,
    currentMarket: marketStatus,
    currentPosition: currentPosition,
    settings,
    cumulativePnl: getCumulativePnl(),
    totalTrades: getTotalTradeCount(),
    activeMarkets: activeMarketsRecord,
    positions: positionsRecord,
    capital: getCapitalState(settings),
    circuitBreaker: {
      triggered: circuitBreakerTriggered,
      reason: circuitBreakerReason,
      resumeAt: circuitBreakerResumeAt,
      dailyPnl: getTodayPnl(),
      totalLosses: getTodayLossCount(),
    },
    clobReady,
    alerts: alerts.slice(0, 50),
    arbState: getArbState(),
    arbStats: getArbStats(),
  };
}

// ---- Market Refresh ----

async function refreshMarket() {
  try {
    connectionStatus = "connecting";
    const market = await fetchCurrentBtcMarket();

    if (market) {
      if (currentMarket && currentMarket.conditionId !== market.conditionId) {
        logger.info(`Market rotated: ${currentMarket.slug} -> ${market.slug}`);
        // Resolution is handled in tradingLoop via fetchMarketResolution
      }

      currentMarket = market;
      marketInfoCache.set(market.conditionId, market);
      connectionStatus = "connected";

      const prices = await fetchMidpointPrices(market);
      if (prices) {
        currentPrices = prices;

        if (currentPosition) {
          currentPosition.currentPrice =
            currentPosition.side === "yes" ? prices.yesPrice : prices.noPrice;
          currentPosition.unrealizedPnl =
            currentPosition.shares * currentPosition.currentPrice - currentPosition.costBasis;
        }
      }
    } else {
      currentMarket = null;
      currentPrices = null;
      connectionStatus = "connected";
    }
  } catch (err) {
    connectionStatus = "disconnected";
    const e = err as any;
    const details = [
      e?.message ? `message=${e.message}` : null,
      e?.code ? `code=${e.code}` : null,
      e?.name ? `name=${e.name}` : null,
      e?.response?.status ? `status=${e.response.status}` : null,
      e?.config?.url ? `url=${e.config.url}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    logger.error(`Market refresh failed${details ? ` (${details})` : ""}`);
    broadcastLog(`Connection error${details ? `: ${details}` : ""}`);
  }

  broadcastState();
}

// ---- Main Trading Loop ----

async function tradingLoop() {
  if (botStatus !== "running") return;

  try {
    const settings = getCachedSettings();

    // Check circuit breaker
    if (checkCircuitBreaker(settings)) {
      broadcastState();
      return;
    }

    // Process each enabled asset via market scanner
    const activeMarkets = getActiveMarkets();

    if (activeMarkets.length === 0) {
      const now = Date.now();
      const lastLog = lastLoggedDecision["_noMarkets"];
      if (!lastLog || now - lastLog.time >= 15000) {
        lastLoggedDecision["_noMarkets"] = { reason: "no markets", time: now };
        broadcastLog("Scanning for active 15-minute markets...");
      }
    }

    for (const market of activeMarkets) {
      if (!settings.enabledAssets.includes(market.asset)) continue;

      const posKey = `${market.asset}-${market.conditionId}`;
      const position = windowPositions.get(posKey) || null;

      // Check max simultaneous positions
      if (!position && windowPositions.size >= settings.maxSimultaneousPositions) {
        continue;
      }

      const decision = evaluateStrategy(settings, market, null, position);

      switch (decision.action) {
        case "buy": {
          if (!decision.side || !decision.price) break;

          // If we already have a position, always accumulate on the SAME side
          // (don't flip sides mid-window if the leading side changes)
          const buySide = position ? position.side : decision.side;
          const buyPrice = buySide === "yes" ? market.yesPrice : market.noPrice;

          let betSize = settings.highConfBuyAmount;
          const available = Math.max(0, settings.maxTotalExposure - getCapitalState(settings).deployed);
          betSize = Math.min(betSize, settings.perWindowMax - (position?.costBasis ?? 0), available);
          if (betSize <= 0) break;

          if (position && position.costBasis >= settings.perWindowMax) break;

          const { trade, error } = await executeBuy(
            market.market,
            buySide,
            buyPrice,
            betSize,
            settings.paperTrading,
            position ? {
              conditionId: position.marketId,
              side: position.side,
              shares: position.shares,
              avgEntryPrice: position.avgEntryPrice,
              costBasis: position.costBasis,
              currentPrice: position.currentPrice,
              unrealizedPnl: position.unrealizedPnl,
            } : null,
            {
              asset: market.asset,
              subStrategy: "highConfidence",
              expectedPrice: buyPrice,
            }
          );

          if (trade) {
            if (position) {
              // Always accumulate on existing position
              position.shares += trade.shares;
              position.costBasis += trade.amount;
              position.avgEntryPrice = position.costBasis / position.shares;
              position.lastBuyTime = Date.now();
            } else {
              // First buy - create new position
              windowPositions.set(posKey, {
                marketId: market.conditionId,
                slug: market.slug,
                asset: market.asset,
                side: buySide,
                shares: trade.shares,
                avgEntryPrice: buyPrice,
                currentPrice: buyPrice,
                unrealizedPnl: 0,
                entryTime: new Date().toISOString(),
                hedged: false,
                costBasis: trade.amount,
                subStrategy: "highConfidence",
                lastBuyTime: Date.now(),
              });
              marketInfoCache.set(market.conditionId, market.market);

              if (market.asset === "BTC") {
                currentPosition = {
                  conditionId: market.conditionId,
                  side: buySide,
                  shares: trade.shares,
                  avgEntryPrice: buyPrice,
                  costBasis: trade.amount,
                  currentPrice: buyPrice,
                  unrealizedPnl: 0,
                };
              }
            }

            lastAction = `Buy ${market.asset} ${buySide} @ $${buyPrice.toFixed(4)}`;
            lastActionTime = new Date().toISOString();
            broadcastTrade(trade);
            addAlert("info", `Buy: ${market.asset} ${buySide.toUpperCase()} @ $${buyPrice.toFixed(4)}`, market.asset);
          } else if (error) {
            broadcastLog(`Buy failed (${market.asset}): ${error}`);
          }
          broadcastLog(decision.reason);
          break;
        }

        case "sell": {
          if (!position || !decision.price || !decision.side) break;

          const { trade, error } = await executeSell(
            market.market,
            {
              conditionId: position.marketId,
              side: position.side,
              shares: position.shares,
              avgEntryPrice: position.avgEntryPrice,
              costBasis: position.costBasis,
              currentPrice: position.currentPrice,
              unrealizedPnl: position.unrealizedPnl,
            },
            decision.price,
            settings.paperTrading,
            { asset: market.asset }
          );

          if (trade) {
            lastAction = `Sold ${market.asset} ${position.side} @ $${decision.price.toFixed(4)}`;
            lastActionTime = new Date().toISOString();
            windowPositions.delete(posKey);
            if (market.asset === "BTC") currentPosition = null;
            broadcastTrade(trade);
            addAlert("warning", `Sold: ${market.asset} @ $${decision.price.toFixed(4)} | P&L: $${trade.pnl?.toFixed(4)}`, market.asset);
          } else if (error) {
            broadcastLog(`Sell failed (${market.asset}): ${error}`);
          }
          broadcastLog(decision.reason);
          break;
        }

        case "hold":
        case "wait": {
          const now = Date.now();
          const lastLog = lastLoggedDecision[market.asset];
          const reasonChanged = !lastLog || lastLog.reason !== decision.reason;
          const stale = !lastLog || now - lastLog.time >= 15000;
          if (reasonChanged || stale) {
            lastLoggedDecision[market.asset] = { reason: decision.reason, time: now };
            broadcastLog(decision.reason);
          }
          break;
        }
      }
    }

    // ---- Run arbitrage strategy in parallel ----
    try {
      await arbTick(settings, activeMarkets, settings.paperTrading);
    } catch (arbErr) {
      logger.error(`[ARB] Tick error: ${arbErr}`);
    }

    // ---- Resolve stale positions whose markets have ended ----
    for (const [posKey, pos] of Array.from(windowPositions.entries())) {
      const activeMarket = getActiveMarketForAsset(pos.asset);

      // Compute live seconds remaining for the position's market
      const posWindowTs = parseInt(pos.slug.split("-").pop() || "0", 10);
      const posSecsRemaining = Math.max(0, posWindowTs + 900 - Math.floor(Date.now() / 1000));

      // Position needs resolution if its market ended or scanner found a new one
      const marketRotated = activeMarket && activeMarket.conditionId !== pos.marketId;
      const marketExpired = posSecsRemaining <= 0;

      if (!marketRotated && !marketExpired) continue;

      // Throttle API calls - don't retry more than once every 5 seconds per position
      const lastAttempt = lastResolutionAttempt.get(posKey) || 0;
      if (Date.now() - lastAttempt < RESOLUTION_RETRY_MS) continue;
      lastResolutionAttempt.set(posKey, Date.now());

      const cachedMarket = marketInfoCache.get(pos.marketId);
      if (!cachedMarket) {
        logger.warn(`[Resolution] No cached MarketInfo for ${posKey}, cannot resolve`);
        continue;
      }

      // Try Gamma API first, then CLOB midpoints as fallback
      let resolvedSide = await fetchMarketResolution(pos.slug);
      if (resolvedSide === null) {
        resolvedSide = await fetchClobResolution(cachedMarket);
      }
      if (resolvedSide === null) {
        logger.debug(`[Resolution] ${posKey} not resolved yet, will retry`);
        continue;
      }

      const posObj: Position = {
        conditionId: pos.marketId,
        side: pos.side,
        shares: pos.shares,
        avgEntryPrice: pos.avgEntryPrice,
        costBasis: pos.costBasis,
        currentPrice: pos.currentPrice,
        unrealizedPnl: pos.unrealizedPnl,
      };

      const trade = recordResolution(cachedMarket, posObj, resolvedSide, settings.paperTrading, { asset: pos.asset });
      const won = pos.side === resolvedSide;

      // Immediately update the scanner's outcome cache so Recent Windows reflects the result
      markOutcomeResolved(pos.slug, resolvedSide === "yes" ? "up" : "down");

      windowPositions.delete(posKey);
      lastResolutionAttempt.delete(posKey);
      if (pos.asset === "BTC") currentPosition = null;

      broadcastTrade(trade);
      broadcastLog(`${pos.asset} resolved ${resolvedSide === "yes" ? "UP" : "DOWN"} - ${won ? "WON" : "LOST"} | P&L: $${trade.pnl?.toFixed(4)}`);
      addAlert(won ? "success" : "warning", `${pos.asset} resolved ${resolvedSide === "yes" ? "UP" : "DOWN"}: ${won ? "WON" : "LOST"} ($${trade.pnl?.toFixed(4)})`, pos.asset);
    }

    // Update window positions with latest prices from scanner cache
    for (const [, pos] of windowPositions) {
      const am = getActiveMarketForAsset(pos.asset);
      if (am) {
        pos.currentPrice = pos.side === "yes" ? am.yesPrice : am.noPrice;
        pos.unrealizedPnl = pos.shares * pos.currentPrice - pos.costBasis;
      }
    }
  } catch (err) {
    logger.error(`Trading loop error: ${err}`);
    broadcastLog(`Error: ${err}`);
  }

  broadcastState();
}

// ---- Bot Controls ----

export function startBot(): { success: boolean; error?: string } {
  if (botStatus === "running") {
    return { success: false, error: "Bot is already running" };
  }

  logger.info("Starting bot...");
  botStatus = "running";
  lastAction = "Bot started";
  lastActionTime = new Date().toISOString();

  // Wire up arbitrage callbacks
  setArbCallbacks(
    (trade) => broadcastTrade(trade),
    (msg) => broadcastLog(msg),
    (severity, msg, asset) => addAlert(severity, msg, asset),
  );

  const settings = getCachedSettings();

  // Ensure market scanner is running (may already be started by SSE)
  ensureScannerRunning();
  addAlert("info", `Market scanner active for: ${settings.enabledAssets.join(", ")}`);

  // Check CLOB client readiness (non-blocking)
  if (!settings.paperTrading) {
    getClobClient().then((client) => {
      clobReady = !!client;
      if (clobReady) {
        addAlert("success", "CLOB client connected - live trading ready");
      } else {
        addAlert("error", "CLOB client failed - check PRIVATE_KEY and FUNDER_ADDRESS in .env.local");
      }
      broadcastState();
    }).catch(() => {
      clobReady = false;
      addAlert("error", "CLOB client initialization failed");
      broadcastState();
    });
  } else {
    clobReady = false;
    addAlert("info", "Paper mode - CLOB client not needed");
  }

  // Initial market fetch
  refreshMarket();

  // Main trading loop - runs every 3 seconds (optimized for VPS)
  loopInterval = setInterval(tradingLoop, 3000);

  // Market structure refresh - every 30 seconds (reduced for VPS)
  marketRefreshInterval = setInterval(refreshMarket, 30000);

  broadcastState();
  broadcastLog("Bot started");
  addAlert("success", "Bot started successfully");

  return { success: true };
}

export function stopBot(): { success: boolean; error?: string } {
  if (botStatus === "stopped") {
    return { success: false, error: "Bot is already stopped" };
  }

  logger.info("Stopping bot...");

  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  if (marketRefreshInterval) {
    clearInterval(marketRefreshInterval);
    marketRefreshInterval = null;
  }

  // Note: market scanner keeps running for dashboard price display

  botStatus = "stopped";
  clobReady = false;
  invalidateSettingsCache();
  lastAction = "Bot stopped";
  lastActionTime = new Date().toISOString();

  broadcastState();
  broadcastLog("Bot stopped");
  addAlert("info", "Bot stopped");

  return { success: true };
}

export function getBotStatus(): BotStatus {
  return botStatus;
}

export function resetCircuitBreaker(): { success: boolean } {
  circuitBreakerTriggered = false;
  circuitBreakerReason = null;
  circuitBreakerResumeAt = null;
  addAlert("info", "Circuit breaker manually reset");
  broadcastState();
  return { success: true };
}
