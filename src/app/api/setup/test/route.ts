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
      const { Contract } = await import("@ethersproject/contracts");
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

      // Check both USDC.e and native USDC at both EOA and funder (proxy) address
      const usdcE = new Contract("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", erc20Abi, provider);
      const usdcNative = new Contract("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", erc20Abi, provider);

      const addresses = [wallet.address];
      if (funderAddress && funderAddress.toLowerCase() !== wallet.address.toLowerCase()) {
        addresses.push(funderAddress);
      }

      const balanceResults = await Promise.race([
        Promise.all(
          addresses.flatMap((addr) => [
            usdcE.balanceOf(addr).then((r: any) => ({ addr, token: "USDC.e", val: Number(r) / 1e6 })).catch(() => ({ addr, token: "USDC.e", val: 0 })),
            usdcNative.balanceOf(addr).then((r: any) => ({ addr, token: "USDC", val: Number(r) / 1e6 })).catch(() => ({ addr, token: "USDC", val: 0 })),
          ])
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);

      const onChainBalance = balanceResults.reduce((sum, b) => sum + b.val, 0);
      console.log(`[Setup] On-chain balances: ${balanceResults.map(b => `${b.token}@${b.addr.slice(0,6)}=$${b.val.toFixed(2)}`).join(", ")}`);

      // Check Polymarket exchange balance (deposited USDC)
      let exchangeBalance = 0;
      try {
        const client = await Promise.race([
          getClobClient(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (client) {
          const resp = await client.getBalanceAllowance({ asset_type: "COLLATERAL" as any });
          const rawBalance = resp?.balance || "0";
          const parsed = parseFloat(rawBalance);
          exchangeBalance = parsed > 1_000_000 ? parsed / 1e6 : parsed;
          console.log(`[Setup] Exchange balance raw="${rawBalance}" parsed=${exchangeBalance}`);
        }
      } catch {
        // Exchange balance unavailable
      }

      const totalBalance = onChainBalance + exchangeBalance;
      const parts: string[] = [];
      if (exchangeBalance > 0) parts.push(`$${exchangeBalance.toFixed(2)} exchange`);
      if (onChainBalance > 0) parts.push(`$${onChainBalance.toFixed(2)} on-chain`);

      const displayAddr = funderAddress
        ? `${funderAddress.slice(0, 6)}...${funderAddress.slice(-4)}`
        : `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

      // Wallet is connected if we can read the address - balance is informational
      results.wallet = {
        ok: true,
        label: "Wallet",
        detail: totalBalance > 0
          ? `${displayAddr} | ${parts.join(" + ")}`
          : `${displayAddr} | $0.00 available (funds may be in active positions)`,
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
