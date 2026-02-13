/**
 * Scalp Strategy -- Derived Fair Value
 *
 * Uses ALL available data to compute fair UP/DOWN prices:
 * 1. BTC price from Bitbo (slightly ahead of Polymarket)
 * 2. Current Polymarket prices (to derive the window-open price)
 * 3. Time remaining in the window
 * 4. 30min BTC trend (momentum confirmation)
 *
 * Algorithm:
 * - REVERSE the fair value table using Polymarket's prices to find the
 *   implied BTC % change and derive the window-open price
 * - FORWARD compute fair values using Bitbo's current BTC price
 * - COMPARE our fair values to market prices -> gap = opportunity
 *
 * This solves the window-open mismatch problem (we derive it from
 * Polymarket itself) while still benefiting from Bitbo's leading price.
 */

// -- Fair Value Table ---------------------------------------------------------
// Maps absolute BTC % change -> fair value for the WINNING side.
const FAIR_VALUE_TABLE = [
  { change: 0.0000, value: 0.500 },
  { change: 0.0003, value: 0.505 },
  { change: 0.0005, value: 0.510 },
  { change: 0.0010, value: 0.530 },
  { change: 0.0015, value: 0.550 },
  { change: 0.0020, value: 0.575 },
  { change: 0.0025, value: 0.600 },
  { change: 0.0030, value: 0.640 },
  { change: 0.0040, value: 0.710 },
  { change: 0.0050, value: 0.780 },
  { change: 0.0075, value: 0.870 },
  { change: 0.0100, value: 0.930 },
  { change: 0.0150, value: 0.970 },
];

/** Forward lookup: abs BTC % change -> raw fair value for winning side */
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

/** Reverse lookup: raw fair value -> abs BTC % change */
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

/** Time factor: how much of the raw fair value deviation to apply */
function getTimeFactor(secondsRemaining: number): number {
  const elapsed = Math.max(0, 900 - secondsRemaining);
  return Math.sqrt(Math.min(1, elapsed / 900));
}

/**
 * Compute fair values by deriving window-open from Polymarket prices,
 * then re-computing using Bitbo's current BTC price.
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number, // kept for signature compat, not used directly
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
): { up: number; down: number } {
  if (btcPrice <= 0 || yesPrice <= 0.01 || noPrice <= 0.01) {
    return { up: yesPrice, down: noPrice };
  }

  const timeFactor = getTimeFactor(secondsRemaining);
  if (timeFactor < 0.05) return { up: yesPrice, down: noPrice }; // too early, no confidence

  // -- Step 1: Determine which side is winning and the winning price --
  const downWinning = noPrice > yesPrice;
  const winningPrice = downWinning ? noPrice : yesPrice;

  // -- Step 2: Reverse the table to get implied BTC % change --
  // winningPrice = 0.50 + (rawFair - 0.50) * timeFactor
  // -> rawFair = 0.50 + (winningPrice - 0.50) / timeFactor
  const rawFairImplied = 0.50 + (winningPrice - 0.50) / timeFactor;
  const clampedRawFair = Math.max(0.50, Math.min(0.97, rawFairImplied));
  const impliedAbsChange = reverseInterpolate(clampedRawFair);

  // -- Step 3: Derive window-open price --
  // If DOWN is winning, BTC dropped: open = btcPrice / (1 - impliedChange)
  // If UP is winning, BTC rose: open = btcPrice / (1 + impliedChange)
  // But we use the MARKET-implied change with a reference price.
  // The market sees a slightly older BTC price. We use Bitbo's current.
  const derivedOpen = downWinning
    ? btcPrice / (1 - impliedAbsChange)
    : btcPrice / (1 + impliedAbsChange);

  // -- Step 4: Compute actual BTC % change using Bitbo's current price --
  const actualChange = (btcPrice - derivedOpen) / derivedOpen;
  const actualAbsChange = Math.abs(actualChange);

  // -- Step 5: Forward lookup -> fair value for winning side --
  const rawFairActual = interpolate(actualAbsChange);

  // -- Step 6: Apply time factor + trend --
  let trendBoost = 1.0;
  const actualDir = actualChange > 0 ? 1 : actualChange < 0 ? -1 : 0;
  if (actualDir !== 0 && trendDirection !== 0) {
    if (actualDir === trendDirection) {
      trendBoost = 1.0 + 0.3 * trendStrength; // trend confirms: up to 1.3x
    } else {
      trendBoost = 1.0 - 0.3 * trendStrength; // trend opposes: down to 0.7x
    }
  }

  const deviation = (rawFairActual - 0.50) * timeFactor * trendBoost;
  const winningFair = Math.max(0.01, Math.min(0.99, 0.50 + deviation));
  const losingFair = Math.max(0.01, Math.min(0.99, 1.0 - winningFair));

  if (actualChange >= 0) {
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

/**
 * Evaluate entry: compare derived fair values to market prices.
 * If a side is undervalued by minGap or more, buy it.
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
  if (secondsRemaining < 180) return null;
  if (btcPrice <= 0) return null;

  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  const trendStr = trendDirection > 0 ? "UP" : trendDirection < 0 ? "DN" : "--";

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `UP $${yesPrice.toFixed(2)} -> fair $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c) trend${trendStr}`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `DN $${noPrice.toFixed(2)} -> fair $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c) trend${trendStr}`,
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
