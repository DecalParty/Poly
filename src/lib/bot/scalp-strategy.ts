/**
 * Scalp Strategy -- Unreflected Move Detection
 *
 * The edge: BTC moves, Polymarket lags by 1-3 seconds.
 * Detect recent BTC movement that the market hasn't priced yet.
 * Buy the underpriced side, exit when market catches up.
 *
 * This is fast trading: 
 * - Look at last 3-5 seconds of BTC movement
 * - If BTC moved $15+ and market hasn't reacted, buy
 * - Exit at 2 cent profit
 * - Repeat multiple times per window
 *
 * Goal: Many small 2 cent wins adding up to $1-4/window
 */

import { getWindowOpenPrice, getBtcDelta, getBinancePrice } from "../prices/binance-ws";

// -- Configuration ------------------------------------------------------------

// Minimum BTC movement (in $) to trigger a trade
const MIN_BTC_MOVE = 12;

// Time window for detecting unreflected moves (ms)
const DETECTION_WINDOW_MS = 4000; // 4 seconds

// How much should YES/NO prices move per $1 of BTC movement?
// $50 BTC move typically causes ~2-3 cent YES/NO move
const PRICE_SENSITIVITY = 0.0004; // 0.04 cents per $1

// -- Fair Value Calculation ---------------------------------------------------

/**
 * Calculate expected price shift based on recent BTC movement.
 */
function expectedPriceShift(btcMove: number): number {
  return Math.abs(btcMove) * PRICE_SENSITIVITY;
}

/**
 * Compute fair value based on unreflected BTC movement.
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
): { up: number; down: number } {
  // Get recent BTC movement
  const recentMove = getBtcDelta(DETECTION_WINDOW_MS);
  
  // If BTC hasn't moved enough, no edge
  if (Math.abs(recentMove) < MIN_BTC_MOVE) {
    return { up: yesPrice, down: noPrice };
  }
  
  const shift = expectedPriceShift(recentMove);
  
  if (recentMove > 0) {
    // BTC moved UP - YES should be higher
    return {
      up: Math.min(0.99, yesPrice + shift),
      down: Math.max(0.01, noPrice - shift),
    };
  } else {
    // BTC moved DOWN - NO should be higher
    return {
      up: Math.max(0.01, yesPrice - shift),
      down: Math.min(0.99, noPrice + shift),
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

/**
 * Evaluate entry for scalp strategy.
 * Looks for unreflected recent BTC moves.
 */
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

  // Guard 1: Don't enter if we'd have to exit immediately
  if (secondsRemaining <= exitWindowSecs) return null;

  // Guard 2: Post-trade cooldown -- 5s for fast scalping
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 5_000) return null;

  // Get recent BTC movement
  const recentMove = getBtcDelta(DETECTION_WINDOW_MS);
  
  // Guard 3: Need minimum BTC movement
  if (Math.abs(recentMove) < MIN_BTC_MOVE) return null;

  // Compute fair value
  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta30s, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  const moveDir = recentMove > 0 ? "+" : "";
  const moveStr = `BTC ${moveDir}$${recentMove.toFixed(0)} (${DETECTION_WINDOW_MS/1000}s)`;

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `[SCALP] ${moveStr} | YES $${yesPrice.toFixed(2)} -> $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c)`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `[SCALP] ${moveStr} | NO $${noPrice.toFixed(2)} -> $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c)`,
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
 * Evaluate exit for scalp strategy.
 * Quick exits - don't hold to resolution.
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
      reason: `[SCALP] TARGET: +${(pnl * 100).toFixed(1)}c`,
    };
  }

  // Exit window
  if (secondsRemaining <= exitWindowSecs) {
    return {
      action: pnl >= 0 ? "sell_profit" : "sell_loss",
      sellPrice: currentPrice,
      reason: `[SCALP] EXIT: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c`,
    };
  }

  return { action: "hold", reason: `[SCALP] HOLD: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c` };
}
