import axios from "axios";
import { Side } from "@polymarket/clob-client";
import { getReadOnlyClient } from "./client";
import type { MarketInfo, MarketPrices } from "@/types";
import { logger } from "../logger";

const GAMMA_API = process.env.GAMMA_API_URL || "https://gamma-api.polymarket.com";

/**
 * Generate the slug for the current BTC 15-minute market.
 * Markets are aligned to 15-minute boundaries (900 seconds).
 */
export function getCurrentMarketSlug(): string {
  const now = Math.floor(Date.now() / 1000);
  const intervalStart = Math.floor(now / 900) * 900;
  return `btc-updown-15m-${intervalStart}`;
}

/**
 * Get the slug for the next upcoming market.
 */
export function getNextMarketSlug(): string {
  const now = Math.floor(Date.now() / 1000);
  const nextInterval = (Math.floor(now / 900) + 1) * 900;
  return `btc-updown-15m-${nextInterval}`;
}

/**
 * Calculate seconds remaining in the current 15-minute window.
 */
export function getSecondsRemaining(): number {
  const now = Math.floor(Date.now() / 1000);
  const intervalEnd = (Math.floor(now / 900) + 1) * 900;
  return intervalEnd - now;
}

/**
 * Fetch market data from the Gamma API by slug.
 */
export async function fetchMarketBySlug(slug: string): Promise<MarketInfo | null> {
  try {
    const resp = await axios.get(`${GAMMA_API}/markets`, {
      params: { slug },
      timeout: 10000,
    });

    const markets = resp.data;
    if (!markets || !Array.isArray(markets) || markets.length === 0) {
      logger.debug(`No market found for slug: ${slug}`);
      return null;
    }

    const m = markets[0];
    const clobTokenIds: string[] = m.clobTokenIds
      ? (typeof m.clobTokenIds === "string" ? JSON.parse(m.clobTokenIds) : m.clobTokenIds)
      : [];

    if (clobTokenIds.length < 2) {
      logger.warn(`Market ${slug} has insufficient token IDs`);
      return null;
    }

    // First token is typically Yes/Up, second is No/Down
    return {
      conditionId: m.conditionId,
      slug: m.slug || slug,
      question: m.question || `BTC 15m candle`,
      yesTokenId: clobTokenIds[0],
      noTokenId: clobTokenIds[1],
      endDate: m.endDate || m.endDateIso || "",
      endTimestamp: m.endDate ? new Date(m.endDate).getTime() / 1000 : 0,
      active: m.active !== false && !m.closed,
      tickSize: m.orderPriceMinTickSize || "0.01",
      negRisk: m.negRisk === true,
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    logger.error(`Error fetching market ${slug}: ${err}`);
    return null;
  }
}

/**
 * Fetch the current active BTC 15-minute market.
 * Tries the current interval first, then the previous one
 * (which may still be resolving).
 */
export async function fetchCurrentBtcMarket(): Promise<MarketInfo | null> {
  const currentSlug = getCurrentMarketSlug();
  let market = await fetchMarketBySlug(currentSlug);

  if (market && market.active) {
    return market;
  }

  // Also try previous interval (might still be open)
  const now = Math.floor(Date.now() / 1000);
  const prevInterval = (Math.floor(now / 900) - 1) * 900;
  const prevSlug = `btc-updown-15m-${prevInterval}`;
  market = await fetchMarketBySlug(prevSlug);

  if (market && market.active) {
    return market;
  }

  return null;
}

/**
 * Fetch current prices for a market's Yes/No tokens.
 */
export async function fetchMarketPrices(market: MarketInfo): Promise<MarketPrices | null> {
  try {
    const client = getReadOnlyClient();

    const [yesBook, noBook] = await Promise.all([
      client.getOrderBook(market.yesTokenId).catch(() => null),
      client.getOrderBook(market.noTokenId).catch(() => null),
    ]);

    // Best ask = price to buy at, or use last trade price
    let yesPrice = 0.5;
    let noPrice = 0.5;

    if (yesBook) {
      // Use best ask if available, otherwise midpoint/last trade
      if (yesBook.asks && yesBook.asks.length > 0) {
        yesPrice = parseFloat(yesBook.asks[0].price);
      } else if (yesBook.last_trade_price) {
        yesPrice = parseFloat(yesBook.last_trade_price);
      }
    }

    if (noBook) {
      if (noBook.asks && noBook.asks.length > 0) {
        noPrice = parseFloat(noBook.asks[0].price);
      } else if (noBook.last_trade_price) {
        noPrice = parseFloat(noBook.last_trade_price);
      }
    }

    // If we only got one side, infer the other (they should sum to ~1.0)
    if (yesPrice > 0 && noPrice === 0.5) {
      noPrice = Math.max(0.01, 1 - yesPrice);
    } else if (noPrice > 0 && yesPrice === 0.5) {
      yesPrice = Math.max(0.01, 1 - noPrice);
    }

    const leadingSide = yesPrice >= noPrice ? "yes" : "no";
    const leadingPrice = leadingSide === "yes" ? yesPrice : noPrice;

    return {
      yesPrice,
      noPrice,
      leadingSide,
      leadingPrice,
      timestamp: Date.now(),
    };
  } catch (err) {
    logger.error(`Error fetching prices: ${err}`);
    return null;
  }
}

/**
 * Fetch the actual resolution outcome for a resolved market from the Gamma API.
 * Returns "yes" if UP/Yes won, "no" if DOWN/No won, or null if not yet resolved.
 */
export async function fetchMarketResolution(slug: string): Promise<"yes" | "no" | null> {
  try {
    const resp = await axios.get(`${GAMMA_API}/markets`, {
      params: { slug },
      timeout: 10000,
    });

    const markets = resp.data;
    if (!markets || !Array.isArray(markets) || markets.length === 0) {
      logger.debug(`[Resolution] No market found for slug: ${slug}`);
      return null;
    }

    const m = markets[0];

    // Market must be closed/resolved
    if (m.active === true && !m.closed) {
      logger.debug(`[Resolution] ${slug} still active (active=${m.active}, closed=${m.closed})`);
      return null;
    }

    // Try outcomePrices - e.g. "[\"0\", \"1\"]" or "0,1" or [1, 0]
    if (m.outcomePrices) {
      let prices: number[];
      if (typeof m.outcomePrices === "string") {
        try {
          const parsed = JSON.parse(m.outcomePrices);
          prices = Array.isArray(parsed) ? parsed.map(Number) : m.outcomePrices.split(",").map(Number);
        } catch {
          prices = m.outcomePrices.split(",").map(Number);
        }
      } else if (Array.isArray(m.outcomePrices)) {
        prices = m.outcomePrices.map(Number);
      } else {
        logger.debug(`[Resolution] ${slug} unexpected outcomePrices type: ${typeof m.outcomePrices}`);
        return null;
      }

      if (prices.length >= 2 && !prices.some(isNaN)) {
        // First element = YES/UP token price, second = NO/DOWN token price
        if (prices[0] > prices[1]) {
          logger.info(`[Resolution] ${slug} resolved YES/UP (prices: ${prices})`);
          return "yes";
        }
        if (prices[1] > prices[0]) {
          logger.info(`[Resolution] ${slug} resolved NO/DOWN (prices: ${prices})`);
          return "no";
        }
      }
      logger.debug(`[Resolution] ${slug} outcomePrices inconclusive: ${JSON.stringify(prices)}`);
    } else {
      logger.debug(`[Resolution] ${slug} closed but no outcomePrices (active=${m.active}, closed=${m.closed})`);
    }

    return null;
  } catch (err) {
    logger.error(`[Resolution] Failed to fetch ${slug}: ${err}`);
    return null;
  }
}

/**
 * Fetch the CLOB midpoint prices for a market's tokens.
 * After resolution, the winning token = $1.00, losing token = $0.00.
 * Returns "yes" if YES token > 0.9, "no" if NO token > 0.9, null otherwise.
 */
export async function fetchClobResolution(market: MarketInfo): Promise<"yes" | "no" | null> {
  try {
    const client = getReadOnlyClient();
    const midpoints = await client.getMidpoints([
      { token_id: market.yesTokenId, side: Side.BUY },
      { token_id: market.noTokenId, side: Side.BUY },
    ]);

    const yesPrice = parseFloat(midpoints?.[market.yesTokenId] || "0");
    const noPrice = parseFloat(midpoints?.[market.noTokenId] || "0");

    logger.debug(`[Resolution CLOB] ${market.slug} YES=${yesPrice} NO=${noPrice}`);

    if (yesPrice > 0.9) return "yes";
    if (noPrice > 0.9) return "no";
    return null;
  } catch (err) {
    logger.debug(`[Resolution CLOB] Failed for ${market.slug}: ${err}`);
    return null;
  }
}

/**
 * Fetch prices using the CLOB midpoint endpoint (faster, less data).
 */
export async function fetchMidpointPrices(market: MarketInfo): Promise<MarketPrices | null> {
  try {
    const client = getReadOnlyClient();
    const midpoints = await client.getMidpoints([
      { token_id: market.yesTokenId, side: Side.BUY },
      { token_id: market.noTokenId, side: Side.BUY },
    ]);

    // Midpoints returns { token_id: price } mapping
    const yesPrice = parseFloat(midpoints?.[market.yesTokenId] || "0.5");
    const noPrice = parseFloat(midpoints?.[market.noTokenId] || "0.5");

    const leadingSide = yesPrice >= noPrice ? "yes" : "no";
    const leadingPrice = leadingSide === "yes" ? yesPrice : noPrice;

    return {
      yesPrice,
      noPrice,
      leadingSide,
      leadingPrice,
      timestamp: Date.now(),
    };
  } catch {
    // Fall back to order book method
    return fetchMarketPrices(market);
  }
}
