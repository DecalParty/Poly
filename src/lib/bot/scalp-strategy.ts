/**
 * Scalp Strategy -- Predictive Fair Value
 *
 * Uses ALL available data to PREDICT where Polymarket prices are heading:
 * 1. BTC price from Bitbo (1-2s ahead of Polymarket)
 * 2. BTC velocity ($/sec over last 30-60s) to project forward
 * 3. Current Polymarket prices (to derive window-open price)
 * 4. Time remaining in window
 * 5. 30min BTC trend (momentum confirmation)
 *
 * KEY FIX: Previous algorithm was circular (derived open from btcPrice,
 * then recomputed change using same btcPrice = always same result).
 * Now we PROJECT btcPrice forward by velocity to break the circularity.
 * If BTC is rising at $3/sec, we project 3 seconds ahead. This predicts
 * where Polymarket WILL be, not where it IS.
 */

// -- Fair Value Table ---------------------------------------------------------
// REVISED: More sensitive to smaller moves for consistent scalps ($1-$3 gains)
const FAIR_VALUE_TABLE = [
  { change: 0.00000, value: 0.500 },
  { change: 0.00010, value: 0.510 }, // 0.01% ($9) -> 51%
  { change: 0.00020, value: 0.525 }, // 0.02% ($18) -> 52.5%
  { change: 0.00035, value: 0.550 }, // 0.035% ($31) -> 55%
  { change: 0.00050, value: 0.580 }, // 0.05% ($45) -> 58%
  { change: 0.00075, value: 0.620 }, // 0.075% ($67) -> 62%
  { change: 0.00100, value: 0.660 }, // 0.10% ($90) -> 66%
  { change: 0.00150, value: 0.720 },
  { change: 0.00250, value: 0.800 },
  { change: 0.00500, value: 0.900 },
  { change: 0.01000, value: 0.980 },
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

function reverseInterpolate(fairValue: number): number {
  const table = FAIR_VALUE_TABLE;
  if (fairValue <= table[0].value) return table[0].change;
  if (fairValue >= table[table.length - 1].value) return table[table.length - 1].change;
  for (let i = 1; i < table.length; i++) {
    if (fairValue <= table[i].value) {
      const prev = table[i - 1];
      const curr = table[i];
      const t = (fairValue - prev.value) / (curr.value - prev.value);
      return prev.change + t * (curr.change - prev.change);
    }
  }
  return table[table.length - 1].change;
}

function getTimeFactor(secondsRemaining: number): number {
  const elapsed = Math.max(0, 900 - secondsRemaining);
  return Math.sqrt(Math.min(1, elapsed / 900));
}

// How many seconds ahead to project BTC price using velocity.
// Larger = more aggressive predictions, more trades, more risk.
// 10s lookahead: stays close to latency-lead edge without becoming a momentum bet.
const LOOKAHEAD_SECONDS = 10;

/**
 * Compute predictive fair values.
 *
 * @param btcDelta - BTC $ change over last 30s (used to compute velocity)
 * @param btcPrice - current BTC price from Bitbo
 *
 * The trick: derive the window-open from Polymarket's current prices + btcPrice,
 * then compute fair value using a PROJECTED btcPrice (current + velocity * lookahead).
 * This breaks the circular math and creates a real gap when BTC is moving.
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
  if (btcPrice <= 0 || yesPrice <= 0.01 || noPrice <= 0.01) {
    return { up: yesPrice, down: noPrice };
  }

  const timeFactor = getTimeFactor(secondsRemaining);
  if (timeFactor < 0.05) return { up: yesPrice, down: noPrice };

  // -- Step 1: Derive window-open from market prices --
  const downWinning = noPrice > yesPrice;
  const winningPrice = downWinning ? noPrice : yesPrice;

  const rawFairImplied = 0.50 + (winningPrice - 0.50) / timeFactor;
  const clampedRawFair = Math.max(0.50, Math.min(0.97, rawFairImplied));
  const impliedAbsChange = reverseInterpolate(clampedRawFair);

  const derivedOpen = downWinning
    ? btcPrice / (1 - impliedAbsChange)
    : btcPrice / (1 + impliedAbsChange);

  // -- Step 2: Project BTC forward using velocity --
  // btcDelta is the $ change over the last 30 seconds.
  // velocity = btcDelta / 30 seconds -> project forward by LOOKAHEAD_SECONDS
  const velocity = btcDelta / 30; // $/sec
  const projectedBtc = btcPrice + velocity * LOOKAHEAD_SECONDS;

  // -- Step 3: Compute fair value using PROJECTED price --
  const projectedChange = (projectedBtc - derivedOpen) / derivedOpen;
  const projectedAbsChange = Math.abs(projectedChange);
  const rawFairProjected = interpolate(projectedAbsChange);

  // -- Step 4: Trend boost --
  let trendBoost = 1.0;
  const projDir = projectedChange > 0 ? 1 : projectedChange < 0 ? -1 : 0;
  if (projDir !== 0 && trendDirection !== 0) {
    if (projDir === trendDirection) {
      trendBoost = 1.0 + 0.3 * trendStrength;
    } else {
      trendBoost = 1.0 - 0.3 * trendStrength;
    }
  }

  // -- Step 5: Compute final fair values --
  const deviation = (rawFairProjected - 0.50) * timeFactor * trendBoost;
  const winningFair = Math.max(0.01, Math.min(0.99, 0.50 + deviation));
  const losingFair = Math.max(0.01, Math.min(0.99, 1.0 - winningFair));

  if (projectedChange >= 0) {
    return { up: winningFair, down: losingFair };
  } else {
    return { up: losingFair, down: winningFair };
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
  consecutiveGapHits: number,
): ScalpEntrySignal | null {
  if (btcPrice <= 0) return null;

  // Guard 1: don't enter if we'd have to exit immediately
  if (secondsRemaining <= exitWindowSecs) return null;

  // Guard 2: Post-trade cooldown -- 15s after any sell.
  // Fast enough to catch continued moves, slow enough to avoid chop re-entry.
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 15_000) return null;

  // Guard 3: Minimum velocity -- need some BTC movement, but keep threshold low.
  // $0.1/sec = $3 in 30s. Captures slow drifts too.
  const velocity30s = btcDelta30s / 30;
  if (Math.abs(velocity30s) < 0.1) return null;

  // Guard 4: Reversal detection -- only block if 5s is STRONGLY opposite to 30s.
  // A weak counter-tick is just noise. Only block if 5s velocity is > $1/sec opposite.
  const velocity5s = btcDelta5s / 5;
  const strongReversal = (velocity30s > 0 && velocity5s < -1.0) || (velocity30s < 0 && velocity5s > 1.0);
  if (strongReversal) return null;

  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta30s, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  // Guard 5: Cap maximum gap -- if gap > 8 cents, data is stale or extreme vol
  const MAX_GAP = 0.08;

  const upValid = upGap >= minGap && upGap <= MAX_GAP && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && downGap <= MAX_GAP && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Guard 6: Gap persistence -- require gap to exist for 2+ consecutive eval cycles.
  // Real moves persist across cycles; noise doesn't. Filters false positives.
  if (consecutiveGapHits < 2) return null;

  const trendStr = trendDirection > 0 ? "UP" : trendDirection < 0 ? "DN" : "--";

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `UP $${yesPrice.toFixed(2)} -> $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c) v30=$${velocity30s.toFixed(1)} v5=$${velocity5s.toFixed(1)} ${trendStr}`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `DN $${noPrice.toFixed(2)} -> $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c) v30=$${velocity30s.toFixed(1)} v5=$${velocity5s.toFixed(1)} ${trendStr}`,
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

  // Soft stop-loss: cut at 3x profit target drawdown to prevent one bad trade
  // from wiping out multiple small wins.
  const stopThreshold = profitTarget * 3;
  if (pnl <= -stopThreshold) {
    return {
      action: "sell_loss",
      sellPrice: currentPrice,
      reason: `Stop loss: $${currentPrice.toFixed(2)} = ${pnl.toFixed(2)} from entry $${entryPrice.toFixed(2)} (>${stopThreshold.toFixed(2)} drawdown)`,
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
