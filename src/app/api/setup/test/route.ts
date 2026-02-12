import { NextResponse } from "next/server";
import { getClobClient, getReadOnlyClient } from "@/lib/polymarket/client";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";

export const dynamic = "force-dynamic";

interface StepResult {
  ok: boolean;
  label: string;
  detail: string;
}

export async function GET() {
  const results: Record<string, StepResult> = {};

  // 1. Check env vars
  const privateKey = process.env.PRIVATE_KEY;
  const funderAddress = process.env.FUNDER_ADDRESS;
  const rpcUrl = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
  const clobUrl = process.env.CLOB_API_URL || "https://clob.polymarket.com";

  const hasKey = !!privateKey && privateKey !== "0x_your_private_key_here" && privateKey.length > 10;
  const hasFunder = !!funderAddress && funderAddress !== "0x_your_funder_address_here" && funderAddress.length > 10;

  results.envVars = {
    ok: hasKey && hasFunder,
    label: "Environment Variables",
    detail: !hasKey && !hasFunder
      ? "PRIVATE_KEY and FUNDER_ADDRESS missing from .env.local"
      : !hasKey
      ? "PRIVATE_KEY missing from .env.local"
      : !hasFunder
      ? "FUNDER_ADDRESS missing from .env.local"
      : "PRIVATE_KEY and FUNDER_ADDRESS configured",
  };

  // 2. Test RPC connection
  let walletAddress = "";
  try {
    const provider = new StaticJsonRpcProvider(rpcUrl, 137);
    const blockNumber = await Promise.race([
      provider.getBlockNumber(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);

    if (hasKey) {
      const wallet = new Wallet(privateKey!, provider);
      walletAddress = wallet.address;
    }

    results.rpc = {
      ok: true,
      label: "Polygon RPC",
      detail: `Connected (block #${blockNumber}) � ${rpcUrl.includes("polygon-rpc.com") ? "? Public RPC (slow)" : rpcUrl.replace(/\/v2\/.*/, "/v2/***")}`,
    };
  } catch (err) {
    results.rpc = {
      ok: false,
      label: "Polygon RPC",
      detail: `Failed to connect to ${rpcUrl.replace(/\/v2\/.*/, "/v2/***")}: ${err instanceof Error ? err.message : err}`,
    };
  }

  // 3. Test wallet balance (Polymarket exchange + on-chain USDC)
  if (hasKey && hasFunder && results.rpc.ok) {
    try {
      const provider = new StaticJsonRpcProvider(rpcUrl, 137);
      const wallet = new Wallet(privateKey!, provider);

      // Check on-chain USDC.e
      const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
      const { Contract } = await import("@ethersproject/contracts");
      const usdc = new Contract(usdcAddress, erc20Abi, provider);
      const raw = await Promise.race([
        usdc.balanceOf(wallet.address),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      const onChainBalance = Number(raw) / 1e6;

      // Check Polymarket exchange balance (deposited USDC)
      let exchangeBalance = 0;
      try {
        const client = await Promise.race([
          getClobClient(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (client) {
          const resp = await client.getBalanceAllowance({ asset_type: "COLLATERAL" as any });
          exchangeBalance = parseFloat(resp?.balance || "0") / 1e6;
        }
      } catch {
        // Exchange balance unavailable
      }

      const totalBalance = onChainBalance + exchangeBalance;
      const parts: string[] = [];
      if (exchangeBalance > 0) parts.push(`$${exchangeBalance.toFixed(2)} exchange`);
      if (onChainBalance > 0) parts.push(`$${onChainBalance.toFixed(2)} wallet`);

      results.wallet = {
        ok: totalBalance > 0,
        label: "Wallet",
        detail: totalBalance > 0
          ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} | ${parts.join(" + ")}`
          : `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} | $0.00 USDC (deposit on Polymarket to trade)`,
      };
    } catch (err) {
      results.wallet = {
        ok: false,
        label: "Wallet",
        detail: `Could not read balance: ${err instanceof Error ? err.message : err}`,
      };
    }
  } else {
    results.wallet = {
      ok: false,
      label: "Wallet",
      detail: !hasKey ? "No PRIVATE_KEY set" : "RPC not connected",
    };
  }

  // 4. Test CLOB API
  try {
    const roClient = getReadOnlyClient();
    await Promise.race([
      roClient.getOrderBook("0x0000000000000000000000000000000000000000000000000000000000000001"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);

    results.clobRead = {
      ok: true,
      label: "CLOB API (read)",
      detail: `Connected to ${clobUrl}`,
    };
  } catch (err) {
    // Even a 404 means the API is reachable
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("Not Found") || msg.includes("400")) {
      results.clobRead = {
        ok: true,
        label: "CLOB API (read)",
        detail: `Connected to ${clobUrl}`,
      };
    } else {
      results.clobRead = {
        ok: false,
        label: "CLOB API (read)",
        detail: `Cannot reach ${clobUrl}: ${msg}`,
      };
    }
  }

  // 5. Test authenticated CLOB (only if we have keys)
  if (hasKey && hasFunder) {
    try {
      const client = await Promise.race([
        getClobClient(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);

      results.clobAuth = {
        ok: !!client,
        label: "CLOB API (auth)",
        detail: client
          ? "Authenticated � API keys derived from wallet"
          : "Failed � check PRIVATE_KEY and FUNDER_ADDRESS",
      };
    } catch (err) {
      results.clobAuth = {
        ok: false,
        label: "CLOB API (auth)",
        detail: `Auth failed: ${err instanceof Error ? err.message : err}`,
      };
    }
  } else {
    results.clobAuth = {
      ok: false,
      label: "CLOB API (auth)",
      detail: "Skipped � env vars not set",
    };
  }

  // Overall readiness
  const readyForLive = results.envVars.ok && results.rpc.ok && results.wallet.ok && results.clobAuth.ok;

  return NextResponse.json({
    success: true,
    data: {
      steps: results,
      readyForLive,
      walletAddress: walletAddress || null,
    },
  });
}
