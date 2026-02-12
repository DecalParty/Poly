import type {
  BotSettings,
  ActiveMarketState,
  WindowPosition,
} from "@/types";

export interface StrategyDecision {
  action: "buy" | "sell" | "hold" | "wait";
  reason: string;
  side?: "yes" | "no";
  price?: number;
}

/**
 * High-Confidence DCA Strategy
 *
 * When the leading side's price is within the target range and there's enough
 * time remaining, buy a fixed dollar amount every N seconds. Hold if price
 * drifts outside range. Sell if price drops below stop-loss.
 */
export function evaluateStrategy(
  settings: BotSettings,
  market: ActiveMarketState,
  _intel: unknown,
  position: WindowPosition | null,
): StrategyDecision {
  const secsRemaining = market.secondsRemaining;
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;

  if (!settings.highConfEnabled) {
    return { action: "wait", reason: "High-confidence strategy disabled" };
  }

  // Determine leading side from Polymarket prices
  const leadingSide: "yes" | "no" = yesPrice >= noPrice ? "yes" : "no";
  const leadingPrice = leadingSide === "yes" ? yesPrice : noPrice;

  // ?? Existing position management ????????????????????????????????????????
  if (position && position.shares > 0) {
    // Continue DCA if price is still in range and time window is valid
    if (
      secsRemaining >= settings.highConfTimeMin &&
      secsRemaining <= settings.highConfTimeMax &&
      leadingPrice >= settings.highConfEntryMin &&
      leadingPrice <= settings.highConfEntryMax &&
      leadingSide === position.side
    ) {
      const now = Date.now();
      const intervalMs = settings.highConfBuyInterval * 1000;
      if (!position.lastBuyTime || now - position.lastBuyTime >= intervalMs) {
        return {
          action: "buy",
          reason: `DCA: ${market.asset} ${position.side.toUpperCase()} @ $${leadingPrice.toFixed(4)} � every ${settings.highConfBuyInterval}s � $${position.costBasis.toFixed(2)} deployed`,
          side: position.side,
          price: leadingPrice,
        };
      }
    }

    // Hold � price moved outside range or waiting for next interval
    return {
      action: "hold",
      reason: `Holding ${position.side.toUpperCase()} @ $${position.avgEntryPrice.toFixed(4)} � ${position.shares.toFixed(2)} shares � $${position.costBasis.toFixed(2)}`,
    };
  }

  // ?? No position � look for entry ????????????????????????????????????????
  if (secsRemaining < settings.highConfTimeMin) {
    return {
      action: "wait",
      reason: `Window closing in ${secsRemaining}s � no new entries`,
    };
  }

  if (secsRemaining > settings.highConfTimeMax) {
    return {
      action: "wait",
      reason: `${market.asset}: ${Math.floor(secsRemaining / 60)}m left � waiting for ?${Math.floor(settings.highConfTimeMax / 60)}m`,
    };
  }

  if (leadingPrice >= settings.highConfEntryMin && leadingPrice <= settings.highConfEntryMax) {
    return {
      action: "buy",
      reason: `Entry: ${market.asset} ${leadingSide.toUpperCase()} @ $${leadingPrice.toFixed(4)} (${Math.floor(secsRemaining / 60)}m left)`,
      side: leadingSide,
      price: leadingPrice,
    };
  }

  return {
    action: "wait",
    reason: `${market.asset}: $${leadingPrice.toFixed(4)} outside range $${settings.highConfEntryMin}�$${settings.highConfEntryMax}`,
  };
}
