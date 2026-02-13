/**
 * Scalp Strategy -- Delta-Based Spike Trading
 *
 * Bitbo's BTC price leads Polymarket by 1-2 seconds.
 * When BTC moves significantly on Bitbo, Polymarket's order book
 * hasn't adjusted yet. Buy the side that benefits before it catches up.
 *
 * No fair value table. No window-open price. Just:
 * 1. Detect BTC move on Bitbo (> $SPIKE_THRESHOLD in last few seconds)
 * 2. BTC went up -> buy UP (YES) at current Polymarket price
 * 3. BTC went down -> buy DOWN (NO) at current Polymarket price
 * 4. Sell when Polymarket catches up (entry + profit target)
 */

// -- Fair Value (kept for dashboard display only) -----------------------------
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

/** Dashboard display only -- not used for trading decisions. */
export function computeFairValue(
  btcChangePercent: number,
  secondsRemaining: number = 0,
  btcVelocity: number = 0,
): { up: number; down: number } {
  const absChange = Math.abs(btcChangePercent);
  const rawFair = interpolate(absChange);
  const elapsed = Math.max(0, 900 - secondsRemaining);
  const timeFactor = Math.sqrt(Math.min(1, elapsed / 900));
  const winningFair = 0.50 + (rawFair - 0.50) * timeFactor;
  if (btcChangePercent >= 0) {
    return { up: winningFair, down: 1 - winningFair };
  } else {
    return { up: 1 - winningFair, down: winningFair };
  }
}

// -- Spike Entry Signal -------------------------------------------------------

export interface ScalpEntrySignal {
  side: "yes" | "no";
  fairValue: number;
  actualPrice: number;
  gap: number;
  reason: string;
}

/**
 * Evaluate whether there's a spike entry opportunity.
 *
 * @param btcDelta - BTC dollar change in the last few seconds (from Bitbo)
 * @param yesPrice - current Polymarket UP price
 * @param noPrice  - current Polymarket DOWN price
 * @param spikeThreshold - minimum $ move to trigger (e.g. 75)
 * @param entryMin - don't buy below this price (too extreme)
 * @param entryMax - don't buy above this price (no room for profit)
 *
 * Logic: if BTC moved >$spikeThreshold, buy the side that benefits.
 * BTC up -> buy YES (UP will increase once Polymarket catches up)
 * BTC down -> buy NO (DOWN will increase once Polymarket catches up)
 */
export function evaluateScalpEntry(
  btcDelta: number,
  yesPrice: number,
  noPrice: number,
  spikeThreshold: number,
  entryMin: number,
  entryMax: number,
  secondsRemaining: number = 450,
  btcVelocity: number = 0,
): ScalpEntrySignal | null {
  // Need a significant move
  if (Math.abs(btcDelta) < spikeThreshold) return null;

  // Don't enter in last 2 minutes (handled by engine but double-check)
  if (secondsRemaining < 120) return null;

  if (btcDelta > 0) {
    // BTC went UP -> buy YES (UP shares will increase)
    if (yesPrice < entryMin || yesPrice > entryMax) return null;
    return {
      side: "yes",
      fairValue: yesPrice + 0.05, // estimate: price should go up
      actualPrice: yesPrice,
      gap: btcDelta,
      reason: `BTC +$${btcDelta.toFixed(0)} spike -> buy UP @ $${yesPrice.toFixed(2)}`,
    };
  } else {
    // BTC went DOWN -> buy NO (DOWN shares will increase)
    if (noPrice < entryMin || noPrice > entryMax) return null;
    return {
      side: "no",
      fairValue: noPrice + 0.05,
      actualPrice: noPrice,
      gap: Math.abs(btcDelta),
      reason: `BTC -$${Math.abs(btcDelta).toFixed(0)} spike -> buy DOWN @ $${noPrice.toFixed(2)}`,
    };
  }
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
  btcVelocity: number = 0,
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

  // Time exit: 2 minutes before window end
  if (secondsRemaining <= 120) {
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
