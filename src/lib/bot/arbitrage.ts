import { placeLimitBuyOrder, cancelOrders, getOrderStatus } from "../polymarket/client";
import { insertTrade } from "../db/queries";
import { logger } from "../logger";
import type {
  BotSettings,
  ActiveMarketState,
  ArbWindowState,
  ArbSideFills,
  ArbLadderOrder,
  ArbStats,
  MarketAsset,
  TradeRecord,
} from "@/types";

// --- Arbitrage Manager (singleton) ------------------------------------------------

let currentWindow: ArbWindowState | null = null;
let todayStats: ArbStats = {
  windowsPlayed: 0,
  bothSidesFilled: 0,
  oneSideFilled: 0,
  neitherFilled: 0,
  totalPnl: 0,
  avgProfitPerWindow: 0,
};

// Tracking which window we already placed orders for
let lastPlacedWindowId: string | null = null;

// Track the allocation for the current window so we can return capital correctly
let currentWindowAllocation = 0;

// Track arb capital separately: starts at $30, returns after each resolution
let arbCapitalAvailable = 30;
const ARB_CAPITAL_POOL = 30;

// Callbacks for engine integration
type ArbTradeCallback = (trade: TradeRecord) => void;
type ArbLogCallback = (message: string) => void;
type ArbAlertCallback = (severity: "info" | "success" | "warning" | "error", message: string, asset?: MarketAsset) => void;

let onTrade: ArbTradeCallback = () => {};
let onLog: ArbLogCallback = () => {};
let onAlert: ArbAlertCallback = () => {};

export function setArbCallbacks(
  tradeCb: ArbTradeCallback,
  logCb: ArbLogCallback,
  alertCb: ArbAlertCallback
) {
  onTrade = tradeCb;
  onLog = logCb;
  onAlert = alertCb;
}

export function getArbState(): ArbWindowState | null {
  if (!currentWindow) return null;

  // Update seconds remaining
  const now = Math.floor(Date.now() / 1000);
  currentWindow.secondsRemaining = Math.max(0, currentWindow.endTime - now);

  // Recalculate combined cost
  updateCombinedCost();

  return { ...currentWindow };
}

export function getArbStats(): ArbStats {
  return { ...todayStats };
}

export function resetArbCapital() {
  arbCapitalAvailable = ARB_CAPITAL_POOL;
}

// --- Main Tick (called every second from engine) ---------------------------------

export async function arbTick(
  settings: BotSettings,
  activeMarkets: ActiveMarketState[],
  paperTrading: boolean,
): Promise<void> {
  if (!settings.arbEnabled) return;

  const market = activeMarkets.find(m => m.asset === settings.arbMarket);
  if (!market) return;

  const now = Math.floor(Date.now() / 1000);
  const windowTs = Math.floor(now / 900) * 900;
  const windowId = `${settings.arbMarket.toLowerCase()}-arb-${windowTs}`;
  const secsRemaining = (windowTs + 900) - now;

  // Handle window transition: resolve old window if we moved to a new one
  if (currentWindow && currentWindow.windowId !== windowId) {
    await resolveWindow(currentWindow, paperTrading);
    currentWindow = null;
    lastPlacedWindowId = null;
  }

  // Cancel unfilled orders before window end
  if (currentWindow && secsRemaining <= settings.arbCancelBeforeEnd && currentWindow.status === "active") {
    await cancelUnfilledOrders(currentWindow, paperTrading);
    currentWindow.status = "cancelling";
    onLog(`[ARB] Cancelled unfilled orders -- ${secsRemaining}s before resolution`);
  }

  // Don't open new positions if too close to window end
  if (secsRemaining <= settings.arbCancelBeforeEnd) return;

  // Don't re-place if we already placed for this window
  if (lastPlacedWindowId === windowId) {
    // Simulate fills in paper mode
    if (paperTrading && currentWindow && currentWindow.status === "active") {
      simulatePaperFills(currentWindow, market);
    }
    // In live mode, poll actual fill status from Polymarket
    if (!paperTrading && currentWindow && currentWindow.status === "active") {
      await pollLiveFills(currentWindow);
    }
    return;
  }

  // Check if we have enough capital
  if (arbCapitalAvailable < settings.arbMaxPerWindow) {
    return; // Capital not yet recycled
  }

  // Place ladder orders on both sides
  await placeLadderOrders(settings, market, windowId, windowTs, paperTrading);
}

// --- Ladder Order Placement ------------------------------------------------------

async function placeLadderOrders(
  settings: BotSettings,
  market: ActiveMarketState,
  windowId: string,
  windowTs: number,
  paperTrading: boolean,
) {
  const upBudget = (settings.arbBudgetUp != null && settings.arbBudgetUp > 0)
    ? settings.arbBudgetUp
    : settings.arbMaxPerWindow / 2;
  const downBudget = (settings.arbBudgetDown != null && settings.arbBudgetDown > 0)
    ? settings.arbBudgetDown
    : settings.arbMaxPerWindow / 2;

  const upOrders: ArbLadderOrder[] = [];
  const downOrders: ArbLadderOrder[] = [];

  for (const level of settings.arbLadderLevels) {
    const upDollarAmount = upBudget * level.allocation;
    const downDollarAmount = downBudget * level.allocation;
    const upShares = upDollarAmount / level.price;
    const downShares = downDollarAmount / level.price;

    // UP side order
    const upOrder: ArbLadderOrder = {
      side: "yes",
      price: level.price,
      targetSize: upShares,
      filledSize: 0,
      orderId: null,
      status: "pending",
    };

    // DOWN side order
    const downOrder: ArbLadderOrder = {
      side: "no",
      price: level.price,
      targetSize: downShares,
      filledSize: 0,
      orderId: null,
      status: "pending",
    };

    if (!paperTrading) {
      // Place both sides in parallel for speed
      const [upResult, downResult] = await Promise.all([
        placeLimitBuyOrder(
          market.yesTokenId,
          level.price,
          upShares,
          market.tickSize,
          market.negRisk,
        ),
        placeLimitBuyOrder(
          market.noTokenId,
          level.price,
          downShares,
          market.tickSize,
          market.negRisk,
        ),
      ]);

      if (upResult.success && upResult.orderId) {
        upOrder.orderId = upResult.orderId;
        upOrder.status = "placed";
      }
      if (downResult.success && downResult.orderId) {
        downOrder.orderId = downResult.orderId;
        downOrder.status = "placed";
      }
    } else {
      // Paper mode: mark as placed (fills simulated later)
      upOrder.orderId = `paper-up-${level.price}-${windowTs}`;
      upOrder.status = "placed";
      downOrder.orderId = `paper-down-${level.price}-${windowTs}`;
      downOrder.status = "placed";
    }

    upOrders.push(upOrder);
    downOrders.push(downOrder);

    logger.info(
      `[ARB] Limit order: UP $${level.price} x ${upShares.toFixed(2)} shares | ` +
      `DOWN $${level.price} x ${downShares.toFixed(2)} shares | window=${windowId}`
    );
  }

  // Reserve capital
  arbCapitalAvailable -= settings.arbMaxPerWindow;
  currentWindowAllocation = settings.arbMaxPerWindow;

  currentWindow = {
    windowId,
    conditionId: market.conditionId,
    slug: market.slug,
    asset: settings.arbMarket,
    startTime: windowTs,
    endTime: windowTs + 900,
    secondsRemaining: (windowTs + 900) - Math.floor(Date.now() / 1000),
    upSide: {
      totalShares: 0,
      totalCost: 0,
      avgPrice: 0,
      orders: upOrders,
    },
    downSide: {
      totalShares: 0,
      totalCost: 0,
      avgPrice: 0,
      orders: downOrders,
    },
    combinedCost: 0,
    guaranteedPnl: 0,
    status: "active",
    resolution: "pending",
    pnl: null,
  };

  lastPlacedWindowId = windowId;
  todayStats.windowsPlayed++;

  onLog(`[ARB] Placed ${settings.arbLadderLevels.length * 2} limit orders for ${windowId}`);
  onAlert("info", `Arb: Placed ladder orders for ${settings.arbMarket}`, settings.arbMarket);
}

// --- Live Fill Polling (checks actual order status on Polymarket) -----------------

async function pollLiveFills(window: ArbWindowState) {
  let changed = false;

  for (const order of [...window.upSide.orders, ...window.downSide.orders]) {
    if ((order.status === "placed" || order.status === "partial") && order.orderId) {
      const status = await getOrderStatus(order.orderId);
      if (!status) continue;

      if (status.sizeFilled > order.filledSize) {
        order.filledSize = status.sizeFilled;
        const s = status.status.toUpperCase();
        if (s === "MATCHED" || s === "CLOSED" || s === "FILLED") {
          order.status = "filled";
        } else if (status.sizeFilled > 0) {
          order.status = "partial";
        }
        changed = true;
      }

      // Mark cancelled/expired orders
      const s = status.status.toUpperCase();
      if (s === "CANCELLED" || s === "EXPIRED" || s === "REJECTED") {
        order.status = "cancelled";
        changed = true;
      }
    }
  }

  if (changed) {
    recalcSideFills(window.upSide);
    recalcSideFills(window.downSide);
    updateCombinedCost();
  }
}

// --- Paper Fill Simulation -------------------------------------------------------

function simulatePaperFills(window: ArbWindowState, market: ActiveMarketState) {
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;

  let changed = false;

  for (const order of window.upSide.orders) {
    if (order.status === "placed" || order.status === "partial") {
      if (yesPrice <= order.price + 0.02) {
        const fillPct = yesPrice <= order.price ? 1.0 : 0.3;
        const newFill = order.targetSize * fillPct;
        if (newFill > order.filledSize) {
          order.filledSize = newFill;
          order.status = order.filledSize >= order.targetSize ? "filled" : "partial";
          changed = true;
        }
      }
    }
  }

  for (const order of window.downSide.orders) {
    if (order.status === "placed" || order.status === "partial") {
      if (noPrice <= order.price + 0.02) {
        const fillPct = noPrice <= order.price ? 1.0 : 0.3;
        const newFill = order.targetSize * fillPct;
        if (newFill > order.filledSize) {
          order.filledSize = newFill;
          order.status = order.filledSize >= order.targetSize ? "filled" : "partial";
          changed = true;
        }
      }
    }
  }

  if (changed) {
    recalcSideFills(window.upSide);
    recalcSideFills(window.downSide);
    updateCombinedCost();
  }
}

function recalcSideFills(side: ArbSideFills) {
  let totalShares = 0;
  let totalCost = 0;
  for (const order of side.orders) {
    totalShares += order.filledSize;
    totalCost += order.filledSize * order.price;
  }
  side.totalShares = totalShares;
  side.totalCost = totalCost;
  side.avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
}

function updateCombinedCost() {
  if (!currentWindow) return;
  const up = currentWindow.upSide;
  const down = currentWindow.downSide;

  if (up.avgPrice > 0 && down.avgPrice > 0) {
    currentWindow.combinedCost = up.avgPrice + down.avgPrice;
    const matchedShares = Math.min(up.totalShares, down.totalShares);
    currentWindow.guaranteedPnl = matchedShares * (1 - currentWindow.combinedCost);
  } else if (up.avgPrice > 0 || down.avgPrice > 0) {
    currentWindow.combinedCost = up.avgPrice + down.avgPrice;
    currentWindow.guaranteedPnl = 0;
  } else {
    currentWindow.combinedCost = 0;
    currentWindow.guaranteedPnl = 0;
  }
}

// --- Cancel Unfilled Orders ------------------------------------------------------

async function cancelUnfilledOrders(window: ArbWindowState, paperTrading: boolean) {
  const orderIdsToCancel: string[] = [];

  for (const order of [...window.upSide.orders, ...window.downSide.orders]) {
    if ((order.status === "placed" || order.status === "partial") && order.orderId) {
      if (!paperTrading) {
        orderIdsToCancel.push(order.orderId);
      }
      order.status = "cancelled";
    }
  }

  if (orderIdsToCancel.length > 0 && !paperTrading) {
    await cancelOrders(orderIdsToCancel);
  }

  recalcSideFills(window.upSide);
  recalcSideFills(window.downSide);
  updateCombinedCost();

  logger.info(
    `[ARB] Cancelled ${orderIdsToCancel.length} unfilled orders | ` +
    `UP: ${window.upSide.totalShares.toFixed(2)} shares | ` +
    `DOWN: ${window.downSide.totalShares.toFixed(2)} shares | ` +
    `Combined: $${window.combinedCost.toFixed(3)}`
  );
}

// --- Window Resolution -----------------------------------------------------------

async function resolveWindow(window: ArbWindowState, paperTrading: boolean) {
  if (window.status === "active") {
    await cancelUnfilledOrders(window, paperTrading);
  }

  window.status = "resolved";

  const upShares = window.upSide.totalShares;
  const downShares = window.downSide.totalShares;
  const upCost = window.upSide.totalCost;
  const downCost = window.downSide.totalCost;
  const totalInvested = upCost + downCost;

  const hasBothSides = upShares > 0 && downShares > 0;
  const hasOneSide = (upShares > 0) !== (downShares > 0);

  if (hasBothSides) todayStats.bothSidesFilled++;
  else if (hasOneSide) todayStats.oneSideFilled++;
  else todayStats.neitherFilled++;

  if (totalInvested === 0) {
    arbCapitalAvailable = Math.min(ARB_CAPITAL_POOL, arbCapitalAvailable + currentWindowAllocation);
    onLog(`[ARB] Window ${window.windowId} -- no fills, capital returned`);
    return;
  }

  // Record buy trades for tracking
  if (upShares > 0) {
    const upTrade = insertTrade({
      timestamp: new Date().toISOString(),
      conditionId: window.conditionId,
      slug: window.slug,
      side: "yes",
      action: "buy",
      price: window.upSide.avgPrice,
      amount: upCost,
      shares: upShares,
      pnl: null,
      paper: paperTrading,
      orderId: null,
      asset: window.asset,
      subStrategy: "arbitrage",
      binancePriceAtEntry: null,
      slippage: null,
      takerFee: 0,
    });
    onTrade(upTrade);
  }

  if (downShares > 0) {
    const downTrade = insertTrade({
      timestamp: new Date().toISOString(),
      conditionId: window.conditionId,
      slug: window.slug,
      side: "no",
      action: "buy",
      price: window.downSide.avgPrice,
      amount: downCost,
      shares: downShares,
      pnl: null,
      paper: paperTrading,
      orderId: null,
      asset: window.asset,
      subStrategy: "arbitrage",
      binancePriceAtEntry: null,
      slippage: null,
      takerFee: 0,
    });
    onTrade(downTrade);
  }

  // Paper mode: simulate resolution immediately
  if (paperTrading && totalInvested > 0) {
    const resolvedUp = Math.random() > 0.5;
    const resolvedSide = resolvedUp ? "yes" : "no";

    const upPayout = resolvedUp ? upShares * 1.0 : 0;
    const downPayout = resolvedUp ? 0 : downShares * 1.0;
    const totalPayout = upPayout + downPayout;
    const pnl = totalPayout - totalInvested;

    window.resolution = resolvedUp ? "up" : "down";
    window.pnl = pnl;

    if (upShares > 0) {
      const resTrade = insertTrade({
        timestamp: new Date().toISOString(),
        conditionId: window.conditionId,
        slug: window.slug,
        side: "yes",
        action: "resolution",
        price: resolvedUp ? 1.0 : 0,
        amount: upPayout,
        shares: upShares,
        pnl: upPayout - upCost,
        paper: true,
        orderId: null,
        asset: window.asset,
        subStrategy: "arbitrage",
        binancePriceAtEntry: null,
        slippage: null,
        takerFee: null,
      });
      onTrade(resTrade);
    }
    if (downShares > 0) {
      const resTrade = insertTrade({
        timestamp: new Date().toISOString(),
        conditionId: window.conditionId,
        slug: window.slug,
        side: "no",
        action: "resolution",
        price: resolvedUp ? 0 : 1.0,
        amount: downPayout,
        shares: downShares,
        pnl: downPayout - downCost,
        paper: true,
        orderId: null,
        asset: window.asset,
        subStrategy: "arbitrage",
        binancePriceAtEntry: null,
        slippage: null,
        takerFee: null,
      });
      onTrade(resTrade);
    }

    todayStats.totalPnl += pnl;
    if (todayStats.bothSidesFilled + todayStats.oneSideFilled > 0) {
      todayStats.avgProfitPerWindow = todayStats.totalPnl / (todayStats.bothSidesFilled + todayStats.oneSideFilled);
    }

    arbCapitalAvailable = Math.min(ARB_CAPITAL_POOL, arbCapitalAvailable + totalPayout);

    const resultTag = pnl >= 0 ? "WIN" : "LOSS";
    onLog(
      `[ARB] ${resultTag} Window resolved ${resolvedUp ? "UP" : "DOWN"} | ` +
      `Invested: $${totalInvested.toFixed(2)} | Payout: $${totalPayout.toFixed(2)} | P&L: $${pnl.toFixed(2)}`
    );
    onAlert(
      pnl >= 0 ? "success" : "warning",
      `Arb ${resolvedUp ? "UP" : "DOWN"}: P&L $${pnl.toFixed(2)} (invested $${totalInvested.toFixed(2)})`,
      window.asset,
    );
  } else {
    arbCapitalAvailable = Math.min(ARB_CAPITAL_POOL, arbCapitalAvailable + totalInvested);
  }

  logger.info(
    `[ARB] Window summary: ${window.windowId} | ` +
    `UP: ${upShares.toFixed(2)} @ $${window.upSide.avgPrice.toFixed(3)} | ` +
    `DOWN: ${downShares.toFixed(2)} @ $${window.downSide.avgPrice.toFixed(3)} | ` +
    `Combined: $${window.combinedCost.toFixed(3)} | ` +
    `P&L: ${window.pnl !== null ? "$" + window.pnl.toFixed(2) : "pending"}`
  );
}

export function getArbCapitalDeployed(): number {
  if (!currentWindow) return 0;
  return currentWindow.upSide.totalCost + currentWindow.downSide.totalCost;
}
