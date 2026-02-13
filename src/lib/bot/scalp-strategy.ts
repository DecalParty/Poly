/**
 * Scalp Strategy -- Fair Value Estimation + Entry/Exit Signals
 *
 * Uses BTC % change from window open (Binance) to estimate what
 * Polymarket UP/DOWN share prices "should" be. When actual price
 * lags behind by minGap ? buy. When price catches up ? sell.
 */

// ??? Fair Value Lookup Table ?????????????????????????????????????????????????
// Maps absolute BTC % change ? fair value for the winning side.
// Losing side = 1 - fairValue. Interpolated linearly between points.
const FAIR_VALUE_TABLE = [
  { change: 0.0000, value: 0.500 },
  { change: 0.0003, value: 0.510 },  // 0.03%
  { change: 0.0005, value: 0.520 },  // 0.05%
  { change: 0.0010, value: 0.555 },  // 0.10%
  { change: 0.0015, value: 0.580 },  // 0.15%
  { change: 0.0020, value: 0.625 },  // 0.20%
  { change: 0.0025, value: 0.665 },  // 0.25%
  { change: 0.0030, value: 0.720 },  // 0.30%
  { change: 0.0040, value: 0.780 },  // 0.40%
  { change: 0.0050, value: 0.850 },  // 0.50%
  { change: 0.0075, value: 0.920 },  // 0.75%
  { change: 0.0100, value: 0.960 },  // 1.00%
  { change: 0.0150, value: 0.980 },  // 1.50%
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
 * Compute fair values for UP and DOWN shares based on BTC % change.
 * Returns { up, down } where each is 0.00 -- 1.00.
 */
export function computeFairValue(btcChangePercent: number): { up: number; down: number } {
  const absChange = Math.abs(btcChangePercent);
  const winningFair = interpolate(absChange);

  if (btcChangePercent >= 0) {
    return { up: winningFair, down: 1 - winningFair };
  } else {
    return { up: 1 - winningFair, down: winningFair };
  }
}

/**
 * Check if BTC is "flat" (within deadzone where no clear direction exists).
 * When flat, both sides are ~$0.50 -- no edge, skip.
 */
export function isBtcFlat(btcChangePercent: number, deadzone = 0.0005): boolean {
  return Math.abs(btcChangePercent) < deadzone;
}

// ??? Entry Signal ????????????????????????????????????????????????????????????

export interface ScalpEntrySignal {
  side: "yes" | "no";
  fairValue: number;
  actualPrice: number;
  gap: number;
  reason: string;
}

/**
 * Evaluate whether there's a scalp entry opportunity.
 * Returns a signal if either UP or DOWN is undervalued by minGap.
 * Prefers the side with the larger gap.
 */
export function evaluateScalpEntry(
  btcChangePercent: number,
  yesPrice: number,
  noPrice: number,
  minGap: number,
  entryMin: number,
  entryMax: number,
): ScalpEntrySignal | null {
  if (isBtcFlat(btcChangePercent)) return null;

  const fair = computeFairValue(btcChangePercent);
  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  // Check UP side
  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  // Check DOWN side
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Pick the side with the bigger gap
  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `UP undervalued: $${yesPrice.toFixed(2)} vs fair $${fair.up.toFixed(2)} (gap $${upGap.toFixed(2)})`,
    };
  }

  return {
    side: "no",
    fairValue: fair.down,
    actualPrice: noPrice,
    gap: downGap,
    reason: `DOWN undervalued: $${noPrice.toFixed(2)} vs fair $${fair.down.toFixed(2)} (gap $${downGap.toFixed(2)})`,
  };
}

// ??? Exit Signal ?????????????????????????????????????????????????????????????

export type ExitAction = "hold" | "sell_profit" | "sell_loss" | "hold_resolution" | "trail";

export interface ScalpExitSignal {
  action: ExitAction;
  sellPrice?: number;
  reason: string;
}

/**
 * Evaluate exit conditions for an active scalp position.
 *
 * Logic:
 * - During window: no auto-sell on dips, let it breathe
 * - Trail sell up if fair value rises above current sell target
 * - At 2 min before end:
 *   -- Price > entry ? sell, take profit
 *   -- Price < entry but BTC supports ? hold to resolution
 *   -- Price < entry and BTC reversed ? sell, cut loss
 */
export function evaluateScalpExit(
  entryPrice: number,
  currentSellTarget: number,
  currentPrice: number,
  btcChangePercent: number,
  positionSide: "yes" | "no",
  secondsRemaining: number,
  profitTarget: number,
): ScalpExitSignal {
  const fair = computeFairValue(btcChangePercent);
  const fairForSide = positionSide === "yes" ? fair.up : fair.down;

  // Trail: if fair value suggests a higher sell, raise the limit
  const trailPrice = Math.max(currentSellTarget, fairForSide - 0.03);
  if (trailPrice > currentSellTarget + 0.01) {
    return {
      action: "trail",
      sellPrice: Math.min(0.99, Math.round(trailPrice * 100) / 100),
      reason: `Trail sell up: $${currentSellTarget.toFixed(2)} ? $${trailPrice.toFixed(2)} (fair $${fairForSide.toFixed(2)})`,
    };
  }

  // Time-based exit: 2 minutes before resolution
  if (secondsRemaining <= 120) {
    const inProfit = currentPrice > entryPrice;
    const btcSupports = (positionSide === "yes" && btcChangePercent > 0.0003) ||
                        (positionSide === "no" && btcChangePercent < -0.0003);

    if (inProfit) {
      return {
        action: "sell_profit",
        sellPrice: currentPrice,
        reason: `Time exit: in profit $${currentPrice.toFixed(2)} > entry $${entryPrice.toFixed(2)}, ${secondsRemaining}s left`,
      };
    }

    if (!inProfit && btcSupports) {
      return {
        action: "hold_resolution",
        reason: `Hold to resolution: BTC supports ${positionSide.toUpperCase()} (${(btcChangePercent * 100).toFixed(3)}%), ${secondsRemaining}s left`,
      };
    }

    return {
      action: "sell_loss",
      sellPrice: currentPrice,
      reason: `Cut loss: $${currentPrice.toFixed(2)} < entry $${entryPrice.toFixed(2)}, BTC reversed, ${secondsRemaining}s left`,
    };
  }

  return { action: "hold", reason: "Holding -- waiting for profit target or time exit" };
}
