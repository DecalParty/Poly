import { ClobClient, ApiKeyCreds, Side, OrderType, type TickSize } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import axios from "axios";
import https from "https";
import { logger } from "../logger";

// Chrome-like TLS ciphers to avoid datacenter TLS fingerprint detection
const CHROME_CIPHERS = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
  "ECDHE-ECDSA-CHACHA20-POLY1305",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES128-SHA",
  "ECDHE-RSA-AES256-SHA",
  "AES128-GCM-SHA256",
  "AES256-GCM-SHA384",
  "AES128-SHA",
  "AES256-SHA",
].join(":");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Custom HTTPS agent with Chrome-like TLS fingerprint.
// Attached to every axios request so Cloudflare doesn't flag the TLS handshake.
const tlsAgent = new https.Agent({
  ciphers: CHROME_CIPHERS,
  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.3",
  keepAlive: true,
});

// Axios request interceptor: runs AFTER @polymarket/clob-client sets its headers
// in overloadHeaders(), so we forcibly replace them with browser-like values.
// This is the 100% fix — axios.defaults alone does NOT work because the CLOB
// client explicitly overwrites headers on every request.
axios.interceptors.request.use((config) => {
  config.headers["User-Agent"] = BROWSER_UA;
  config.headers["Accept"] = "application/json, text/plain, */*";
  config.headers["Accept-Language"] = "en-US,en;q=0.9";
  config.headers["Connection"] = "keep-alive";
  config.httpAgent = config.httpAgent || tlsAgent;
  config.httpsAgent = config.httpsAgent || tlsAgent;
  config.timeout = config.timeout || 5000;
  return config;
});

// Singleton CLOB client instance
let clobClient: ClobClient | null = null;
let apiCreds: ApiKeyCreds | null = null;

const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";

/**
 * Initialize or return the existing CLOB client.
 * Requires PRIVATE_KEY and FUNDER_ADDRESS env vars for live trading.
 * Returns null if credentials are missing (paper trading only).
 */
export async function getClobClient(): Promise<ClobClient | null> {
  if (clobClient) return clobClient;

  const privateKey = process.env.PRIVATE_KEY;
  const funderAddress = process.env.FUNDER_ADDRESS;
  const host = process.env.CLOB_API_URL || "https://clob.polymarket.com";
  const chainId = parseInt(process.env.CHAIN_ID || "137");
  const sigType = parseInt(process.env.SIGNATURE_TYPE || "0");

  if (!privateKey || !funderAddress) {
    logger.warn("No PRIVATE_KEY or FUNDER_ADDRESS set — live trading unavailable");
    return null;
  }

  try {
    const provider = new StaticJsonRpcProvider(POLYGON_RPC, 137);
    const signer = new Wallet(privateKey, provider);

    // Use pre-configured API keys if available (needed for VPS deployments)
    const preKey = process.env.CLOB_API_KEY;
    const preSecret = process.env.CLOB_SECRET;
    const prePassphrase = process.env.CLOB_PASSPHRASE;

    if (preKey && preSecret && prePassphrase) {
      apiCreds = { key: preKey, secret: preSecret, passphrase: prePassphrase };
      logger.info("Using pre-configured CLOB API keys from .env");
    } else {
      // Create a temporary client to derive API keys
      const tempClient = new ClobClient(host, chainId, signer, undefined, sigType, funderAddress);
      apiCreds = await tempClient.createOrDeriveApiKey();
      logger.info("API keys derived from Polymarket");
    }

    // Create the fully authenticated client
    clobClient = new ClobClient(host, chainId, signer, apiCreds, sigType, funderAddress);

    logger.info("CLOB client initialized successfully");
    return clobClient;
  } catch (err) {
    logger.error(`Failed to initialize CLOB client: ${err}`);
    return null;
  }
}

/**
 * Get an unauthenticated client for read-only operations (market data, prices).
 * This doesn't require any credentials.
 */
export function getReadOnlyClient(): ClobClient {
  const host = process.env.CLOB_API_URL || "https://clob.polymarket.com";
  const chainId = parseInt(process.env.CHAIN_ID || "137");
  return new ClobClient(host, chainId);
}

/**
 * Place a FOK (Fill or Kill) buy order on Polymarket.
 * Fills instantly at best available price or is rejected entirely.
 * Used by the high-confidence strategy for guaranteed execution.
 */
export async function placeBuyOrder(
  tokenId: string,
  price: number,
  dollarAmount: number,
  tickSize: string,
  negRisk: boolean
): Promise<{ success: boolean; orderId?: string; error?: string; filledSize?: number; filledPrice?: number }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    logger.info(`[FOK] Placing BUY: $${dollarAmount} on token=${tokenId.slice(0, 10)}...`);
    const result = await client.createAndPostMarketOrder({
      tokenID: tokenId,
      amount: dollarAmount,
      side: Side.BUY,
      feeRateBps: undefined,
      nonce: undefined,
    }, { tickSize: tickSize as TickSize, negRisk }, OrderType.FOK);

    logger.info(`[FOK] BUY response: ${JSON.stringify(result)}`);

    const orderId = result?.orderID || result?.orderIds?.[0];
    if (!orderId || orderId === "unknown") {
      logger.error(`Buy FOK returned no orderId — order not accepted`);
      return { success: false, error: "No orderId returned from Polymarket" };
    }

    // FOK fills instantly — check direct response first, then getTrades, then getOrder
    const fill = await verifyFokFill(client, orderId, tokenId, "BUY");

    if (!fill.filled) {
      logger.warn(`Buy FOK ${orderId} — no fill confirmed (${fill.method}): ${fill.status}`);
      return { success: false, error: `Order not filled (${fill.status})`, orderId };
    }

    logger.info(
      `Buy FOK FILLED: ${fill.sizeFilled.toFixed(4)} shares @ $${fill.avgPrice.toFixed(4)} | ` +
      `verified via ${fill.method} | token=${tokenId.slice(0, 10)}...`
    );
    return {
      success: true,
      orderId,
      filledSize: fill.sizeFilled,
      filledPrice: fill.avgPrice || price,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Buy FOK failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a FOK (Fill or Kill) sell order on Polymarket.
 * Fills instantly at best available price or is rejected entirely.
 * Used by the high-confidence strategy for guaranteed execution.
 */
export async function placeSellOrder(
  tokenId: string,
  price: number,
  shares: number,
  tickSize: string,
  negRisk: boolean
): Promise<{ success: boolean; orderId?: string; error?: string; filledSize?: number; filledPrice?: number }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    logger.info(`[FOK] Placing SELL: ${shares.toFixed(4)} shares on token=${tokenId.slice(0, 10)}...`);
    const result = await client.createAndPostMarketOrder({
      tokenID: tokenId,
      amount: shares,
      side: Side.SELL,
      feeRateBps: undefined,
      nonce: undefined,
    }, { tickSize: tickSize as TickSize, negRisk }, OrderType.FOK);

    logger.info(`[FOK] SELL response: ${JSON.stringify(result)}`);

    const orderId = result?.orderID || result?.orderIds?.[0];
    if (!orderId || orderId === "unknown") {
      logger.error(`Sell FOK returned no orderId — order not accepted`);
      return { success: false, error: "No orderId returned from Polymarket" };
    }

    // FOK fills instantly — check direct response first, then getTrades, then getOrder
    const fill = await verifyFokFill(client, orderId, tokenId, "SELL");

    if (!fill.filled) {
      logger.warn(`Sell FOK ${orderId} — no fill confirmed (${fill.method}): ${fill.status}`);
      return { success: false, error: `Order not filled (${fill.status})`, orderId };
    }

    logger.info(
      `Sell FOK FILLED: ${fill.sizeFilled.toFixed(4)} shares @ $${fill.avgPrice.toFixed(4)} | ` +
      `verified via ${fill.method} | token=${tokenId.slice(0, 10)}...`
    );
    return {
      success: true,
      orderId,
      filledSize: fill.sizeFilled,
      filledPrice: fill.avgPrice || price,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Sell FOK failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a limit buy order with GTC + postOnly (maker only, zero fees).
 * Used by the arbitrage strategy — order sits on the book waiting for takers.
 * If the order would immediately fill (cross the spread), it is REJECTED.
 * Returns orderId for later fill checking — does NOT wait for fills since these
 * are passive limit orders that may take time to fill.
 */
export async function placeLimitBuyOrder(
  tokenId: string,
  price: number,
  size: number,
  tickSize: string,
  negRisk: boolean
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    const result = await client.createAndPostOrder({
      tokenID: tokenId,
      price,
      side: Side.BUY,
      size,
      feeRateBps: undefined,
      nonce: undefined,
      expiration: undefined,
    }, { tickSize: tickSize as TickSize, negRisk }, OrderType.GTC, false, true);

    logger.info(`[ARB] Limit buy placed: ${size.toFixed(2)} shares @ $${price} | token=${tokenId}`);
    return {
      success: true,
      orderId: result?.orderID || result?.orderIds?.[0] || "unknown",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ARB] Limit buy failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Cancel an open order by ID.
 */
export async function cancelOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    await client.cancelOrder({ orderID: orderId });
    logger.info(`[ARB] Order cancelled: ${orderId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ARB] Cancel failed for ${orderId}: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Cancel multiple orders at once.
 */
export async function cancelOrders(
  orderIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    await client.cancelOrders(orderIds);
    logger.info(`[ARB] Cancelled ${orderIds.length} orders`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ARB] Batch cancel failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Get the order book for a token. Used by arb strategy to verify limit price placement.
 */
export async function getOrderBook(
  tokenId: string
): Promise<{ bids: { price: string; size: string }[]; asks: { price: string; size: string }[] } | null> {
  try {
    const client = getReadOnlyClient();
    const book = await client.getOrderBook(tokenId);
    return book as any;
  } catch (err) {
    logger.error(`[ARB] Failed to fetch order book: ${err}`);
    return null;
  }
}

/**
 * Check the status of an order. Returns fill information.
 * Used to verify whether an order was actually filled after placement.
 */
export async function getOrderStatus(
  orderId: string
): Promise<{ filled: boolean; sizeFilled: number; sizeMatched: number; status: string; price: number } | null> {
  const client = await getClobClient();
  if (!client) return null;

  try {
    const order = await client.getOrder(orderId);
    if (!order) return null;

    const sizeFilled = parseFloat(order.size_matched || "0");
    const originalSize = parseFloat(order.original_size || "0");
    const price = parseFloat(order.price || "0");
    const status = order.status || "unknown";

    return {
      filled: sizeFilled > 0,
      sizeFilled,
      sizeMatched: sizeFilled,
      status,
      price,
    };
  } catch (err) {
    logger.error(`Failed to get order status for ${orderId}: ${err}`);
    return null;
  }
}

/**
 * Poll order status until it settles (filled, cancelled, or timeout).
 * Returns actual fill data. Polymarket market orders typically fill immediately,
 * but we verify to prevent phantom trades.
 */
export async function waitForOrderFill(
  orderId: string,
  maxWaitMs: number = 5000,
  pollIntervalMs: number = 500
): Promise<{ filled: boolean; sizeFilled: number; avgPrice: number; status: string }> {
  const start = Date.now();
  let lastStatus: { filled: boolean; sizeFilled: number; sizeMatched: number; status: string; price: number } | null = null;

  while (Date.now() - start < maxWaitMs) {
    lastStatus = await getOrderStatus(orderId);
    if (!lastStatus) {
      // API error, wait and retry
      await new Promise(r => setTimeout(r, pollIntervalMs));
      continue;
    }

    // Terminal states: MATCHED (fully filled), CANCELLED, EXPIRED
    const s = lastStatus.status.toUpperCase();
    if (s === "MATCHED" || s === "CLOSED" || s === "FILLED") {
      return {
        filled: lastStatus.sizeFilled > 0,
        sizeFilled: lastStatus.sizeFilled,
        avgPrice: lastStatus.price,
        status: lastStatus.status,
      };
    }
    if (s === "CANCELLED" || s === "EXPIRED" || s === "REJECTED") {
      return {
        filled: false,
        sizeFilled: 0,
        avgPrice: 0,
        status: lastStatus.status,
      };
    }

    // Still LIVE/OPEN — partially filled is still possible
    if (lastStatus.sizeFilled > 0) {
      // Has partial fill, keep polling in case more fills come
    }

    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  // Timeout — return whatever we have
  return {
    filled: lastStatus ? lastStatus.sizeFilled > 0 : false,
    sizeFilled: lastStatus?.sizeFilled || 0,
    avgPrice: lastStatus?.price || 0,
    status: lastStatus?.status || "timeout",
  };
}

/**
 * Verify a FOK order fill using multiple methods.
 * FOK orders fill instantly and may no longer appear as "open" orders,
 * so getOrder() can fail. We try multiple approaches:
 * 1. getTrades() — find matching fills by taker_order_id or asset
 * 2. getOrder() — works if the API still tracks completed orders
 */
async function verifyFokFill(
  client: ClobClient,
  orderId: string,
  tokenId: string,
  side: string,
): Promise<{ filled: boolean; sizeFilled: number; avgPrice: number; status: string; method: string }> {
  // Small delay to let the API settle after instant fill
  await new Promise(r => setTimeout(r, 300));

  // Method 1: Try getTrades to find fills for this asset
  try {
    const trades = await client.getTrades({ asset_id: tokenId }, true);
    if (trades && trades.length > 0) {
      // Look for a trade matching our order ID
      const matchingTrade = trades.find(
        (t: any) => t.taker_order_id === orderId || t.order_id === orderId
      );
      if (matchingTrade) {
        const size = parseFloat(matchingTrade.size || "0");
        const price = parseFloat(matchingTrade.price || "0");
        if (size > 0) {
          return {
            filled: true,
            sizeFilled: size,
            avgPrice: price,
            status: "MATCHED",
            method: "getTrades",
          };
        }
      }

      // If no exact match but recent trades exist for this token,
      // check the most recent one (FOK fills are the latest)
      const recent = trades[0];
      const tradeTime = recent.match_time
        ? new Date(recent.match_time).getTime()
        : 0;
      const now = Date.now();
      // If the most recent trade is within 5 seconds, it's likely ours
      if (now - tradeTime < 5000) {
        const size = parseFloat(recent.size || "0");
        const price = parseFloat(recent.price || "0");
        if (size > 0 && recent.trader_side === "TAKER") {
          logger.info(`[FOK] Matched recent taker trade: ${size} shares @ $${price} (${now - tradeTime}ms ago)`);
          return {
            filled: true,
            sizeFilled: size,
            avgPrice: price,
            status: "MATCHED",
            method: "getTrades-recent",
          };
        }
      }
    }
  } catch (err) {
    logger.warn(`[FOK] getTrades lookup failed: ${err}`);
  }

  // Method 2: Try getOrder (works for GTC, may work for FOK on some endpoints)
  try {
    const order = await client.getOrder(orderId);
    if (order) {
      const sizeFilled = parseFloat(order.size_matched || "0");
      const price = parseFloat(order.price || "0");
      const status = (order.status || "").toUpperCase();
      logger.info(`[FOK] getOrder result: status=${status} matched=${sizeFilled} price=${price}`);

      if (sizeFilled > 0) {
        return {
          filled: true,
          sizeFilled,
          avgPrice: price,
          status: order.status,
          method: "getOrder",
        };
      }
      if (status === "MATCHED" || status === "CLOSED" || status === "FILLED") {
        // Status says matched but size_matched is 0? Trust the status
        return {
          filled: true,
          sizeFilled: sizeFilled || 0,
          avgPrice: price,
          status: order.status,
          method: "getOrder-status",
        };
      }
      return {
        filled: false,
        sizeFilled: 0,
        avgPrice: 0,
        status: order.status || "unknown",
        method: "getOrder",
      };
    }
  } catch (err) {
    logger.warn(`[FOK] getOrder lookup failed for ${orderId}: ${err}`);
  }

  return {
    filled: false,
    sizeFilled: 0,
    avgPrice: 0,
    status: "unverifiable",
    method: "none",
  };
}

// Re-export useful types
export { Side, OrderType };

// ---- Polymarket contract addresses (Polygon mainnet) ----
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const COLLATERAL_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const CTF_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
];

const NEG_RISK_ABI = [
  "function redeemPositions(bytes32 conditionId, uint256[] amounts)",
];

/**
 * Redeem winning conditional tokens back to USDC after a market resolves.
 * This is the on-chain "Claim Earnings" step.
 */
export async function redeemWinnings(
  conditionId: string,
  negRisk: boolean
): Promise<{ success: boolean; error?: string }> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    return { success: false, error: "No PRIVATE_KEY" };
  }

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const signer = new Wallet(privateKey, provider);
    const { Contract } = await import("@ethersproject/contracts");

    // Both outcomes: index 1 = YES (0b01), index 2 = NO (0b10)
    const indexSets = [1, 2];

    if (negRisk) {
      // For neg-risk markets, use the NegRiskAdapter
      const adapter = new Contract(NEG_RISK_ADAPTER, NEG_RISK_ABI, signer);

      // Check if we have any tokens to redeem first
      const ctf = new Contract(CTF_ADDRESS, CTF_ABI, provider);
      // Token IDs are derived from conditionId + index
      let hasTokens = false;
      for (const idx of indexSets) {
        try {
          const tokenId = BigInt(conditionId) + BigInt(idx);
          const bal = await ctf.balanceOf(signer.address, tokenId);
          if (Number(bal) > 0) hasTokens = true;
        } catch {
          // Skip balance check, try redeem anyway
          hasTokens = true;
          break;
        }
      }

      if (!hasTokens) {
        logger.info(`[Redeem] No tokens to redeem for ${conditionId.slice(0, 10)}...`);
        return { success: true };
      }

      const tx = await adapter.redeemPositions(conditionId, indexSets);
      await tx.wait();
      logger.info(`[Redeem] Neg-risk redemption tx: ${tx.hash}`);
    } else {
      // For regular markets, call CTF contract directly
      const ctf = new Contract(CTF_ADDRESS, CTF_ABI, signer);
      const parentCollectionId = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const tx = await ctf.redeemPositions(COLLATERAL_ADDRESS, parentCollectionId, conditionId, indexSets);
      await tx.wait();
      logger.info(`[Redeem] CTF redemption tx: ${tx.hash}`);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Redeem] Failed for ${conditionId.slice(0, 10)}...: ${msg}`);
    return { success: false, error: msg };
  }
}
