import { ClobClient, ApiKeyCreds, Side, OrderType, type TickSize } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "@ethersproject/contracts";
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
  const sigType = parseInt(process.env.SIGNATURE_TYPE || "2");

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
 * Place a buy order on Polymarket with spread-crossing price.
 * Bumps price above midpoint to cross the spread and fill as a taker.
 * Verifies actual fill before returning success.
 */
export async function placeBuyOrder(
  tokenId: string,
  price: number,
  size: number,
  tickSize: string,
  negRisk: boolean
): Promise<{ success: boolean; orderId?: string; error?: string; filledSize?: number; filledPrice?: number }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    // Bump price up by 1 cent to cross the spread and fill as taker
    const tick = parseFloat(tickSize) || 0.01;
    const crossPrice = Math.min(0.99, Math.round((price + 0.01) / tick) * tick);

    logger.info(`[LIVE] BUY: ${size.toFixed(4)} shares @ $${crossPrice.toFixed(4)} (mid=$${price.toFixed(4)}) | token=${tokenId.slice(0, 10)}...`);
    const result = await client.createAndPostOrder({
      tokenID: tokenId,
      price: crossPrice,
      side: Side.BUY,
      size,
      feeRateBps: undefined,
      nonce: undefined,
      expiration: undefined,
    }, { tickSize: tickSize as TickSize, negRisk });

    logger.info(`[LIVE] BUY response: ${JSON.stringify(result)}`);

    const orderId = result?.orderID || result?.orderIds?.[0];
    if (!orderId || orderId === "unknown") {
      logger.error(`Buy order returned no orderId`);
      return { success: false, error: "No orderId returned from Polymarket" };
    }

    // Verify fill
    const fillResult = await waitForOrderFill(orderId, 8000, 500);

    if (!fillResult.filled || fillResult.sizeFilled <= 0) {
      // Cancel the unfilled order so it doesn't fill later as a ghost trade
      logger.warn(`Buy order ${orderId} NOT filled (status: ${fillResult.status}) — cancelling`);
      try {
        const clob = await getClobClient();
        if (clob) await clob.cancelOrder({ orderID: orderId });
        logger.info(`[LIVE] Cancelled unfilled buy order ${orderId}`);
      } catch (cancelErr) {
        logger.warn(`[LIVE] Failed to cancel unfilled buy order ${orderId}: ${cancelErr}`);
      }
      return { success: false, error: `Order not filled (status: ${fillResult.status})`, orderId };
    }

    logger.info(
      `Buy FILLED: ${fillResult.sizeFilled.toFixed(4)} shares @ $${fillResult.avgPrice.toFixed(4)} | token=${tokenId.slice(0, 10)}...`
    );
    return {
      success: true,
      orderId,
      filledSize: fillResult.sizeFilled,
      filledPrice: fillResult.avgPrice || crossPrice,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Buy order failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a sell order on Polymarket with spread-crossing price.
 * Drops price below midpoint to cross the spread and fill as a taker.
 * Verifies actual fill before returning success.
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
    // Drop price by 1 cent to cross the spread and fill as taker
    const tick = parseFloat(tickSize) || 0.01;
    const crossPrice = Math.max(0.01, Math.round((price - 0.01) / tick) * tick);

    logger.info(`[LIVE] SELL: ${shares.toFixed(4)} shares @ $${crossPrice.toFixed(4)} (mid=$${price.toFixed(4)}) | token=${tokenId.slice(0, 10)}...`);
    const result = await client.createAndPostOrder({
      tokenID: tokenId,
      price: crossPrice,
      side: Side.SELL,
      size: shares,
      feeRateBps: undefined,
      nonce: undefined,
      expiration: undefined,
    }, { tickSize: tickSize as TickSize, negRisk });

    logger.info(`[LIVE] SELL response: ${JSON.stringify(result)}`);

    const orderId = result?.orderID || result?.orderIds?.[0];
    if (!orderId || orderId === "unknown") {
      logger.error(`Sell order returned no orderId`);
      return { success: false, error: "No orderId returned from Polymarket" };
    }

    // Verify fill
    const fillResult = await waitForOrderFill(orderId, 8000, 500);

    if (!fillResult.filled || fillResult.sizeFilled <= 0) {
      // Cancel the unfilled order so it doesn't fill later as a ghost trade
      logger.warn(`Sell order ${orderId} NOT filled (status: ${fillResult.status}) — cancelling`);
      try {
        const clob = await getClobClient();
        if (clob) await clob.cancelOrder({ orderID: orderId });
        logger.info(`[LIVE] Cancelled unfilled sell order ${orderId}`);
      } catch (cancelErr) {
        logger.warn(`[LIVE] Failed to cancel unfilled sell order ${orderId}: ${cancelErr}`);
      }
      return { success: false, error: `Order not filled (status: ${fillResult.status})`, orderId };
    }

    logger.info(
      `Sell FILLED: ${fillResult.sizeFilled.toFixed(4)} shares @ $${fillResult.avgPrice.toFixed(4)} | token=${tokenId.slice(0, 10)}...`
    );
    return {
      success: true,
      orderId,
      filledSize: fillResult.sizeFilled,
      filledPrice: fillResult.avgPrice || crossPrice,
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
 * Returns orderId for later fill checking — does NOT wait for fills since these
 * are passive limit orders that may take time to fill.
 */
export async function placeLimitBuyOrder(
  tokenId: string,
  price: number,
  size: number,
  tickSize: string,
  negRisk: boolean,
  postOnly: boolean = true
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const client = await getClobClient();
  if (!client) {
    return { success: false, error: "CLOB client not initialized" };
  }

  try {
    const args: [any, any, any, boolean?, boolean?] = [
      {
        tokenID: tokenId,
        price,
        side: Side.BUY,
        size,
        feeRateBps: undefined,
        nonce: undefined,
        expiration: undefined,
      },
      { tickSize: tickSize as TickSize, negRisk },
      OrderType.GTC,
    ];
    if (postOnly) {
      args.push(false, true); // FOK=false, postOnly=true
    }
    const result = await client.createAndPostOrder(...args);

    const orderId = result?.orderID || result?.orderIds?.[0] || "unknown";
    logger.info(`[CLOB] Limit buy placed: ${size.toFixed(2)} shares @ $${price} | postOnly=${postOnly} | orderId=${orderId}`);
    return { success: true, orderId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[CLOB] Limit buy failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Place a limit sell order with GTC (maker only, zero fees).
 * Used by the scalp strategy to exit positions at a target price.
 */
export async function placeLimitSellOrder(
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
    }, { tickSize: tickSize as TickSize, negRisk }, OrderType.GTC);

    logger.info(`[SCALP] Limit sell placed: ${size.toFixed(2)} shares @ $${price} | token=${tokenId.slice(0, 10)}...`);
    return {
      success: true,
      orderId: result?.orderID || result?.orderIds?.[0] || "unknown",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[SCALP] Limit sell failed: ${msg}`);
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
  "function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) view returns (bytes32)",
  "function getPositionId(address collateralToken, bytes32 collectionId) view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) view returns (uint256)",
];

const NEG_RISK_ABI = [
  "function redeemPositions(bytes32 conditionId, uint256[] indexSets)",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function getDetermined(bytes32 questionId) view returns (bool)",
  "function payoutNumerators(bytes32 questionId, uint256 index) view returns (uint256)",
];

const GNOSIS_SAFE_ABI = [
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)",
  "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)",
  "function nonce() view returns (uint256)",
];

/**
 * Check if the proxy wallet holds conditional tokens for a given conditionId
 * using the CLOB API's balance endpoint when possible, falling back to on-chain.
 */
export async function checkProxyTokenBalance(conditionId: string): Promise<boolean> {
  const funderAddress = process.env.FUNDER_ADDRESS;
  if (!funderAddress) return false;

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const ctf = new Contract(CTF_ADDRESS, CTF_ABI, provider);
    const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

    for (const idx of [1, 2]) {
      try {
        const collectionId = await ctf.getCollectionId(ZERO_BYTES32, conditionId, idx);
        const positionId = await ctf.getPositionId(COLLATERAL_ADDRESS, collectionId);
        const bal = await ctf.balanceOf(funderAddress, positionId);
        if (Number(bal) > 0) {
          logger.info(`[Redeem] Proxy has ${bal.toString()} tokens for ${conditionId.slice(0, 10)}... (idx=${idx})`);
          return true;
        }
      } catch {
        // Skip this index
      }
    }
    return false;
  } catch (err) {
    logger.warn(`[Redeem] Balance check failed for ${conditionId.slice(0, 10)}...: ${err}`);
    return false;
  }
}

/**
 * Check if a condition has been resolved on-chain.
 * For negRisk markets: uses NegRiskAdapter.getDetermined(questionId).
 * For standard markets: uses CTF.payoutDenominator(conditionId).
 */
async function isConditionResolvedOnChain(conditionId: string, negRisk: boolean): Promise<boolean> {
  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);

    if (negRisk) {
      // For negRisk markets the conditionId from Gamma is actually a questionId
      // that the NegRiskAdapter tracks. getDetermined returns true once resolved.
      const adapter = new Contract(NEG_RISK_ADAPTER, NEG_RISK_ABI, provider);
      const determined = await adapter.getDetermined(conditionId);
      if (determined) return true;
      // Fallback: also try CTF in case the conditionId is a real CTF conditionId
      const ctf = new Contract(CTF_ADDRESS, CTF_ABI, provider);
      const denom = await ctf.payoutDenominator(conditionId);
      return Number(denom) > 0;
    }

    const ctf = new Contract(CTF_ADDRESS, CTF_ABI, provider);
    const denom = await ctf.payoutDenominator(conditionId);
    return Number(denom) > 0;
  } catch {
    return false;
  }
}

/**
 * Use CLOB API getTrades() to find positions with tokens still at the proxy wallet.
 * Checks balanceOf on BOTH CTF and NegRiskAdapter since negRisk tokens live on the adapter.
 */
export async function getClaimablePositions(): Promise<{
  conditionId: string;
  negRisk: boolean;
}[]> {
  const client = await getClobClient();
  const funderAddress = process.env.FUNDER_ADDRESS;
  if (!client || !funderAddress) {
    logger.warn(`[Redeem] No CLOB client or FUNDER_ADDRESS`);
    return [];
  }

  try {
    logger.info(`[Redeem] Fetching trades from CLOB API...`);
    const trades = await client.getTrades(undefined, false);
    if (!trades || trades.length === 0) {
      logger.info(`[Redeem] CLOB API returned 0 trades`);
      return [];
    }

    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const ctf = new Contract(CTF_ADDRESS, CTF_ABI, provider);
    const negRiskAdapter = new Contract(NEG_RISK_ADAPTER, NEG_RISK_ABI, provider);

    // Collect unique token IDs per conditionId
    const marketTokens = new Map<string, Set<string>>();
    for (const t of trades) {
      if (!t.market || !t.asset_id) continue;
      if (!marketTokens.has(t.market)) marketTokens.set(t.market, new Set());
      marketTokens.get(t.market)!.add(t.asset_id);
    }

    logger.info(`[Redeem] ${trades.length} trades across ${marketTokens.size} markets, checking balances for ${funderAddress}`);

    const claimable: { conditionId: string; negRisk: boolean }[] = [];
    const found = new Set<string>();

    for (const [conditionId, tokenIds] of marketTokens) {
      if (found.has(conditionId)) continue;
      for (const tokenId of tokenIds) {
        try {
          // Check CTF (non-negRisk tokens)
          const ctfBal = await ctf.balanceOf(funderAddress, tokenId).catch(() => 0);
          // Check NegRiskAdapter (negRisk tokens)
          const nrBal = await negRiskAdapter.balanceOf(funderAddress, tokenId).catch(() => 0);

          const ctfNum = Number(ctfBal);
          const nrNum = Number(nrBal);

          if (ctfNum > 0 || nrNum > 0) {
            const isNegRisk = nrNum > 0;
            logger.info(`[Redeem] HAS TOKENS: conditionId=${conditionId.slice(0, 10)}... token=${tokenId.slice(0, 10)}... ctf=${ctfNum} negRisk=${nrNum}`);
            found.add(conditionId);
            claimable.push({ conditionId, negRisk: isNegRisk });
            break; // found for this market, move on
          }
        } catch (err) {
          logger.debug(`[Redeem] balanceOf error for ${tokenId.slice(0, 10)}...: ${err}`);
        }
      }
    }

    logger.info(`[Redeem] Found ${claimable.length} claimable position(s)`);
    return claimable;
  } catch (err) {
    logger.error(`[Redeem] Scan failed: ${err}`);
    return [];
  }
}

/**
 * Redeem winning conditional tokens back to USDC after a market resolves.
 * Executes through the Gnosis Safe proxy wallet (FUNDER_ADDRESS) since
 * that's where the conditional tokens are held.
 *
 * Uses CTF redeemPositions for standard markets, NegRiskAdapter for negRisk markets.
 */
export async function redeemWinnings(
  conditionId: string,
  negRisk: boolean
): Promise<{ success: boolean; error?: string }> {
  const privateKey = process.env.PRIVATE_KEY;
  const funderAddress = process.env.FUNDER_ADDRESS;
  if (!privateKey || !funderAddress) {
    return { success: false, error: "No PRIVATE_KEY or FUNDER_ADDRESS" };
  }

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const signer = new Wallet(privateKey, provider);
    const { Interface } = await import("@ethersproject/abi");
    const { arrayify, hexlify } = await import("@ethersproject/bytes");

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const indexSets = [1, 2];

    // Verify the condition is actually resolved on-chain before attempting redeem
    const resolved = await isConditionResolvedOnChain(conditionId, negRisk);
    if (!resolved) {
      logger.info(`[Redeem] Condition ${conditionId.slice(0, 10)}... not yet resolved on-chain`);
      return { success: false, error: "Condition not yet resolved on-chain" };
    }

    // Check if proxy wallet has any tokens to redeem
    const hasTokens = await checkProxyTokenBalance(conditionId);
    if (!hasTokens) {
      logger.info(`[Redeem] No tokens at proxy wallet for ${conditionId.slice(0, 10)}...`);
      return { success: true };
    }

    // Encode the redemption calldata
    let to: string;
    let callData: string;

    if (negRisk) {
      const iface = new Interface(NEG_RISK_ABI);
      callData = iface.encodeFunctionData("redeemPositions", [conditionId, indexSets]);
      to = NEG_RISK_ADAPTER;
    } else {
      const iface = new Interface(CTF_ABI);
      callData = iface.encodeFunctionData("redeemPositions", [COLLATERAL_ADDRESS, ZERO_BYTES32, conditionId, indexSets]);
      to = CTF_ADDRESS;
    }

    // Execute through the Gnosis Safe (proxy wallet)
    const safe = new Contract(funderAddress, GNOSIS_SAFE_ABI, signer);
    const nonce = await safe.nonce();

    // Get the Safe transaction hash for signing
    const safeTxHash = await safe.getTransactionHash(
      to, 0, callData, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, nonce
    );

    // Sign with eth_sign — Gnosis Safe expects signature type = eth_sign (v += 4)
    const rawSig = await signer.signMessage(arrayify(safeTxHash));
    const sigBytes = arrayify(rawSig);
    sigBytes[64] += 4;
    const adjustedSig = hexlify(sigBytes);

    // Execute the redemption through the Safe
    const tx = await safe.execTransaction(
      to, 0, callData, 0, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, adjustedSig,
      { gasLimit: 500_000 }
    );
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      logger.error(`[Redeem] Safe tx reverted: ${tx.hash} | conditionId=${conditionId.slice(0, 10)}...`);
      return { success: false, error: "Safe transaction reverted on-chain" };
    }

    logger.info(`[Redeem] Claimed via Safe tx: ${tx.hash} | conditionId=${conditionId.slice(0, 10)}...`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Redeem] Failed for ${conditionId.slice(0, 10)}...: ${msg}`);
    return { success: false, error: msg };
  }
}
