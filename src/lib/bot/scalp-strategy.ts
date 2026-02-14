/**
 * Scalp Strategy -- Simple Fair Value
 *
 * SIMPLIFIED: Uses actual BTC % change from window open (fetched from Binance API)
 * to compute fair value. No projections, no derived opens, no velocity extrapolation.
 *
 * Logic:
 * 1. Get actual BTC % change from window open
 * 2. Map it to fair value using the table
 * 3. Apply time decay (markets converge to fair value over time)
 * 4. If fair value > market price by minGap, buy
 *
 * This is what you'd do manually: "BTC is up 0.05% from open, so YES should be ~58%,
 * but it's only 52%, so buy YES."
 */

import { getWindowOpenPrice, getBinancePrice } from "../prices/binance-ws";

// -- Fair Value Table ---------------------------------------------------------
// Maps BTC % change from window open to fair probability of UP winning
const FAIR_VALUE_TABLE = [
  { change: 0.00000, value: 0.500 },  // 0% change = 50/50
  { change: 0.00010, value: 0.520 },  // 0.01% ($9) -> 52%
  { change: 0.00020, value: 0.540 },  // 0.02% ($18) -> 54%
  { change: 0.00035, value: 0.570 },  // 0.035% ($31) -> 57%
  { change: 0.00050, value: 0.600 },  // 0.05% ($45) -> 60%
  { change: 0.00075, value: 0.650 },  // 0.075% ($67) -> 65%
  { change: 0.00100, value: 0.700 },  // 0.10% ($90) -> 70%
  { change: 0.00150, value: 0.780 },  // 0.15% ($135) -> 78%
  { change: 0.00250, value: 0.860 },  // 0.25% ($225) -> 86%
  { change: 0.00500, value: 0.940 },  // 0.50% ($450) -> 94%
  { change: 0.01000, value: 0.990 },  // 1.0% ($900) -> 99%
];

function interpolate(absChange: number): number {
  const table = FAIR_VALUE_TABLE;
  if (absChange <= table[0].change) return table[0].value;
  if (absChange >= table[table.length - 1].change) return table[table.length - 1].value;
  for (let i = 1; i < table.length; i++) {
    if (absChange <= table[i].change) {
      const prev = table[i - 1];
      const curr = table[i];
      const t = (absChange - prev.change) / (curr.change - prev.change);
      return prev.value + t * (curr.value - prev.value);
    }
  }
  return table[table.length - 1].value;
}

/**
 * Time factor: how much weight to give the fair value.
 * Early in window (little elapsed): market hasn't had time to react, more opportunity.
 * Late in window (much elapsed): market has priced it in, less opportunity.
 */
function getTimeFactor(secondsRemaining: number): number {
  const elapsed = Math.max(0, 900 - secondsRemaining);
  // Linear: at 0s elapsed, factor = 0.2; at 900s elapsed, factor = 1.0
  return 0.2 + 0.8 * (elapsed / 900);
}

// How many seconds ahead to project BTC price using recent velocity.
// This is the predictive edge: if BTC moved $30 in the last 30s, project it
// will move another $5 in the next 5 seconds.
const LOOKAHEAD_SECONDS = 5;

/**
 * Compute fair values using BTC change + velocity projection.
 *
 * The prediction logic:
 * 1. Get actual BTC % change from window open (current state)
 * 2. Calculate velocity from recent movement (btcDelta / 30s)
 * 3. Project BTC forward by LOOKAHEAD_SECONDS
 * 4. Compute fair value using PROJECTED change (this is the edge)
 *
 * Why this works:
 * - Bitbo price leads Polymarket by 1-2 seconds
 * - Velocity projection adds another 5 seconds of expected movement
 * - Total: we're predicting where Polymarket SHOULD be in ~6-7 seconds
 * - If that's higher than current market price, we buy
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,      // BTC $ change over last 30s - used for velocity
  btcPrice: number,
  trendDirection: number, // ignored for simplicity
  trendStrength: number,  // ignored
  secondsRemaining: number,
): { up: number; down: number } {
  const openPrice = getWindowOpenPrice();

  // Guard: need valid prices
  if (btcPrice <= 0 || openPrice <= 0) {
    return { up: yesPrice, down: noPrice };
  }

  // Step 1: Calculate velocity from recent movement
  const velocity = btcDelta / 30; // $/sec

  // Step 2: Project BTC forward using velocity
  const projectedBtc = btcPrice + (velocity * LOOKAHEAD_SECONDS);

  // Step 3: Calculate projected % change from window open
  const projectedChange = (projectedBtc - openPrice) / openPrice;
  const absChange = Math.abs(projectedChange);
  const isUp = projectedChange >= 0;

  // Step 4: Look up fair value from table
  const rawFair = interpolate(absChange);

  // Step 5: Apply time factor - deviation grows as window progresses
  const timeFactor = getTimeFactor(secondsRemaining);
  const deviation = (rawFair - 0.50) * timeFactor;
  const fairUp = Math.max(0.01, Math.min(0.99, 0.50 + deviation));
  const fairDown = Math.max(0.01, Math.min(0.99, 1.0 - fairUp));

  // Step 6: Return based on projected direction
  if (isUp) {
    return { up: fairUp, down: fairDown };
  } else {
    return { up: fairDown, down: fairUp };
  }
}

// -- Entry Signal -------------------------------------------------------------

export interface ScalpEntrySignal {
  side: "yes" | "no";
  fairValue: number;
  actualPrice: number;
  gap: number;
  reason: string;
}

export function evaluateScalpEntry(
  yesPrice: number,
  noPrice: number,
  btcDelta30s: number,
  btcDelta5s: number,
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
  minGap: number,
  entryMin: number,
  entryMax: number,
  exitWindowSecs: number,
  lastTradeTime: number,
  prevGap: number,
): ScalpEntrySignal | null {
  if (btcPrice <= 0) return null;

  // Guard 1: don't enter if we'd have to exit immediately
  if (secondsRemaining <= exitWindowSecs) return null;

  // Guard 2: Post-trade cooldown -- 10s after any sell
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 10_000) return null;

  // Compute fair value using actual BTC change from window open
  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta30s, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  // Guard 3: Cap maximum gap -- if gap > 10 cents, data is stale or extreme vol
  const MAX_GAP = 0.10;

  const upValid = upGap >= minGap && upGap <= MAX_GAP && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && downGap <= MAX_GAP && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Calculate velocity and projected change for logging
  const openPrice = getWindowOpenPrice();
  const velocity = btcDelta30s / 30;
  const projectedBtc = btcPrice + (velocity * 5);
  const projectedChangePct = openPrice > 0 ? ((projectedBtc - openPrice) / openPrice * 100).toFixed(3) : "?";
  const velocityStr = velocity >= 0 ? `+$${velocity.toFixed(1)}/s` : `-$${Math.abs(velocity).toFixed(1)}/s`;

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `BUY YES: mkt $${yesPrice.toFixed(2)} ? fair $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c) | proj ${projectedChangePct}% [${velocityStr}]`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `BUY NO: mkt $${noPrice.toFixed(2)} ? fair $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c) | proj ${projectedChangePct}% [${velocityStr}]`,
    };
  }

  return null;
}

// ??? Exit Signal ?????????????????????????????????????????????????????????????

export type ExitAction = "hold" | "sell_profit" | "sell_loss" | "hold_resolution" | "trail";

export interface ScalpExitSignal {
  action: ExitAction;
  sellPrice?: number;
  reason: string;
}

/**
 * Evaluate exit conditions.
 *
 * Only two exits:
 * - Profit target hit -> sell immediately
 * - Exit window reached -> sell everything at whatever price
 *
 * No stop loss. We trust the algorithm. If the position is down,
 * it can recover. The exit window is the safety net.
 */
export function evaluateScalpExit(
  entryPrice: number,
  currentSellTarget: number,
  currentPrice: number,
  btcChangePercent: number,
  positionSide: "yes" | "no",
  secondsRemaining: number,
  profitTarget: number,
  exitWindowSecs: number = 120,
): ScalpExitSignal {
  const pnl = currentPrice - entryPrice;

  // Profit target hit
  if (pnl >= profitTarget) {
    return {
      action: "sell_profit",
      sellPrice: currentPrice,
      reason: `Target hit: $${currentPrice.toFixed(2)} = +$${pnl.toFixed(2)} from entry $${entryPrice.toFixed(2)}`,
    };
  }

  // Exit window: sell all positions at configured time before window end
  if (secondsRemaining <= exitWindowSecs) {
    return {
      action: pnl >= 0 ? "sell_profit" : "sell_loss",
      sellPrice: currentPrice,
      reason: `Exit window: $${currentPrice.toFixed(2)}, ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}, ${secondsRemaining}s left`,
    };
  }

  return { action: "hold", reason: `Holding: $${currentPrice.toFixed(2)}, pnl ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` };
}
