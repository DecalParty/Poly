import {
  fetchCurrentBtcMarket,
  fetchMidpointPrices,
  fetchMarketResolution,
  fetchClobResolution,
  getSecondsRemaining,
} from "../polymarket/markets";
import { computeFairValue, evaluateScalpEntry, evaluateScalpExit } from "./scalp-strategy";
import { recordResolution } from "./executor";
import { insertTrade } from "../db/queries";
import { getSettings, getCumulativePnl, getTotalTradeCount, getTodayPnl, getConsecutiveLosses, getConsecutiveWins, getTodayLossCount, getRecentTradeConditionIds } from "../db/queries";
import { startMarketScanner, stopMarketScanner, getActiveMarkets, getActiveMarketForAsset, getRecentOutcomes, markOutcomeResolved } from "../prices/market-scanner";
import { getClobClient, redeemWinnings, getClaimablePositions, placeLimitBuyOrder, placeLimitSellOrder, cancelOrder, getOrderStatus, placeSellOrder } from "../polymarket/client";
import { startBinanceWs, stopBinanceWs, getBinancePrice, getWindowOpenPrice, getBtcWindowChange, isBinanceFresh, getBinanceLastUpdate, getBtcVelocity } from "../prices/binance-ws";
import { Wallet } from "@ethersproject/wallet";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "@ethersproject/contracts";
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
  ScalpPositionState,
  PendingBuyState,
  ScalpData,
} from "@/types";

// ---- Global Bot State ----

let botStatus: BotStatus = "stopped";
let connectionStatus: ConnectionStatus = "disconnected";
let lastAction = "Idle";
let lastActionTime: string | null = null;

let currentMarket: MarketInfo | null = null;
let currentPrices: MarketPrices | null = null;
let currentPosition: Position | null = null;

const windowPositions: Map<string, WindowPosition> = new Map();
const marketInfoCache: Map<string, MarketInfo> = new Map();
const lastResolutionAttempt: Map<string, number> = new Map();
const RESOLUTION_RETRY_MS = 5000;

// Pending claims queue
interface PendingClaim { conditionId: string; negRisk: boolean; asset: string; attempts: number; nextAttempt: number; }
const pendingClaims: PendingClaim[] = [];
const MAX_CLAIM_ATTEMPTS = 20;
const CLAIM_RETRY_INTERVAL_MS = 30_000;

// ---- Scalp State ----

interface ScalpPos {
  id: string;
  conditionId: string;
  slug: string;
  asset: MarketAsset;
  side: "yes" | "no";
  tokenId: string;
  entryPrice: number;
  shares: number;
  costBasis: number;
  sellPrice: number;
  sellOrderId: string | null;
  buyOrderId: string;
  entryTime: number;
  windowEndTs: number;
}

interface PendingBuy {
  orderId: string;
  conditionId: string;
  slug: string;
  asset: MarketAsset;
  side: "yes" | "no";
  tokenId: string;
  price: number;
  size: number;
  placedAt: number;
  windowEndTs: number;
  tickSize: string;
  negRisk: boolean;
}

const scalpPositions: ScalpPos[] = [];
const pendingBuys: PendingBuy[] = [];
let cooldownUntilWindow = 0;
let lastEntryEvalTime = 0;
const ENTRY_EVAL_INTERVAL_MS = 5000;

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

// Standalone price broadcast interval
let priceBroadcastInterval: ReturnType<typeof setInterval> | null = null;

// Cached settings
let cachedSettings: BotSettings | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_MS = 2000;

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

// Wallet balance cache
let cachedWalletBalance: number | null = null;
let cachedWalletAddress: string | null = null;
let walletBalanceFetchTime = 0;
const WALLET_BALANCE_CACHE_MS = 30_000;

// Track last logged decision per asset
const lastLoggedDecision: Record<string, { reason: string; time: number }> = {};

// SSE subscribers
const sseListeners: Set<(event: SSEEvent) => void> = new Set();

let scannerAutoStarted = false;

// ---- SSE Broadcasting ----

function ensureScannerRunning() {
  if (scannerAutoStarted) return;
  scannerAutoStarted = true;
  const settings = getCachedSettings();
  startMarketScanner(settings.enabledAssets);
  logger.info("[Engine] Auto-started market scanner for dashboard");
}

let lastOutcomesJson = "";

function ensurePriceBroadcast() {
  if (priceBroadcastInterval) return;
  let emptyCount = 0;
  priceBroadcastInterval = setInterval(() => {
    if (sseListeners.size === 0) return;
    const settings = getCachedSettings();
    const activeMarketsRecord: Record<string, ActiveMarketState> = {};
    for (const am of getActiveMarkets()) {
      activeMarketsRecord[am.asset] = am;
    }

    if (Object.keys(activeMarketsRecord).length === 0) {
      emptyCount++;
      if (emptyCount === 5 || emptyCount % 30 === 0) {
        logger.warn(`[Engine] No active markets found after ${emptyCount} broadcast cycles`);
      }
    } else {
      emptyCount = 0;
    }

    const outcomes = getRecentOutcomes(settings.enabledAssets);
    const outcomesJson = JSON.stringify(outcomes);
    const outcomesChanged = outcomesJson !== lastOutcomesJson;
    if (outcomesChanged) lastOutcomesJson = outcomesJson;

    const btcChange = getBtcWindowChange();
    const fair = computeFairValue(btcChange);

    broadcast({
      type: "price",
      data: {
        markets: activeMarketsRecord,
        ...(outcomesChanged ? { recentOutcomes: outcomes } : {}),
        scalp: {
          binancePrice: getBinancePrice(),
          windowOpenPrice: getWindowOpenPrice(),
          btcChangePercent: btcChange,
          fairValue: fair,
          positions: scalpPositions.map(posToState),
          pendingBuys: pendingBuys.map(buyToState),
          cooldownUntil: cooldownUntilWindow,
        } as ScalpData,
      },
      timestamp: new Date().toISOString(),
    });
  }, 1000);
}

function posToState(p: ScalpPos): ScalpPositionState {
  const currentPrice = p.side === "yes"
    ? (getActiveMarketForAsset(p.asset)?.yesPrice ?? p.entryPrice)
    : (getActiveMarketForAsset(p.asset)?.noPrice ?? p.entryPrice);
  return {
    id: p.id,
    conditionId: p.conditionId,
    slug: p.slug,
    asset: p.asset,
    side: p.side,
    entryPrice: p.entryPrice,
    shares: p.shares,
    costBasis: p.costBasis,
    currentPrice,
    sellPrice: p.sellPrice,
    sellOrderId: p.sellOrderId,
    buyOrderId: p.buyOrderId,
    entryTime: p.entryTime,
    windowEndTs: p.windowEndTs,
    unrealizedPnl: p.shares * currentPrice - p.costBasis,
  };
}

function buyToState(b: PendingBuy): PendingBuyState {
  return {
    orderId: b.orderId,
    conditionId: b.conditionId,
    slug: b.slug,
    asset: b.asset,
    side: b.side,
    price: b.price,
    size: b.size,
    placedAt: b.placedAt,
  };
}

export function subscribeSSE(listener: (event: SSEEvent) => void): () => void {
  ensureScannerRunning();
  ensurePriceBroadcast();
  // Also start Binance WS so dashboard always has price data
  startBinanceWs();

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
    try { listener(event); } catch { sseListeners.delete(listener); }
  }
}

function broadcastState() {
  broadcast({ type: "state", data: getState(), timestamp: new Date().toISOString() });
}

function broadcastTrade(trade: TradeRecord) {
  broadcast({ type: "trade", data: trade, timestamp: new Date().toISOString() });
}

function broadcastLog(message: string) {
  broadcast({ type: "log", data: { message }, timestamp: new Date().toISOString() });
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
  broadcast({ type: "alert", data: alert, timestamp: alert.timestamp });
}

// ---- Capital & Risk ----

function getCapitalState(settings: BotSettings): CapitalState {
  let deployed = 0;
  for (const p of scalpPositions) deployed += p.costBasis;
  for (const b of pendingBuys) deployed += b.price * b.size;

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

// ---- Wallet Balance ----

function refreshWalletBalance() {
  const now = Date.now();
  if (now - walletBalanceFetchTime < WALLET_BALANCE_CACHE_MS) return;
  walletBalanceFetchTime = now;

  const privateKey = process.env.PRIVATE_KEY;
  const funderAddress = process.env.FUNDER_ADDRESS;
  if (!privateKey) return;

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const wallet = new Wallet(privateKey, provider);
    cachedWalletAddress = funderAddress || wallet.address;

    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const usdcE = new Contract("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", erc20Abi, provider);
    const usdcNative = new Contract("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", erc20Abi, provider);

    const addresses: string[] = [];
    if (funderAddress) addresses.push(funderAddress);
    if (!funderAddress || funderAddress.toLowerCase() !== wallet.address.toLowerCase()) {
      addresses.push(wallet.address);
    }

    Promise.all(
      addresses.flatMap((addr) => [
        usdcE.balanceOf(addr).then((r: any) => Number(r) / 1e6).catch(() => 0),
        usdcNative.balanceOf(addr).then((r: any) => Number(r) / 1e6).catch(() => 0),
      ])
    ).then((balances) => {
      const onChain = balances.reduce((sum, b) => sum + b, 0);
      cachedWalletBalance = onChain;

      if (clobReady) {
        getClobClient().then((client) => {
          if (!client) return;
          client.getBalanceAllowance({ asset_type: "COLLATERAL" as any }).then((resp: any) => {
            const rawBalance = resp?.balance || "0";
            const parsed = parseFloat(rawBalance);
            const exchange = parsed > 1_000_000 ? parsed / 1e6 : parsed;
            cachedWalletBalance = onChain + exchange;
          }).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch {
    // Ignore
  }
}

// ---- State Getters ----

export function getState(): BotState {
  const settings = getCachedSettings();
  const secondsRemaining = getSecondsRemaining();

  refreshWalletBalance();

  let eligible = false;
  let ineligibleReason: string | undefined;

  if (!currentMarket) {
    ineligibleReason = "No active market found";
  } else if (!currentPrices) {
    ineligibleReason = "Waiting for price data";
  } else {
    eligible = true;
  }

  const marketStatus: MarketStatus = {
    market: currentMarket,
    prices: currentPrices,
    secondsRemaining,
    eligible,
    ineligibleReason,
  };

  const activeMarketsRecord: Record<string, ActiveMarketState> = {};
  for (const am of getActiveMarkets()) {
    activeMarketsRecord[am.asset] = am;
  }

  const positionsRecord: Record<string, WindowPosition> = {};
  for (const [key, pos] of windowPositions) {
    positionsRecord[key] = pos;
  }

  const btcChange = getBtcWindowChange();
  // Use first active market's secondsRemaining for dashboard fair value display
  const statusActiveMarkets = getActiveMarkets();
  const displaySecsRemaining = statusActiveMarkets.length > 0 ? statusActiveMarkets[0].secondsRemaining : 450;
  const fair = computeFairValue(btcChange, displaySecsRemaining, getBtcVelocity(60_000));

  return {
    status: botStatus,
    connection: connectionStatus,
    lastAction,
    lastActionTime,
    currentMarket: marketStatus,
    currentPosition,
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
    arbState: null,
    arbStats: { windowsPlayed: 0, bothSidesFilled: 0, oneSideFilled: 0, neitherFilled: 0, totalPnl: 0, avgProfitPerWindow: 0 },
    walletBalance: cachedWalletBalance,
    walletAddress: cachedWalletAddress,
    scalp: {
      binancePrice: getBinancePrice(),
      windowOpenPrice: getWindowOpenPrice(),
      btcChangePercent: btcChange,
      fairValue: fair,
      positions: scalpPositions.map(posToState),
      pendingBuys: pendingBuys.map(buyToState),
      cooldownUntil: cooldownUntilWindow,
    },
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
      }

      currentMarket = market;
      marketInfoCache.set(market.conditionId, market);
      connectionStatus = "connected";

      const prices = await fetchMidpointPrices(market);
      if (prices) {
        currentPrices = prices;
      }
    } else {
      currentMarket = null;
      currentPrices = null;
      connectionStatus = "connected";
    }
  } catch (err) {
    connectionStatus = "disconnected";
    const e = err as any;
    logger.error(`Market refresh failed: ${e?.message || err}`);
  }

  broadcastState();
}

// ---- Main Trading Loop (Scalp) ----

let loopRunning = false;

async function tradingLoop() {
  if (botStatus !== "running") return;
  if (loopRunning) return;
  loopRunning = true;

  try {
    const settings = getCachedSettings();

    if (checkCircuitBreaker(settings)) {
      broadcastState();
      return;
    }

    if (!settings.scalpEnabled) {
      loopRunning = false;
      return;
    }

    const activeMarkets = getActiveMarkets();
    const now = Date.now();
    const btcChange = getBtcWindowChange();
    const binanceFresh = isBinanceFresh();

    // ---- 1. Check pending buy orders for fills ----
    for (let i = pendingBuys.length - 1; i >= 0; i--) {
      const buy = pendingBuys[i];

      // Cancel if window expired
      const windowEnd = buy.windowEndTs * 1000;
      if (now > windowEnd) {
        try { await cancelOrder(buy.orderId); } catch {}
        logger.info(`[SCALP] Cancelled expired buy order ${buy.orderId}`);
        pendingBuys.splice(i, 1);
        continue;
      }

      // Poll fill status
      const status = await getOrderStatus(buy.orderId);
      if (!status) continue;

      const s = status.status.toUpperCase();
      if (s === "MATCHED" || s === "CLOSED" || s === "FILLED") {
        if (status.sizeFilled > 0) {
          const fillPrice = status.price || buy.price;
          const fillShares = status.sizeFilled;
          const costBasis = fillShares * fillPrice;
          const sellTarget = Math.min(0.99, Math.round((fillPrice + settings.scalpProfitTarget) * 100) / 100);

          // Record buy trade
          const trade = insertTrade({
            timestamp: new Date().toISOString(),
            conditionId: buy.conditionId,
            slug: buy.slug,
            side: buy.side,
            action: "buy",
            price: fillPrice,
            amount: costBasis,
            shares: fillShares,
            pnl: null,
            paper: settings.paperTrading,
            orderId: buy.orderId,
            asset: buy.asset,
            subStrategy: "scalp",
            binancePriceAtEntry: getBinancePrice(),
            slippage: null,
            takerFee: 0,
          });
          broadcastTrade(trade);

          // Place limit sell
          let sellOrderId: string | null = null;
          if (!settings.paperTrading) {
            const sellResult = await placeLimitSellOrder(
              buy.tokenId, sellTarget, fillShares, buy.tickSize, buy.negRisk
            );
            if (sellResult.success && sellResult.orderId) {
              sellOrderId = sellResult.orderId;
            }
          }

          const posId = `scalp-${buy.conditionId.slice(0, 8)}-${Date.now()}`;
          scalpPositions.push({
            id: posId,
            conditionId: buy.conditionId,
            slug: buy.slug,
            asset: buy.asset,
            side: buy.side,
            tokenId: buy.tokenId,
            entryPrice: fillPrice,
            shares: fillShares,
            costBasis,
            sellPrice: sellTarget,
            sellOrderId,
            buyOrderId: buy.orderId,
            entryTime: now,
            windowEndTs: buy.windowEndTs,
          });

          lastAction = `Scalp buy ${buy.asset} ${buy.side.toUpperCase()} @ $${fillPrice.toFixed(2)}`;
          lastActionTime = new Date().toISOString();
          broadcastLog(`Scalp entry: ${buy.side.toUpperCase()} ${fillShares.toFixed(1)} shares @ $${fillPrice.toFixed(2)}, sell target $${sellTarget.toFixed(2)}`);
          addAlert("info", `Scalp buy: ${buy.side.toUpperCase()} @ $${fillPrice.toFixed(2)}`, buy.asset);

          pendingBuys.splice(i, 1);
          marketInfoCache.set(buy.conditionId, getActiveMarketForAsset(buy.asset)?.market!);
        }
      } else if (s === "CANCELLED" || s === "EXPIRED" || s === "REJECTED") {
        broadcastLog(`Buy order ${s}: ${buy.side.toUpperCase()} ${buy.asset} @ $${buy.price.toFixed(2)} (${buy.orderId.slice(0, 12)}...)`);
        addAlert("warning", `Order ${s.toLowerCase()}: ${buy.side.toUpperCase()} @ $${buy.price.toFixed(2)}`, buy.asset);
        pendingBuys.splice(i, 1);
      } else {
        // Still LIVE/OPEN - log occasionally
        const ageMs = now - buy.placedAt;
        if (ageMs > 10000 && ageMs % 15000 < 1100) {
          broadcastLog(`Order still open: ${buy.side.toUpperCase()} @ $${buy.price.toFixed(2)} (${Math.round(ageMs / 1000)}s)`);
        }
      }
    }

    // ---- 2. Manage active scalp positions (sell fills, trailing, time exits) ----
    for (let i = scalpPositions.length - 1; i >= 0; i--) {
      const pos = scalpPositions[i];
      const am = getActiveMarketForAsset(pos.asset);
      const currentPrice = am ? (pos.side === "yes" ? am.yesPrice : am.noPrice) : pos.entryPrice;
      const windowTs = pos.windowEndTs;
      const secsRemaining = Math.max(0, windowTs + 900 - Math.floor(now / 1000));

      // Check if sell order filled (live) or price hit target (paper)
      if (pos.sellOrderId && !settings.paperTrading) {
        const sellStatus = await getOrderStatus(pos.sellOrderId);
        if (sellStatus) {
          const ss = sellStatus.status.toUpperCase();
          if ((ss === "MATCHED" || ss === "CLOSED" || ss === "FILLED") && sellStatus.sizeFilled > 0) {
            const sellPrice = sellStatus.price || pos.sellPrice;
            const pnl = pos.shares * sellPrice - pos.costBasis;

            insertTrade({
              timestamp: new Date().toISOString(),
              conditionId: pos.conditionId,
              slug: pos.slug,
              side: pos.side,
              action: "sell",
              price: sellPrice,
              amount: pos.shares * sellPrice,
              shares: pos.shares,
              pnl,
              paper: false,
              orderId: pos.sellOrderId,
              asset: pos.asset,
              subStrategy: "scalp",
              binancePriceAtEntry: null,
              slippage: null,
              takerFee: 0,
            });

            broadcastLog(`Scalp exit: ${pos.side.toUpperCase()} @ $${sellPrice.toFixed(2)} | P&L: $${pnl.toFixed(4)}`);
            addAlert(pnl >= 0 ? "success" : "warning", `Scalp sold @ $${sellPrice.toFixed(2)} | P&L: $${pnl.toFixed(4)}`, pos.asset);
            lastAction = `Scalp sold ${pos.asset} @ $${sellPrice.toFixed(2)}`;
            lastActionTime = new Date().toISOString();

            if (pnl < 0) {
              const currentWindowStart = Math.floor(now / 1000 / 900) * 900;
              cooldownUntilWindow = currentWindowStart + 900 * settings.scalpCooldownWindows;
            }

            scalpPositions.splice(i, 1);
            continue;
          }
        }
      } else if (settings.paperTrading && currentPrice >= pos.sellPrice) {
        // Paper mode: simulate fill at sell target
        const pnl = pos.shares * pos.sellPrice - pos.costBasis;

        insertTrade({
          timestamp: new Date().toISOString(),
          conditionId: pos.conditionId,
          slug: pos.slug,
          side: pos.side,
          action: "sell",
          price: pos.sellPrice,
          amount: pos.shares * pos.sellPrice,
          shares: pos.shares,
          pnl,
          paper: true,
          orderId: null,
          asset: pos.asset,
          subStrategy: "scalp",
          binancePriceAtEntry: null,
          slippage: null,
          takerFee: 0,
        });

        broadcastLog(`[PAPER] Scalp profit: ${pos.side.toUpperCase()} @ $${pos.sellPrice.toFixed(2)} | P&L: $${pnl.toFixed(4)}`);
        addAlert("success", `Scalp sold @ $${pos.sellPrice.toFixed(2)} | +$${pnl.toFixed(4)}`, pos.asset);
        lastAction = `Scalp sold ${pos.asset} @ $${pos.sellPrice.toFixed(2)}`;
        lastActionTime = new Date().toISOString();

        scalpPositions.splice(i, 1);
        continue;
      }

      // Evaluate exit signal
      const exitVelocity = getBtcVelocity(60_000);
      const exitSignal = evaluateScalpExit(
        pos.entryPrice, pos.sellPrice, currentPrice, btcChange, pos.side, secsRemaining, settings.scalpProfitTarget, exitVelocity
      );

      if (exitSignal.action === "trail" && exitSignal.sellPrice && exitSignal.sellPrice > pos.sellPrice) {
        // Cancel old sell, place new one higher
        if (pos.sellOrderId && !settings.paperTrading) {
          try { await cancelOrder(pos.sellOrderId); } catch {}
        }
        const newSellPrice = exitSignal.sellPrice;
        let newSellOrderId: string | null = null;
        if (!settings.paperTrading && am) {
          const res = await placeLimitSellOrder(pos.tokenId, newSellPrice, pos.shares, am.tickSize, am.negRisk);
          if (res.success && res.orderId) newSellOrderId = res.orderId;
        }
        pos.sellPrice = newSellPrice;
        pos.sellOrderId = newSellOrderId;
        const trailFair = computeFairValue(btcChange, secsRemaining, exitVelocity);
        broadcastLog(`Trail sell: ${pos.side.toUpperCase()} $${pos.sellPrice.toFixed(2)} (fair $${(pos.side === "yes" ? trailFair.up : trailFair.down).toFixed(2)})`);
      } else if (exitSignal.action === "sell_profit" || exitSignal.action === "sell_loss") {
        // Time-based exit: cancel limit sell, place market sell
        if (pos.sellOrderId && !settings.paperTrading) {
          try { await cancelOrder(pos.sellOrderId); } catch {}
        }

        const sellPrice = exitSignal.sellPrice || currentPrice;
        const pnl = pos.shares * sellPrice - pos.costBasis;

        if (!settings.paperTrading && am) {
          // Place aggressive sell to fill immediately
          await placeSellOrder(pos.tokenId, sellPrice, pos.shares, am.tickSize, am.negRisk);
        }

        insertTrade({
          timestamp: new Date().toISOString(),
          conditionId: pos.conditionId,
          slug: pos.slug,
          side: pos.side,
          action: "sell",
          price: sellPrice,
          amount: pos.shares * sellPrice,
          shares: pos.shares,
          pnl,
          paper: settings.paperTrading,
          orderId: null,
          asset: pos.asset,
          subStrategy: "scalp",
          binancePriceAtEntry: null,
          slippage: null,
          takerFee: 0,
        });

        broadcastLog(`${exitSignal.action === "sell_profit" ? "Profit exit" : "Loss cut"}: ${pos.side.toUpperCase()} @ $${sellPrice.toFixed(2)} | P&L: $${pnl.toFixed(4)}`);
        addAlert(pnl >= 0 ? "success" : "warning", `Scalp ${exitSignal.action === "sell_profit" ? "profit" : "loss"} @ $${sellPrice.toFixed(2)}`, pos.asset);

        if (pnl < 0) {
          const currentWindowStart = Math.floor(now / 1000 / 900) * 900;
          cooldownUntilWindow = currentWindowStart + 900 * settings.scalpCooldownWindows;
        }

        scalpPositions.splice(i, 1);
        continue;
      } else if (exitSignal.action === "hold_resolution") {
        // Hold to resolution - window will expire and resolve
        broadcastLog(exitSignal.reason);
      }

      // If window expired for a held position, resolve it
      if (secsRemaining <= 0) {
        const cachedMarket = marketInfoCache.get(pos.conditionId);
        if (cachedMarket) {
          let resolvedSide = await fetchMarketResolution(pos.slug);
          if (resolvedSide === null) resolvedSide = await fetchClobResolution(cachedMarket);
          if (resolvedSide !== null) {
            const won = pos.side === resolvedSide;
            const resolutionPrice = won ? 1.0 : 0.0;
            const pnl = pos.shares * resolutionPrice - pos.costBasis;

            if (pos.sellOrderId && !settings.paperTrading) {
              try { await cancelOrder(pos.sellOrderId); } catch {}
            }

            insertTrade({
              timestamp: new Date().toISOString(),
              conditionId: pos.conditionId,
              slug: pos.slug,
              side: pos.side,
              action: "resolution",
              price: resolutionPrice,
              amount: pos.shares * resolutionPrice,
              shares: pos.shares,
              pnl,
              paper: settings.paperTrading,
              orderId: null,
              asset: pos.asset,
              subStrategy: "scalp",
              binancePriceAtEntry: null,
              slippage: null,
              takerFee: null,
            });

            markOutcomeResolved(pos.slug, resolvedSide === "yes" ? "up" : "down");
            broadcastLog(`Resolution: ${pos.side.toUpperCase()} ${won ? "WON" : "LOST"} | P&L: $${pnl.toFixed(4)}`);
            addAlert(won ? "success" : "warning", `Resolved ${won ? "WON" : "LOST"}: $${pnl.toFixed(4)}`, pos.asset);

            if (!settings.paperTrading && won) {
              pendingClaims.push({
                conditionId: cachedMarket.conditionId,
                negRisk: cachedMarket.negRisk,
                asset: pos.asset,
                attempts: 0,
                nextAttempt: now + 5000,
              });
            }

            if (pnl < 0) {
              const currentWindowStart = Math.floor(now / 1000 / 900) * 900;
              cooldownUntilWindow = currentWindowStart + 900 * settings.scalpCooldownWindows;
            }

            scalpPositions.splice(i, 1);
          }
        }
      }
    }

    // ---- 3. Evaluate new scalp entries (every 5s) ----
    if (now - lastEntryEvalTime >= ENTRY_EVAL_INTERVAL_MS) {
      lastEntryEvalTime = now;

      // Gate 1: Coinbase data must be fresh
      if (!binanceFresh) {
        const lastLog = lastLoggedDecision["_binance"];
        if (!lastLog || now - lastLog.time >= 15000) {
          lastLoggedDecision["_binance"] = { reason: "no-coinbase", time: now };
          const age = getBinanceLastUpdate() > 0 ? Math.round((now - getBinanceLastUpdate()) / 1000) : -1;
          broadcastLog(`Waiting for Bitbo feed (last update: ${age >= 0 ? age + "s ago" : "never"})`);
        }
      } else {
      // Gate 2: Cooldown
      const currentWindowStart = Math.floor(now / 1000 / 900) * 900;
      if (cooldownUntilWindow > currentWindowStart) {
        const winsToWait = Math.ceil((cooldownUntilWindow - currentWindowStart) / 900);
        const lastLog = lastLoggedDecision["_cooldown"];
        if (!lastLog || now - lastLog.time >= 15000) {
          lastLoggedDecision["_cooldown"] = { reason: "cooldown", time: now };
          broadcastLog(`Cooldown: skipping ${winsToWait} more window(s) after loss`);
        }
      } else {
        for (const market of activeMarkets) {
          if (!settings.enabledAssets.includes(market.asset)) continue;

          // Check position limits
          const positionsForAsset = scalpPositions.filter(p => p.conditionId === market.conditionId).length;
          const pendingForAsset = pendingBuys.filter(b => b.conditionId === market.conditionId).length;
          if (positionsForAsset + pendingForAsset >= settings.scalpMaxPositions) continue;

          // Check capital
          const capital = getCapitalState(settings);
          if (capital.available < settings.scalpTradeSize) continue;

          // Don't enter too close to end
          if (market.secondsRemaining < 180) continue;

          const velocity = getBtcVelocity(60_000); // 60s lookback
          const signal = evaluateScalpEntry(
            btcChange, market.yesPrice, market.noPrice,
            settings.scalpMinGap, settings.scalpEntryMin, settings.scalpEntryMax,
            market.secondsRemaining, velocity
          );

          // Diagnostic log every 15s showing why we skipped or what signal we got
          const diagKey = `_diag_${market.asset}`;
          const lastDiag = lastLoggedDecision[diagKey];
          if (!lastDiag || now - lastDiag.time >= 15000) {
            lastLoggedDecision[diagKey] = { reason: "diag", time: now };
            const fair = computeFairValue(btcChange, market.secondsRemaining, velocity);
            const upGap = fair.up - market.yesPrice;
            const downGap = fair.down - market.noPrice;
            const flat = Math.abs(btcChange) < 0.0005;
            const timeMin = Math.floor(market.secondsRemaining / 60);
            const timeSec = market.secondsRemaining % 60;
            const velStr = `vel ${(velocity * 100).toFixed(3)}%/m`;
            const velDamp = (1 / (1 + Math.abs(velocity) * 400) * 100).toFixed(0);
            if (flat) {
              broadcastLog(`[${market.asset}] BTC flat (${(btcChange * 100).toFixed(3)}%) ${timeMin}:${timeSec.toString().padStart(2, "0")} left | YES $${market.yesPrice.toFixed(2)} NO $${market.noPrice.toFixed(2)}`);
            } else if (!signal) {
              broadcastLog(`[${market.asset}] ${timeMin}:${timeSec.toString().padStart(2, "0")} left | BTC ${(btcChange * 100).toFixed(3)}% ${velStr} (${velDamp}% conf) | UP $${market.yesPrice.toFixed(2)} fair $${fair.up.toFixed(2)} gap ${upGap >= 0 ? "+" : ""}${upGap.toFixed(2)} | DOWN $${market.noPrice.toFixed(2)} fair $${fair.down.toFixed(2)} gap ${downGap >= 0 ? "+" : ""}${downGap.toFixed(2)} | Need ${settings.scalpMinGap.toFixed(2)}+`);
            }
          }

          if (signal) {
            const tokenId = signal.side === "yes" ? market.yesTokenId : market.noTokenId;
            const shares = settings.scalpTradeSize / signal.actualPrice;
            const windowTs = parseInt(market.slug.split("-").pop() || "0", 10);

            if (settings.paperTrading) {
              // Paper mode: instant fill
              const posId = `scalp-paper-${Date.now()}`;
              const sellTarget = Math.min(0.99, Math.round((signal.actualPrice + settings.scalpProfitTarget) * 100) / 100);

              insertTrade({
                timestamp: new Date().toISOString(),
                conditionId: market.conditionId,
                slug: market.slug,
                side: signal.side,
                action: "buy",
                price: signal.actualPrice,
                amount: settings.scalpTradeSize,
                shares,
                pnl: null,
                paper: true,
                orderId: posId,
                asset: market.asset,
                subStrategy: "scalp",
                binancePriceAtEntry: getBinancePrice(),
                slippage: null,
                takerFee: 0,
              });

              scalpPositions.push({
                id: posId,
                conditionId: market.conditionId,
                slug: market.slug,
                asset: market.asset,
                side: signal.side,
                tokenId,
                entryPrice: signal.actualPrice,
                shares,
                costBasis: settings.scalpTradeSize,
                sellPrice: sellTarget,
                sellOrderId: null,
                buyOrderId: posId,
                entryTime: now,
                windowEndTs: windowTs,
              });
              marketInfoCache.set(market.conditionId, market.market);

              broadcastLog(`[PAPER] Scalp entry: ${signal.reason} | sell target $${sellTarget.toFixed(2)}`);
              addAlert("info", `Scalp buy: ${signal.side.toUpperCase()} @ $${signal.actualPrice.toFixed(2)}`, market.asset);
            } else {
              // Live: place limit buy (postOnly)
              // GTC without postOnly so it can fill immediately as taker
              const result = await placeLimitBuyOrder(tokenId, signal.actualPrice, shares, market.tickSize, market.negRisk, false);
              if (result.success && result.orderId) {
                pendingBuys.push({
                  orderId: result.orderId,
                  conditionId: market.conditionId,
                  slug: market.slug,
                  asset: market.asset,
                  side: signal.side,
                  tokenId,
                  price: signal.actualPrice,
                  size: shares,
                  placedAt: now,
                  windowEndTs: windowTs,
                  tickSize: market.tickSize,
                  negRisk: market.negRisk,
                });
                marketInfoCache.set(market.conditionId, market.market);
                broadcastLog(`Limit buy placed: ${signal.reason}`);
                addAlert("info", `Limit buy: ${signal.side.toUpperCase()} @ $${signal.actualPrice.toFixed(2)}`, market.asset);
              }
            }

            lastAction = `Scalp signal: ${signal.side.toUpperCase()} @ $${signal.actualPrice.toFixed(2)}`;
            lastActionTime = new Date().toISOString();
          }
        }
      }
      } // end binanceFresh else
    }

    // ---- 4. Process pending claims ----
    for (let i = pendingClaims.length - 1; i >= 0; i--) {
      const claim = pendingClaims[i];
      if (now < claim.nextAttempt) continue;

      claim.attempts++;
      try {
        const res = await redeemWinnings(claim.conditionId, claim.negRisk);
        if (res.success) {
          broadcastLog(`${claim.asset} winnings claimed on-chain (attempt ${claim.attempts})`);
          addAlert("success", `Claimed winnings for ${claim.asset}`, claim.asset as MarketAsset);
          pendingClaims.splice(i, 1);
        } else {
          logger.info(`[Redeem] ${claim.asset} attempt ${claim.attempts}/${MAX_CLAIM_ATTEMPTS}: ${res.error}`);
          if (claim.attempts >= MAX_CLAIM_ATTEMPTS) {
            addAlert("warning", `Auto-claim failed for ${claim.asset}`, claim.asset as MarketAsset);
            pendingClaims.splice(i, 1);
          } else {
            claim.nextAttempt = now + CLAIM_RETRY_INTERVAL_MS;
          }
        }
      } catch (err) {
        logger.error(`[Redeem] ${claim.asset} attempt ${claim.attempts} error: ${err}`);
        if (claim.attempts >= MAX_CLAIM_ATTEMPTS) {
          pendingClaims.splice(i, 1);
        } else {
          claim.nextAttempt = now + CLAIM_RETRY_INTERVAL_MS;
        }
      }
    }
  } catch (err) {
    logger.error(`Trading loop error: ${err}`);
    broadcastLog(`Error: ${err}`);
  } finally {
    loopRunning = false;
  }

  broadcastState();
}

// ---- Bot Controls ----

export async function startBot(): Promise<{ success: boolean; error?: string }> {
  if (botStatus === "running") {
    return { success: false, error: "Bot is already running" };
  }

  logger.info("Starting bot...");
  botStatus = "running";
  lastAction = "Bot started";
  lastActionTime = new Date().toISOString();

  const settings = getCachedSettings();

  // Start data feeds
  ensureScannerRunning();
  startBinanceWs();
  addAlert("info", `Market scanner active for: ${settings.enabledAssets.join(", ")}`);
  addAlert("info", "Binance BTC price feed connected");

  // Initialize CLOB client for live trading
  if (!settings.paperTrading) {
    try {
      const client = await getClobClient();
      if (client) {
        clobReady = true;
        addAlert("success", "CLOB client ready for live trading");
      } else {
        clobReady = false;
        addAlert("error", "CLOB client failed - check PRIVATE_KEY and FUNDER_ADDRESS");
      }
    } catch {
      clobReady = false;
      addAlert("error", "CLOB client initialization failed");
    }
    broadcastState();
  } else {
    clobReady = false;
    addAlert("info", "Paper mode - CLOB client not needed");
  }

  // Scan for unclaimed winnings
  if (!settings.paperTrading) {
    try {
      const claimablePositions = await getClaimablePositions();
      if (claimablePositions.length > 0) {
        let queued = 0;
        for (const pos of claimablePositions) {
          const alreadyQueued = pendingClaims.some(c => c.conditionId === pos.conditionId);
          if (alreadyQueued) continue;
          pendingClaims.push({
            conditionId: pos.conditionId,
            negRisk: pos.negRisk,
            asset: "BTC",
            attempts: 0,
            nextAttempt: Date.now() + 5000,
          });
          queued++;
        }
        if (queued > 0) {
          broadcastLog(`Found ${queued} claimable position(s) - queued for auto-claim`);
        }
      }

      const recentTrades = getRecentTradeConditionIds(6);
      if (recentTrades.length > 0) {
        const { checkProxyTokenBalance } = await import("../polymarket/client");
        let queued = 0;
        for (const t of recentTrades) {
          const alreadyQueued = pendingClaims.some(c => c.conditionId === t.conditionId);
          if (alreadyQueued) continue;
          const hasTokens = await checkProxyTokenBalance(t.conditionId);
          if (hasTokens) {
            pendingClaims.push({
              conditionId: t.conditionId,
              negRisk: true,
              asset: t.asset,
              attempts: 0,
              nextAttempt: Date.now() + 5000,
            });
            queued++;
          }
        }
        if (queued > 0) {
          broadcastLog(`DB scan found ${queued} additional claimable position(s)`);
        }
      }

      if (pendingClaims.length === 0) {
        logger.info(`[Redeem] No unclaimed positions found`);
      }
    } catch (err) {
      logger.error(`[Redeem] Startup claim scan failed: ${err}`);
    }
  }

  refreshMarket();

  loopInterval = setInterval(tradingLoop, 1000);
  marketRefreshInterval = setInterval(refreshMarket, 30000);

  broadcastState();
  broadcastLog("Bot started - Scalp strategy active");
  addAlert("success", "Bot started successfully");

  return { success: true };
}

export function stopBot(): { success: boolean; error?: string } {
  if (botStatus === "stopped") {
    return { success: false, error: "Bot is already stopped" };
  }

  logger.info("Stopping bot...");

  if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
  if (marketRefreshInterval) { clearInterval(marketRefreshInterval); marketRefreshInterval = null; }

  // Cancel all pending orders
  for (const buy of pendingBuys) {
    cancelOrder(buy.orderId).catch(() => {});
  }
  for (const pos of scalpPositions) {
    if (pos.sellOrderId) cancelOrder(pos.sellOrderId).catch(() => {});
  }
  pendingBuys.length = 0;

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
