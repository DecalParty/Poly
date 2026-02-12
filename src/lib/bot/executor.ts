import { placeBuyOrder, placeSellOrder } from "../polymarket/client";
import { insertTrade } from "../db/queries";
import { logger } from "../logger";
import type { MarketInfo, TradeRecord, Position, MarketAsset, SubStrategy } from "@/types";

/**
 * Calculate Polymarket taker fee.
 * Fee = shares * 0.25 * (price * (1 - price))^2
 */
export function calculateTakerFee(shares: number, price: number): number {
  const p = price * (1 - price);
  return shares * 0.25 * p * p;
}

interface ExecuteOptions {
  asset?: MarketAsset | null;
  subStrategy?: SubStrategy | null;
  expectedPrice?: number;
}
export async function executeBuy(
  market: MarketInfo,
  side: "yes" | "no",
  price: number,
  dollarAmount: number,
  paper: boolean,
  currentPosition: Position | null,
  options: ExecuteOptions = {}
): Promise<{ trade: TradeRecord | null; error?: string }> {
  const shares = dollarAmount / price;
  const tokenId = side === "yes" ? market.yesTokenId : market.noTokenId;
  const takerFee = calculateTakerFee(shares, price);
  const slippage = options.expectedPrice
    ? Math.abs(price - options.expectedPrice) / options.expectedPrice
    : 0;

  if (paper) {
    logger.info(
      `[PAPER] BUY ${shares.toFixed(4)} ${side} @ $${price.toFixed(4)} ($${dollarAmount}) | ` +
      `Asset: ${options.asset || "?"} | Strategy: ${options.subStrategy || "?"} | Fee: $${takerFee.toFixed(6)}`
    );

    const trade = insertTrade({
      timestamp: new Date().toISOString(),
      conditionId: market.conditionId,
      slug: market.slug,
      side,
      action: "buy",
      price,
      amount: dollarAmount,
      shares,
      pnl: null,
      paper: true,
      orderId: null,
      asset: options.asset || null,
      subStrategy: options.subStrategy || null,
      binancePriceAtEntry: null,
      slippage,
      takerFee,
    });

    return { trade };
  }

  // Live trading
  logger.info(`[LIVE] Placing BUY: ${shares.toFixed(4)} ${side} @ $${price.toFixed(4)}`);
  const result = await placeBuyOrder(tokenId, price, shares, market.tickSize, market.negRisk);

  if (!result.success) {
    logger.error(`Buy order failed: ${result.error}`);
    return { trade: null, error: result.error };
  }

  const trade = insertTrade({
    timestamp: new Date().toISOString(),
    conditionId: market.conditionId,
    slug: market.slug,
    side,
    action: "buy",
    price,
    amount: dollarAmount,
    shares,
    pnl: null,
    paper: false,
    orderId: result.orderId || null,
    asset: options.asset || null,
    subStrategy: options.subStrategy || null,
    binancePriceAtEntry: null,
    slippage,
    takerFee,
  });

  return { trade };
}

/**
 * Execute a sell order (stop-loss) — either paper or live.
 */
export async function executeSell(
  market: MarketInfo,
  position: Position,
  currentPrice: number,
  paper: boolean,
  options: ExecuteOptions = {}
): Promise<{ trade: TradeRecord | null; error?: string }> {
  const tokenId = position.side === "yes" ? market.yesTokenId : market.noTokenId;
  const sellAmount = position.shares * currentPrice;
  const pnl = sellAmount - position.costBasis;
  const takerFee = calculateTakerFee(position.shares, currentPrice);

  if (paper) {
    logger.info(
      `[PAPER] SELL ${position.shares.toFixed(4)} ${position.side} @ $${currentPrice.toFixed(4)} | P&L: $${pnl.toFixed(4)}`
    );

    const trade = insertTrade({
      timestamp: new Date().toISOString(),
      conditionId: market.conditionId,
      slug: market.slug,
      side: position.side,
      action: "sell",
      price: currentPrice,
      amount: sellAmount,
      shares: position.shares,
      pnl,
      paper: true,
      orderId: null,
      asset: options.asset || null,
      subStrategy: options.subStrategy || null,
      binancePriceAtEntry: null,
      slippage: null,
      takerFee,
    });

    return { trade };
  }

  // Live sell
  logger.info(`[LIVE] Placing SELL: ${position.shares.toFixed(4)} ${position.side} @ $${currentPrice.toFixed(4)}`);
  const result = await placeSellOrder(
    tokenId,
    currentPrice,
    position.shares,
    market.tickSize,
    market.negRisk
  );

  if (!result.success) {
    logger.error(`Sell order failed: ${result.error}`);
    return { trade: null, error: result.error };
  }

  const trade = insertTrade({
    timestamp: new Date().toISOString(),
    conditionId: market.conditionId,
    slug: market.slug,
    side: position.side,
    action: "sell",
    price: currentPrice,
    amount: sellAmount,
    shares: position.shares,
    pnl,
    paper: false,
    orderId: result.orderId || null,
    asset: options.asset || null,
    subStrategy: options.subStrategy || null,
    binancePriceAtEntry: null,
    slippage: null,
    takerFee,
  });

  return { trade };
}

/**
* Record a market resolution payout.
* resolvedSide is the side that actually won ("yes" = UP won, "no" = DOWN won).
*/
export function recordResolution(
  market: MarketInfo,
  position: Position,
  resolvedSide: "yes" | "no",
  paper: boolean,
  options: ExecuteOptions = {}
): TradeRecord {
  const won = position.side === resolvedSide;
  const payout = won ? position.shares : 0;
  const pnl = payout - position.costBasis;

  logger.info(
    `[${paper ? "PAPER" : "LIVE"}] RESOLUTION: ${won ? "WON" : "LOST"} | ` +
      `${position.shares.toFixed(4)} shares | Payout: $${payout.toFixed(4)} | P&L: $${pnl.toFixed(4)}`
  );

  return insertTrade({
    timestamp: new Date().toISOString(),
    conditionId: market.conditionId,
    slug: market.slug,
    side: position.side,
    action: "resolution",
    price: resolvedSide === "yes" ? 1.0 : 0.0,
    amount: payout,
    shares: position.shares,
    pnl,
    paper,
    orderId: null,
    asset: options.asset || null,
    subStrategy: options.subStrategy || null,
    binancePriceAtEntry: null,
    slippage: null,
    takerFee: null,
  });
}
