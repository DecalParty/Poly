import { ClobClient, ApiKeyCreds, Side, OrderType, type TickSize } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { logger } from "../logger";

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

// Re-export useful types
export { Side, OrderType };
