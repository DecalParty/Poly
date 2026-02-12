import axios, { type AxiosRequestConfig } from "axios";
import { getReadOnlyClient } from "../polymarket/client";
import { logger } from "../logger";
import type { MarketAsset, ActiveMarketState, MarketInfo, WindowOutcome } from "@/types";
import { Side } from "@polymarket/clob-client";

const GAMMA_API = process.env.GAMMA_API_URL || "https://gamma-api.polymarket.com";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

async function axiosWithRetry<T>(config: AxiosRequestConfig, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await axios({ ...config, headers: { ...BROWSER_HEADERS, ...config.headers } });
      return resp.data as T;
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) throw err;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      // Don't retry 4xx client errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      logger.warn(`[Scanner] Request to ${config.url} failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

const ASSET_SLUGS: Record<MarketAsset, string> = {
  BTC: "btc",
  ETH: "eth",
  SOL: "sol",
  XRP: "xrp",
};

const activeMarkets: Map<string, ActiveMarketState> = new Map();
let scanInterval: ReturnType<typeof setInterval> | null = null;

// Window outcome history cache
const outcomeCache: Map<string, WindowOutcome> = new Map();
let lastOutcomeFetch = 0;
const OUTCOME_FETCH_INTERVAL = 5000;

// Track which assets we last fetched outcomes for
let lastOutcomeAssets: MarketAsset[] = [];

function getWindowTimestamps(): { current: number; prev: number } {
  const now = Math.floor(Date.now() / 1000);
  const current = Math.floor(now / 900) * 900;
  return { current, prev: current - 900 };
}

function getSecondsRemainingForWindow(windowStart: number): number {
  const windowEnd = windowStart + 900;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, windowEnd - now);
}

async function fetchMarketForAsset(asset: MarketAsset, ts: number): Promise<MarketInfo | null> {
const slug = `${ASSET_SLUGS[asset]}-updown-15m-${ts}`;
try {
  const markets = await axiosWithRetry<any[]>({
    method: "get",
    url: `${GAMMA_API}/markets`,
    params: { slug },
    timeout: 10000,
  });
    if (!markets || !Array.isArray(markets) || markets.length === 0) return null;

    const m = markets[0];
    const clobTokenIds: string[] = m.clobTokenIds
      ? (typeof m.clobTokenIds === "string" ? JSON.parse(m.clobTokenIds) : m.clobTokenIds)
      : [];
    if (clobTokenIds.length < 2) return null;

    return {
      conditionId: m.conditionId,
      slug: m.slug || slug,
      question: m.question || `${asset} 15m candle`,
      yesTokenId: clobTokenIds[0],
      noTokenId: clobTokenIds[1],
      endDate: m.endDate || m.endDateIso || "",
      endTimestamp: m.endDate ? new Date(m.endDate).getTime() / 1000 : ts + 900,
      active: m.active !== false && !m.closed,
      tickSize: m.orderPriceMinTickSize || "0.01",
      negRisk: m.negRisk === true,
      asset,
    };
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status || "network"} - ${err.response?.statusText || err.message}`
      : String(err);
    logger.error(`[Scanner] fetchMarket(${asset}, ${ts}) failed: ${msg}`);
    return null;
  }
}

async function fetchPricesForMarket(market: MarketInfo, retries = 2): Promise<{ yesPrice: number; noPrice: number } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = getReadOnlyClient();
      const midpoints = await client.getMidpoints([
        { token_id: market.yesTokenId, side: Side.BUY },
        { token_id: market.noTokenId, side: Side.BUY },
      ]);

      const yesPrice = parseFloat(midpoints?.[market.yesTokenId] || "0.5");
      const noPrice = parseFloat(midpoints?.[market.noTokenId] || "0.5");
      return { yesPrice, noPrice };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        logger.warn(`[Scanner] fetchPrices(${market.slug}) attempt ${attempt + 1} failed: ${msg}, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error(`[Scanner] fetchPrices(${market.slug}) failed after ${retries + 1} attempts: ${msg}`);
      }
    }
  }
  return null;
}

async function scanMarkets(enabledAssets: MarketAsset[]) {
  const { current, prev } = getWindowTimestamps();

  // Fetch all assets in parallel for speed
  await Promise.all(enabledAssets.map(async (asset) => {
    for (const ts of [current, prev]) {
      const market = await fetchMarketForAsset(asset, ts);
      if (!market || !market.active) continue;

      const prices = await fetchPricesForMarket(market);
      const secsRemaining = getSecondsRemainingForWindow(ts);

      if (prices && secsRemaining > 0) {
        const state: ActiveMarketState = {
          asset,
          conditionId: market.conditionId,
          slug: market.slug,
          yesTokenId: market.yesTokenId,
          noTokenId: market.noTokenId,
          yesPrice: prices.yesPrice,
          noPrice: prices.noPrice,
          combinedCost: prices.yesPrice + prices.noPrice,
          secondsRemaining: secsRemaining,
          market,
          tickSize: market.tickSize,
          negRisk: market.negRisk,
        };
        activeMarkets.set(asset, state);
        break;
      }
    }
  }));

  // Periodically fetch recent window outcomes
  const now = Date.now();
  const assetsChanged = JSON.stringify(enabledAssets) !== JSON.stringify(lastOutcomeAssets);
  if (now - lastOutcomeFetch > OUTCOME_FETCH_INTERVAL || assetsChanged) {
    lastOutcomeFetch = now;
    lastOutcomeAssets = [...enabledAssets];
    fetchRecentOutcomes(enabledAssets).catch(() => {});
  }
}

async function fetchRecentOutcomes(assets: MarketAsset[]) {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / 900) * 900;

  const promises: Promise<void>[] = [];

  for (const asset of assets) {
    const assetSlug = ASSET_SLUGS[asset];
    for (let i = 1; i <= 10; i++) {
      const ts = currentWindow - i * 900;
      const slug = `${assetSlug}-updown-15m-${ts}`;

      // Skip if already resolved in cache
      const cached = outcomeCache.get(slug);
      if (cached && cached.result !== "pending") continue;

      promises.push(
        (async () => {
          try {
            const result = await resolveWindowOutcome(slug);
            const endDate = new Date((ts + 900) * 1000);
            outcomeCache.set(slug, {
              slug,
              timestamp: ts,
              result,
              endTime: endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            });
          } catch {
            // Will retry next interval
          }
        })()
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Resolve a window outcome using all available methods (same as the trading engine):
 * 1. Gamma API outcomePrices (official resolution)
 * 2. CLOB midpoint prices (winning token trades at ~$1)
 */
async function resolveWindowOutcome(slug: string): Promise<"up" | "down" | "pending"> {
try {
  const markets = await axiosWithRetry<any[]>({
    method: "get",
    url: `${GAMMA_API}/markets`,
    params: { slug },
    timeout: 10000,
  }, 2);
    if (!markets?.[0]) return "pending";

    const m = markets[0];

    // Still active - genuinely pending
    if (m.active === true && !m.closed) return "pending";

    // Method 1: Check outcomePrices from Gamma (official resolution)
    if (m.outcomePrices) {
      try {
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
          prices = [];
        }

        if (prices.length >= 2 && !prices.some(isNaN)) {
          if (prices[0] > prices[1]) return "up";
          if (prices[1] > prices[0]) return "down";
        }
      } catch { /* fall through to CLOB */ }
    }

    // Method 2: CLOB midpoint fallback - after resolution the winning token trades at ~$1
    const clobTokenIds: string[] = m.clobTokenIds
      ? (typeof m.clobTokenIds === "string" ? JSON.parse(m.clobTokenIds) : m.clobTokenIds)
      : [];

    if (clobTokenIds.length >= 2) {
      try {
        const client = getReadOnlyClient();
        const midpoints = await client.getMidpoints([
          { token_id: clobTokenIds[0], side: Side.BUY },
          { token_id: clobTokenIds[1], side: Side.BUY },
        ]);

        const yesPrice = parseFloat(midpoints?.[clobTokenIds[0]] || "0");
        const noPrice = parseFloat(midpoints?.[clobTokenIds[1]] || "0");

        if (yesPrice > 0.9) return "up";
        if (noPrice > 0.9) return "down";
      } catch { /* CLOB unavailable, stay pending */ }
    }

    return "pending";
  } catch {
    return "pending";
  }
}

export function getRecentOutcomes(assets?: MarketAsset[]): WindowOutcome[] {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / 900) * 900;
  const results: WindowOutcome[] = [];
  const assetSlugs = assets && assets.length > 0
    ? assets.map((a) => ASSET_SLUGS[a])
    : Object.values(ASSET_SLUGS);

  for (let i = 1; i <= 10; i++) {
    const ts = currentWindow - i * 900;
    for (const assetSlug of assetSlugs) {
      const slug = `${assetSlug}-updown-15m-${ts}`;
      const cached = outcomeCache.get(slug);
      if (cached) {
        results.push(cached);
        break;
      }
    }
  }

  return results;
}

export function startMarketScanner(enabledAssets: MarketAsset[]) {
  // Initial scan
  scanMarkets(enabledAssets).catch((err) => {
    logger.error(`[Scanner] Initial scan failed: ${err}`);
  });

  // Poll every 5 seconds for fresh prices (lower CPU/network usage on VPS)
  scanInterval = setInterval(() => {
    scanMarkets(enabledAssets).catch((err) => {
      logger.error(`[Scanner] Scan failed: ${err}`);
    });
  }, 5000);

  logger.info(`[Scanner] Started for assets: ${enabledAssets.join(", ")}`);
}

export function stopMarketScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  activeMarkets.clear();
  logger.info("[Scanner] Stopped");
}

export function markOutcomeResolved(slug: string, result: "up" | "down") {
  const cached = outcomeCache.get(slug);
  if (cached) {
    cached.result = result;
  } else {
    const ts = parseInt(slug.split("-").pop() || "0", 10);
    const endDate = new Date((ts + 900) * 1000);
    outcomeCache.set(slug, {
      slug,
      timestamp: ts,
      result,
      endTime: endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    });
  }
}

export function getActiveMarkets(): ActiveMarketState[] {
  // Recalculate secondsRemaining dynamically instead of returning stale cached value
  const now = Math.floor(Date.now() / 1000);
  return Array.from(activeMarkets.values()).map((m) => {
    const windowTs = parseInt(m.slug.split("-").pop() || "0", 10);
    const windowEnd = windowTs + 900;
    return {
      ...m,
      secondsRemaining: Math.max(0, windowEnd - now),
    };
  });
}

export function getActiveMarketForAsset(asset: MarketAsset): ActiveMarketState | null {
  return activeMarkets.get(asset) || null;
}

export function updateMarketPrices(asset: MarketAsset, yesPrice: number, noPrice: number) {
  const market = activeMarkets.get(asset);
  if (market) {
    market.yesPrice = yesPrice;
    market.noPrice = noPrice;
    market.combinedCost = yesPrice + noPrice;
  }
}

