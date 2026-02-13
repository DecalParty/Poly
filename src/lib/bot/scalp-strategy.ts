/**
 * Scalp Strategy -- Market-Anchored Fair Value
 *
 * The ultimate edge: Bitbo's BTC price leads Polymarket by 1-2 seconds.
 *
 * 1. ANCHOR on Polymarket's current prices (market consensus)
 * 2. DETECT the unreflected BTC move (last 3s delta  the part Polymarket
 *    hasn't caught up to yet)
 * 3. CALCULATE expected Polymarket adjustment from that unreflected move
 * 4. WEIGHT by 30min BTC trend (confirms or weakens the signal)
 * 5. BUY the undervalued side before Polymarket adjusts
 *
 * No time dampening  we're not predicting end-of-window, we're predicting
 * the next 1-2 seconds of price movement. Bitbo LEADS, Polymarket FOLLOWS.
 */

// -- Sensitivity: how much does Polymarket move per BTC % change? -------------
// Observed: a 0.1% BTC move ($69) shifts Polymarket prices by ~4-6 cents.
// That's 40-60 cents per 1%. Using 50 as the middle estimate.
const CENTS_PER_BTC_PERCENT = 50;

/**
 * Compute market-anchored fair values for UP and DOWN.
 *
 * @param yesPrice - current Polymarket UP price
 * @param noPrice  - current Polymarket DOWN price
 * @param btcDelta - BTC $ change in last ~3 seconds (unreflected move)
 * @param btcPrice - current BTC price from Bitbo
 * @param trendDirection - 1 (up), -1 (down), 0 (flat) over last 30min
 * @param trendStrength - 0 to 1, how consistent the trend is
 * @param secondsRemaining - seconds left in 15-min window (used for entry guard only)
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
  if (btcPrice <= 0) return { up: yesPrice, down: noPrice };

  // 1. Convert BTC $ move to expected Polymarket adjustment
  const btcPctMove = btcDelta / btcPrice;
  const rawAdjustment = btcPctMove * CENTS_PER_BTC_PERCENT;

  // 2. Trend multiplier: trend confirms recent move -> boost, opposes -> reduce
  let trendMultiplier = 1.0;
  const deltaDirection = btcDelta > 0 ? 1 : btcDelta < 0 ? -1 : 0;
  if (deltaDirection !== 0 && trendDirection !== 0) {
    if (deltaDirection === trendDirection) {
      trendMultiplier = 1.0 + 0.5 * trendStrength; // max 1.5x
    } else {
      trendMultiplier = 1.0 - 0.5 * trendStrength; // min 0.5x
    }
  }

  // 3. No time dampening  we're predicting the NEXT 1-2 second price
  //    adjustment, not the end-of-window outcome. Bitbo leads, Polymarket follows.
  const adjustment = rawAdjustment * trendMultiplier;

  // 4. Apply: BTC went up -> UP should be higher, DOWN should be lower
  const fairUp = Math.max(0.01, Math.min(0.99, yesPrice + adjustment));
  const fairDown = Math.max(0.01, Math.min(0.99, noPrice - adjustment));

  return { up: fairUp, down: fairDown };
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
 * Evaluate whether there's an entry opportunity based on market-anchored
 * fair value. If Bitbo shows BTC moved and Polymarket hasn't caught up,
 * the gap between fair and actual price is our edge.
 */
export function evaluateScalpEntry(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
  minGap: number,
  entryMin: number,
  entryMax: number,
): ScalpEntrySignal | null {
  // Don't enter too close to window end
  if (secondsRemaining < 180) return null;

  // Need some BTC movement to have a signal
  if (btcPrice <= 0 || Math.abs(btcDelta) < 5) return null;

  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;   // positive = UP is undervalued
  const downGap = fair.down - noPrice; // positive = DOWN is undervalued (btcDelta < 0)

  // Check both sides
  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Pick the side with the bigger gap
  if (upValid && (!downValid || upGap >= downGap)) {
    const trendStr = trendDirection > 0 ? "UP" : trendDirection < 0 ? "DN" : "--";
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `UP: $${yesPrice.toFixed(2)} -> fair $${fair.up.toFixed(2)} (gap +${upGap.toFixed(2)}) | BTC +$${btcDelta.toFixed(0)} trend${trendStr}${(trendStrength * 100).toFixed(0)}%`,
    };
  }

  if (downValid) {
    const trendStr = trendDirection > 0 ? "UP" : trendDirection < 0 ? "DN" : "--";
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `DOWN: $${noPrice.toFixed(2)} -> fair $${fair.down.toFixed(2)} (gap +${downGap.toFixed(2)}) | BTC -$${Math.abs(btcDelta).toFixed(0)} trend${trendStr}${(trendStrength * 100).toFixed(0)}%`,
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
 * Evaluate exit conditions for a spike trade.
 *
 * Simple logic for fast exits:
 * - Profit target hit -> sell
 * - Price dropped too far below entry (stop loss) -> sell
 * - 2 min before window end -> sell at whatever price
 * - Otherwise hold
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

  // Stop loss: if price dropped more than 2x the profit target, cut it
  if (pnl < -(profitTarget * 2)) {
    return {
      action: "sell_loss",
      sellPrice: currentPrice,
      reason: `Stop loss: $${currentPrice.toFixed(2)} = $${pnl.toFixed(2)} from entry $${entryPrice.toFixed(2)}`,
    };
  }

  // Time exit: configurable seconds before window end
  if (secondsRemaining <= exitWindowSecs) {
    if (pnl > 0) {
      return {
        action: "sell_profit",
        sellPrice: currentPrice,
        reason: `Time exit (profit): $${currentPrice.toFixed(2)}, +$${pnl.toFixed(2)}, ${secondsRemaining}s left`,
      };
    }
    return {
      action: "sell_loss",
      sellPrice: currentPrice,
      reason: `Time exit (loss): $${currentPrice.toFixed(2)}, $${pnl.toFixed(2)}, ${secondsRemaining}s left`,
    };
  }

  return { action: "hold", reason: `Holding: $${currentPrice.toFixed(2)}, pnl $${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` };
}
