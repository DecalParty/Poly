import { ClobClient, ApiKeyCreds, Side, OrderType, type TickSize } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import axios from "axios";
import { logger } from "../logger";

// Set browser-like default headers for all axios requests (used by CLOB client internally).
// This prevents VPS/datacenter IP blocking by Polymarket's API.
axios.defaults.headers.common["User-Agent"] =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
axios.defaults.headers.common["Accept"] = "application/json, text/plain, */*";
axios.defaults.headers.common["Accept-Language"] = "en-US,en;q=0.9";

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
 * Place a buy order on Polymarket.
 */
export async function placeBuyOrder(
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
    }, { tickSize: tickSize as TickSize, negRisk });

    logger.info(`Buy order placed: ${size} shares @ $${price} | token=${tokenId}`);
    return {
      success: true,
      orderId: result?.orderID || result?.orderIds?.[0] || "unknown",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Buy order failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a sell order on Polymarket.
 */
export async function placeSellOrder(
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
      side: Side.SELL,
      size,
      feeRateBps: undefined,
      nonce: undefined,
      expiration: undefined,
    }, { tickSize: tickSize as TickSize, negRisk });

    logger.info(`Sell order placed: ${size} shares @ $${price} | token=${tokenId}`);
    return {
      success: true,
      orderId: result?.orderID || result?.orderIds?.[0] || "unknown",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Sell order failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a limit buy order with GTC + postOnly (maker only, zero fees).
 * Used by the arbitrage strategy — order sits on the book waiting for takers.
 * If the order would immediately fill (cross the spread), it is REJECTED.
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

// Re-export useful types
export { Side, OrderType };
