/**
 * Value Strategy -- Late Window Fair Probability Betting
 *
 * The most reliable edge: Late in the window, BTC's position is mostly settled.
 * We know where BTC is relative to open. We can estimate the "fair" probability.
 * If the market is mispricing by enough, we buy the underpriced side.
 *
 * Why this works:
 * 1. Less uncertainty late in window (BTC position clearer)
 * 2. Less time for reversals  
 * 3. Resolution approaching = market must converge to fair value
 *
 * Typical use: Enter in last 5-8 minutes, hold for profit target or resolution
 */

import { getWindowOpenPrice, getBinancePrice } from "../prices/binance-ws";

// -- Fair Probability Estimation ----------------------------------------------

/**
 * Estimate fair probability of UP winning based on current BTC position.
 * 
 * Based on typical BTC 15-min behavior:
 * - 0% change = 50%
 * - +0.05% change = ~62%
 * - +0.10% change = ~72%
 * - +0.20% change = ~85%
 * - +0.50% change = ~95%
 * 
 * Uses sigmoid mapping for smooth transitions.
 */
export function estimateFairProbability(btcChangePercent: number): number {
  // Scale factor: higher = probability moves faster with BTC change
  const scale = 35;
  const sigmoid = 1 / (1 + Math.exp(-btcChangePercent * scale));
  return Math.max(0.02, Math.min(0.98, sigmoid));
}

/**
 * Calculate the gap between fair probability and market price.
 */
export function calculateValueGap(
  btcChangePercent: number,
  yesPrice: number,
  noPrice: number,
): { side: "yes" | "no" | null; gap: number; fairProb: number } {
  const fairProbUp = estimateFairProbability(btcChangePercent);
  const fairProbDown = 1 - fairProbUp;
  
  const yesGap = fairProbUp - yesPrice;
  const noGap = fairProbDown - noPrice;
  
  if (yesGap > noGap && yesGap > 0) {
    return { side: "yes", gap: yesGap, fairProb: fairProbUp };
  } else if (noGap > 0) {
    return { side: "no", gap: noGap, fairProb: fairProbDown };
  }
  
  return { side: null, gap: 0, fairProb: 0.5 };
}

// -- Entry Signal -------------------------------------------------------------

export interface ValueEntrySignal {
  side: "yes" | "no";
  fairValue: number;
  actualPrice: number;
  gap: number;
  reason: string;
}

/**
 * Evaluate entry for value strategy.
 * Only enters late in window when probability estimate is reliable.
 */
export function evaluateValueEntry(
  yesPrice: number,
  noPrice: number,
  btcPrice: number,
  secondsRemaining: number,
  minGap: number,
  entryMin: number,
  entryMax: number,
  maxSecondsRemaining: number, // Only enter when time left < this
  exitWindowSecs: number,
  lastTradeTime: number,
): ValueEntrySignal | null {
  const openPrice = getWindowOpenPrice();
  
  if (btcPrice <= 0 || openPrice <= 0) return null;

  // Guard 1: Only enter late in window
  if (secondsRemaining > maxSecondsRemaining) return null;

  // Guard 2: Don't enter if we'd have to exit immediately
  if (secondsRemaining <= exitWindowSecs) return null;

  // Guard 3: Post-trade cooldown -- 10s
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 10_000) return null;

  // Calculate BTC % change from window open
  const btcChangePercent = ((btcPrice - openPrice) / openPrice) * 100;
  
  // Calculate gap
  const { side, gap, fairProb } = calculateValueGap(btcChangePercent, yesPrice, noPrice);
  
  if (side === null || gap < minGap) return null;
  
  // Check price bounds
  const price = side === "yes" ? yesPrice : noPrice;
  if (price < entryMin || price > entryMax) return null;

  const changeStr = btcChangePercent >= 0 ? `+${btcChangePercent.toFixed(3)}%` : `${btcChangePercent.toFixed(3)}%`;
  const timeStr = `${Math.floor(secondsRemaining / 60)}:${(secondsRemaining % 60).toString().padStart(2, '0')}`;
  
  return {
    side,
    fairValue: fairProb,
    actualPrice: price,
    gap,
    reason: `[VALUE] BTC ${changeStr} | ${side.toUpperCase()} $${price.toFixed(2)} -> fair $${fairProb.toFixed(2)} (+${(gap * 100).toFixed(1)}c) | ${timeStr} left`,
  };
}

// -- Exit Signal --------------------------------------------------------------

export type ValueExitAction = "hold" | "sell_profit" | "sell_loss" | "hold_resolution";

export interface ValueExitSignal {
  action: ValueExitAction;
  sellPrice?: number;
  reason: string;
}

/**
 * Evaluate exit for value strategy.
 * Can hold to resolution if we're on the winning side.
 */
export function evaluateValueExit(
  entryPrice: number,
  currentPrice: number,
  btcChangePercent: number,
  positionSide: "yes" | "no",
  secondsRemaining: number,
  profitTarget: number,
  exitWindowSecs: number,
): ValueExitSignal {
  const pnl = currentPrice - entryPrice;

  // Profit target hit
  if (pnl >= profitTarget) {
    return {
      action: "sell_profit",
      sellPrice: currentPrice,
      reason: `[VALUE] TARGET: +${(pnl * 100).toFixed(1)}c`,
    };
  }
  
  // Special case: Hold to resolution if we're likely winning
  const likelyWinner = btcChangePercent >= 0 ? "yes" : "no";
  const veryClose = secondsRemaining <= 30;
  const strongPosition = Math.abs(btcChangePercent) >= 0.02;
  
  if (veryClose && strongPosition && positionSide === likelyWinner) {
    return {
      action: "hold_resolution",
      reason: `[VALUE] HOLD FOR WIN: ${btcChangePercent >= 0 ? "+" : ""}${btcChangePercent.toFixed(3)}%`,
    };
  }

  // Exit window
  if (secondsRemaining <= exitWindowSecs) {
    return {
      action: pnl >= 0 ? "sell_profit" : "sell_loss",
      sellPrice: currentPrice,
      reason: `[VALUE] EXIT: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c`,
    };
  }

  return { action: "hold", reason: `[VALUE] HOLD: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c` };
}
