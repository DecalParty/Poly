/**
 * Scalp Strategy -- Market-Anchored Fair Value
 *
 * The ultimate edge: Bitbo's BTC price leads Polymarket by 1-2 seconds.
 * Instead of computing fair value from scratch (broken: window-open mismatch)
 * or racing a spike (too slow), we:
 *
 * 1. ANCHOR on Polymarket's current prices (they reflect Chainlink reality)
 * 2. DETECT unreflected BTC moves via Bitbo (last 10-30s delta)
 * 3. WEIGHT by BTC trend (30min-1hr momentum confirms or weakens the signal)
 * 4. WEIGHT by time remaining (later = more confident in direction)
 * 5. CALCULATE the expected price adjustment Polymarket will make
 * 6. BUY the undervalued side before it adjusts
 *
 * Key insight: we don't need the window-open price. We just need to know
 * that BTC moved $X on Bitbo and Polymarket hasn't adjusted yet.
 */

// -- Sensitivity: how much does Polymarket move per BTC % change? -------------
// Based on observed fair value table: 0.1% BTC move ? 3 cent Polymarket shift.
// This translates BTC dollar moves into expected Polymarket cents.
const CENTS_PER_BTC_PERCENT = 30; // 0.1% BTC -> 3 cents -> 30 cents per 1%

/**
 * Compute market-anchored fair values for UP and DOWN.
 *
 * Takes the CURRENT Polymarket prices as the baseline (market consensus)
 * and adjusts by the unreflected Bitbo move, weighted by trend and time.
 *
 * @param yesPrice - current Polymarket UP price
 * @param noPrice  - current Polymarket DOWN price
 * @param btcDelta - BTC $ change in last 10-30 seconds (unreflected move)
 * @param btcPrice - current BTC price from Bitbo
 * @param trendDirection - 1 (up), -1 (down), 0 (flat) over last 30min-1hr
 * @param trendStrength - 0 to 1, how consistent the trend is
 * @param secondsRemaining - seconds left in the 15-min window
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

  // 1. Convert BTC $ move to expected Polymarket % adjustment
  const btcPctMove = btcDelta / btcPrice; // e.g. $70 / $69000 = 0.001 (0.1%)
  const rawAdjustment = btcPctMove * CENTS_PER_BTC_PERCENT; // e.g. 0.001 * 30 = 0.03 (3 cents)

  // 2. Trend multiplier: if 30min trend confirms the recent move, boost confidence.
  //    If trend opposes, reduce. Neutral trend = 1x.
  //    trendDirection matches btcDelta direction -> boost (up to 1.5x)
  //    trendDirection opposes -> reduce (down to 0.5x)
  let trendMultiplier = 1.0;
  const deltaDirection = btcDelta > 0 ? 1 : btcDelta < 0 ? -1 : 0;
  if (deltaDirection !== 0 && trendDirection !== 0) {
    if (deltaDirection === trendDirection) {
      trendMultiplier = 1.0 + 0.5 * trendStrength; // max 1.5x
    } else {
      trendMultiplier = 1.0 - 0.5 * trendStrength; // min 0.5x
    }
  }

  // 3. Time factor: later in the window = BTC has less time to reverse.
  //    Early in window, current direction might flip, so reduce confidence.
  const elapsed = Math.max(0, 900 - secondsRemaining);
  const timeFactor = Math.sqrt(Math.min(1, elapsed / 900));

  // 4. Final adjustment
  const adjustment = rawAdjustment * trendMultiplier * timeFactor;

  // 5. Apply: BTC went up -> UP should be higher, DOWN should be lower
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
