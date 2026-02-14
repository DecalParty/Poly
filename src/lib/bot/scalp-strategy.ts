/**
 * Scalp Strategy -- BTC Price Action Patterns
 *
 * The edge: Predicting BTC's next 10-60 seconds based on well-documented
 * price action patterns. BTC has predictable micro-behaviors:
 *
 * 1. MEAN REVERSION - Sharp spikes often pull back
 *    - BTC drops $40 in 5 sec -> bounce likely -> buy YES
 *    - BTC spikes $40 in 5 sec -> pullback likely -> buy NO
 *
 * 2. MOMENTUM CONTINUATION - Steady grinds continue
 *    - BTC grinding up for 30+ sec -> likely continues -> buy YES
 *    - BTC grinding down for 30+ sec -> likely continues -> buy NO
 *
 * 3. EXHAUSTION - Fast moves that slow down reverse
 *    - Sharp move followed by stall -> reversal likely
 *
 * Goal: 2 cent profit per trade, multiple trades per window = $1-4/window
 */

import { getWindowOpenPrice, getBtcDelta } from "../prices/binance-ws";

// Pattern detection thresholds (in $)
const SPIKE_THRESHOLD = 30;      // $ move in 5 sec to consider a "spike"
const MOMENTUM_THRESHOLD = 20;   // $ move in 30 sec for "momentum" (steady grind)
const EXHAUSTION_RATIO = 0.25;   // If 5s velocity is <25% of 30s velocity, exhausted

/**
 * Detect BTC price action pattern and predict next move.
 * Returns: 1 = expect UP, -1 = expect DOWN, 0 = no clear signal
 */
export function detectBtcPattern(
  btcDelta5s: number,
  btcDelta30s: number,
): { signal: number; pattern: string; confidence: number } {
  const abs5s = Math.abs(btcDelta5s);
  const abs30s = Math.abs(btcDelta30s);
  const dir5s = btcDelta5s > 0 ? 1 : btcDelta5s < 0 ? -1 : 0;
  const dir30s = btcDelta30s > 0 ? 1 : btcDelta30s < 0 ? -1 : 0;
  
  // Velocity ($/sec)
  const vel5s = btcDelta5s / 5;
  const vel30s = btcDelta30s / 30;

  // Pattern 1: SPIKE MEAN REVERSION
  // Sharp move in last 5s -> expect bounce in opposite direction
  if (abs5s >= SPIKE_THRESHOLD) {
    return {
      signal: -dir5s, // Opposite of spike direction
      pattern: `SPIKE_REVERT: ${btcDelta5s > 0 ? "+" : ""}$${btcDelta5s.toFixed(0)} in 5s`,
      confidence: Math.min(0.9, abs5s / 60), // Higher spike = higher confidence, cap at 0.9
    };
  }

  // Pattern 2: MOMENTUM CONTINUATION
  // Steady move over 30s, 5s moving same direction = continuation likely
  if (abs30s >= MOMENTUM_THRESHOLD && dir5s === dir30s && abs5s >= 5) {
    return {
      signal: dir30s, // Same as momentum direction
      pattern: `MOMENTUM: ${btcDelta30s > 0 ? "+" : ""}$${btcDelta30s.toFixed(0)} over 30s`,
      confidence: Math.min(0.8, abs30s / 50),
    };
  }

  // Pattern 3: EXHAUSTION REVERSAL
  // Had momentum but 5s velocity is much weaker or opposite -> reversal
  if (abs30s >= MOMENTUM_THRESHOLD) {
    const velocityRatio = Math.abs(vel5s) / Math.abs(vel30s);
    if (velocityRatio < EXHAUSTION_RATIO || dir5s === -dir30s) {
      return {
        signal: -dir30s, // Opposite of prior momentum
        pattern: `EXHAUSTION: momentum fading`,
        confidence: 0.6,
      };
    }
  }

  // No clear pattern
  return { signal: 0, pattern: "NO_PATTERN", confidence: 0 };
}

/**
 * Compute "fair value" based on BTC pattern detection.
 * If we expect BTC to go UP -> YES should be worth more.
 * If we expect BTC to go DOWN -> NO should be worth more.
 *
 * The shift is based on pattern confidence, capped at 5 cents.
 */
export function computeFairValue(
  yesPrice: number,
  noPrice: number,
  btcDelta: number,      // 30s delta (passed from engine)
  btcPrice: number,
  trendDirection: number,
  trendStrength: number,
  secondsRemaining: number,
): { up: number; down: number } {
  // Get fresh 5s delta for pattern detection
  const btcDelta5s = getBtcDelta(5000);
  const btcDelta30s = btcDelta;

  const { signal, confidence } = detectBtcPattern(btcDelta5s, btcDelta30s);

  if (signal === 0 || confidence < 0.4) {
    // No clear pattern -> fair = current market (no trade)
    return { up: yesPrice, down: noPrice };
  }

  // Calculate fair value shift based on signal and confidence
  // Max shift of 5 cents at full confidence
  const maxShift = 0.05;
  const shift = maxShift * confidence;

  // Time factor: with less time, patterns have less room to play out
  // Full effect with 5+ min left, reduced effect closer to end
  const timeFactor = Math.min(1, secondsRemaining / 300);
  const adjustedShift = shift * Math.max(0.3, timeFactor);

  if (signal > 0) {
    // Expect BTC UP -> YES worth more
    return {
      up: Math.min(0.99, yesPrice + adjustedShift),
      down: Math.max(0.01, noPrice - adjustedShift),
    };
  } else {
    // Expect BTC DOWN -> NO worth more
    return {
      up: Math.max(0.01, yesPrice - adjustedShift),
      down: Math.min(0.99, noPrice + adjustedShift),
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

  // Guard 2: Post-trade cooldown -- 8s after any trade
  const now = Date.now();
  if (lastTradeTime > 0 && now - lastTradeTime < 8_000) return null;

  // Detect BTC pattern
  const pattern = detectBtcPattern(btcDelta5s, btcDelta30s);
  
  // Guard 3: Need a clear pattern with decent confidence
  if (pattern.signal === 0 || pattern.confidence < 0.5) return null;

  // Compute fair value based on pattern
  const fair = computeFairValue(
    yesPrice, noPrice, btcDelta30s, btcPrice,
    trendDirection, trendStrength, secondsRemaining
  );

  const upGap = fair.up - yesPrice;
  const downGap = fair.down - noPrice;

  // Guard 4: Need minimum gap
  const upValid = upGap >= minGap && yesPrice >= entryMin && yesPrice <= entryMax;
  const downValid = downGap >= minGap && noPrice >= entryMin && noPrice <= entryMax;

  if (!upValid && !downValid) return null;

  // Build reason string
  const vel5s = (btcDelta5s / 5).toFixed(1);
  const vel30s = (btcDelta30s / 30).toFixed(1);

  if (upValid && (!downValid || upGap >= downGap)) {
    return {
      side: "yes",
      fairValue: fair.up,
      actualPrice: yesPrice,
      gap: upGap,
      reason: `${pattern.pattern} | mkt $${yesPrice.toFixed(2)} -> fair $${fair.up.toFixed(2)} (+${(upGap * 100).toFixed(1)}c) | v5=$${vel5s}/s v30=$${vel30s}/s`,
    };
  }

  if (downValid) {
    return {
      side: "no",
      fairValue: fair.down,
      actualPrice: noPrice,
      gap: downGap,
      reason: `${pattern.pattern} | mkt $${noPrice.toFixed(2)} -> fair $${fair.down.toFixed(2)} (+${(downGap * 100).toFixed(1)}c) | v5=$${vel5s}/s v30=$${vel30s}/s`,
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
      reason: `TARGET: $${currentPrice.toFixed(2)} = +${(pnl * 100).toFixed(1)}c from $${entryPrice.toFixed(2)}`,
    };
  }

  // Exit window: sell all positions at configured time before window end
  if (secondsRemaining <= exitWindowSecs) {
    return {
      action: pnl >= 0 ? "sell_profit" : "sell_loss",
      sellPrice: currentPrice,
      reason: `EXIT_WINDOW: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c, ${secondsRemaining}s left`,
    };
  }

  return { action: "hold", reason: `HOLD: ${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}c` };
}
