/**
 * Scalp Strategy -- Unreflected Move Detection
 *
 * The edge: Polymarket prices lag behind BTC movements by a few seconds.
 * When BTC moves, the YES/NO prices should adjust proportionally.
 * If they haven't adjusted yet, there's a gap we can exploit.
 *
 * Key insight: We don't need to predict where BTC is going.
 * We just need to detect when the market hasn't caught up to where BTC IS.
 *
 * Formula:
 * 1. Calculate how much YES/NO prices SHOULD have moved based on recent BTC change
 * 2. Compare to how much they ACTUALLY moved
 * 3. The difference is the gap
 *
 * Goal: 2 cent profit per trade, multiple trades per window = $1-4/window
 */

import { getWindowOpenPrice, getBtcDelta, getBinancePrice } from "../prices/binance-ws";

// How much should YES/NO prices move per $1 of BTC movement?
// Empirically, a $50 BTC move typically causes ~2-3 cent YES/NO move
// So roughly 0.0005 per $1 (0.05 cents per $1)
const PRICE_SENSITIVITY = 0.0005;

// Minimum BTC movement (in $) to consider (filters noise)
const MIN_BTC_MOVE = 8;

// Time windows for detecting unreflected moves
const FAST_WINDOW_MS = 3000;  // 3 seconds - very recent, likely unreflected
const SLOW_WINDOW_MS = 15000; // 15 seconds - should be reflected by now

/**
 * Calculate expected YES/NO price change based on BTC movement.
 * 
 * Logic:
 * - BTC moved $X in the last few seconds
 * - YES/NO should move proportionally
 * - If BTC up $50, YES should be up ~2.5 cents
 */
function expectedPriceChange(btcMove: number): number {
  return btcMove * PRICE_SENSITIVITY;
}

/**
 * Compute fair value based on unreflected BTC movement.
 * 
 * The key insight:
 * - Fast BTC movement (last 3s) may not be reflected yet
 * - Slower movement (last 15s) should already be priced in
 * - The difference tells us how much is "unreflected"
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,      // Not used - we get fresh deltas
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
): { up: number; down: number } {
  // Get BTC movement over different time windows
  const fastMove = getBtcDelta(FAST_WINDOW_MS);  // Last 3s
  const slowMove = getBtcDelta(SLOW_WINDOW_MS);  // Last 15s
  
  // The "unreflected" portion is roughly the fast move
  // (since slow moves should already be priced in)
  const unreflectedMove = fastMove;
  
  // If BTC hasn't moved enough recently, no edge
  if (Math.abs(unreflectedMove) < MIN_BTC_MOVE) {
    return { up: yesPrice, down: noPrice };
  }
  
  // Calculate expected price shift from unreflected move
  const expectedShift = expectedPriceChange(unreflectedMove);
  
  // Direction: positive BTC move = YES should be higher
  if (unreflectedMove > 0) {
    // BTC moved UP recently - YES should be higher than it is
    return {
      up: Math.min(0.99, yesPrice + Math.abs(expectedShift)),
      down: Math.max(0.01, noPrice - Math.abs(expectedShift)),
    };
  } else {
    // BTC moved DOWN recently - NO should be higher than it is
    return {
      up: Math.max(0.01, yesPrice - Math.abs(expectedShift)),
      down: Math.min(0.99, noPrice + Math.abs(expectedShift)),
    };
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

  // Guard 2: Post-trade cooldown -- 5s after any trade (fast for scalping)
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 5_000) return null;

  // Get recent BTC movement
  const fastMove = getBtcDelta(FAST_WINDOW_MS);
  
  // Compute fair value based on unreflected movement
  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta30s, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  // Check if either side has a tradeable gap
  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Build reason string
  const moveDir = fastMove > 0 ? "+" : "";
  const moveStr = `BTC ${moveDir}$${fastMove.toFixed(0)} (3s)`;

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `${moveStr} | YES $${yesPrice.toFixed(2)} -> $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c)`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `${moveStr} | NO $${noPrice.toFixed(2)} -> $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c)`,
    };
  }

  return null;
}

// -- Exit Signal --------------------------------------------------------------

export type ExitAction = "hold" | "sell_profit" | "sell_loss" | "hold_resolution" | "trail";

export interface ScalpExitSignal {
  action: ExitAction;
  sellPrice?: number;
  reason: string;
}

/**
 * Evaluate exit conditions.
 *
 * Two exits:
 * - Profit target hit (2 cents) -> sell immediately
 * - Exit window reached -> sell everything at whatever price
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
      reason: `TARGET: +${(pnl * 100).toFixed(1)}c`,
    };
  }

  // Exit window: sell all positions at configured time before window end
  if (secondsRemaining <= exitWindowSecs) {
    return {
      action: pnl >= 0 ? "sell_profit" : "sell_loss",
      sellPrice: currentPrice,
      reason: `EXIT: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c, ${secondsRemaining}s left`,
    };
  }

  return { action: "hold", reason: `HOLD: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c` };
}
