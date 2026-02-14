/**
 * Scalp Strategy -- Volatility-Adjusted Fair Value
 *
 * Better model that accounts for BTC's actual behavior:
 * 
 * 1. BTC swings a lot � a 0.05% move means nothing if typical 15-min volatility is 0.2%
 * 2. Time matters � 0.05% lead with 2 min left is very different from 12 min left
 * 3. Momentum matters � if BTC is moving at $5/sec, it will likely continue briefly
 *
 * The formula:
 * - Calculate current position (BTC % from open)
 * - Add velocity-based drift (momentum prediction)
 * - Scale by remaining volatility (less time = less expected movement = more certainty)
 * - Convert to probability using sigmoid
 *
 * This properly captures: "BTC is 0.05% up with 3 min left, and moving up at $2/sec,
 * so probability of UP winning is ~75%"
 */

import { getWindowOpenPrice, getBinancePrice } from "../prices/binance-ws";

// Typical BTC 15-minute volatility (standard deviation of % change)
// Historical average is ~0.15% to 0.25% per 15 min. Using 0.15% = 0.0015
const BASE_15MIN_VOL = 0.0015;

// How much weight to give momentum (velocity-based drift)
// Higher = more aggressive predictions based on recent movement
const MOMENTUM_WEIGHT = 3.0; // seconds of projected movement to add

// Sensitivity of the sigmoid � higher = sharper probability transitions
const SIGMOID_SENSITIVITY = 2.5;

/**
 * Sigmoid function: maps any real number to (0, 1)
 * Used to convert z-score to probability
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Calculate remaining volatility based on time left.
 * Volatility scales with sqrt(time) � standard Brownian motion property.
 */
function getRemainingVol(secondsRemaining: number): number {
  const remainingMinutes = secondsRemaining / 60;
  const fractionRemaining = remainingMinutes / 15;
  // Volatility scales with sqrt of time
  return BASE_15MIN_VOL * Math.sqrt(Math.max(0.01, fractionRemaining));
}

/**
 * Compute fair value using volatility-adjusted probability model.
 *
 * Logic:
 * 1. Current position = (btcPrice - openPrice) / openPrice
 * 2. Add velocity drift = momentum prediction for next few seconds
 * 3. Calculate z-score = position / remaining_volatility
 * 4. Convert z-score to probability via sigmoid
 *
 * The z-score represents "how many standard deviations from break-even?"
 * - z = 0 ? 50% (BTC at open)
 * - z = 1 ? ~73% (BTC 1 std dev above open)
 * - z = 2 ? ~88% (BTC 2 std devs above open)
 *
 * With low remaining volatility (late in window), small moves create large z-scores
 * ? probability becomes more extreme ? fair value deviates more from 50%
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,      // BTC $ change over last 30s - used for velocity
  btcPrice: number,
  trendDirection: number, // unused but kept for interface compatibility
  trendStrength: number,  // unused
  secondsRemaining: number,
): { up: number; down: number } {
  const openPrice = getWindowOpenPrice();

  // Guard: need valid prices
  if (btcPrice <= 0 || openPrice <= 0 || secondsRemaining <= 0) {
    return { up: yesPrice, down: noPrice };
  }

  // Step 1: Current position (% change from open)
  const currentChange = (btcPrice - openPrice) / openPrice;

  // Step 2: Calculate velocity and add momentum drift
  const velocity = btcDelta / 30; // $/sec
  const velocityPct = velocity / openPrice; // velocity as % of price per second
  const drift = velocityPct * MOMENTUM_WEIGHT; // projected additional movement

  // Step 3: Adjusted position = current + drift
  const adjustedChange = currentChange + drift;

  // Step 4: Calculate remaining volatility
  const remainingVol = getRemainingVol(secondsRemaining);

  // Step 5: Z-score = adjusted position / remaining volatility
  // This tells us "how many standard deviations from break-even?"
  const zScore = adjustedChange / remainingVol;

  // Step 6: Convert z-score to probability via sigmoid
  const probUp = sigmoid(zScore * SIGMOID_SENSITIVITY);

  // Step 7: Clamp and return
  const fairUp = Math.max(0.01, Math.min(0.99, probUp));
  const fairDown = Math.max(0.01, Math.min(0.99, 1 - probUp));

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

  // Calculate metrics for logging
  const openPrice = getWindowOpenPrice();
  const currentChangePct = openPrice > 0 ? ((btcPrice - openPrice) / openPrice * 100) : 0;
  const velocity = btcDelta30s / 30;
  const remainingVol = BASE_15MIN_VOL * Math.sqrt(Math.max(0.01, secondsRemaining / 900)) * 100; // as %
  const zScore = (currentChangePct / 100 + (velocity / openPrice) * MOMENTUM_WEIGHT) / (remainingVol / 100);

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `BUY YES: mkt $${yesPrice.toFixed(2)} ? fair $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c) | BTC ${currentChangePct >= 0 ? "+" : ""}${currentChangePct.toFixed(3)}% z=${zScore.toFixed(2)}`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `BUY NO: mkt $${noPrice.toFixed(2)} ? fair $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c) | BTC ${currentChangePct >= 0 ? "+" : ""}${currentChangePct.toFixed(3)}% z=${zScore.toFixed(2)}`,
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
