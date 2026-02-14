"use client";

import { useState } from "react";
import type { ActiveMarketState, ScalpData, BotSettings, CapitalState } from "@/types";

interface ManualTradePanelProps {
  activeMarkets: Record<string, ActiveMarketState>;
  scalp: ScalpData;
  settings: BotSettings;
  capital: CapitalState;
}

export default function ManualTradePanel({ activeMarkets, scalp, settings, capital }: ManualTradePanelProps) {
  const [side, setSide] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState("5");
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const market = activeMarkets["BTC"];
  const price = side === "up" ? (market?.yesPrice ?? 0) : (market?.noPrice ?? 0);
  const shares = price > 0 ? parseFloat(amount) / price : 0;
  const payout = shares;
  const profit = payout - parseFloat(amount);

  const quickAmounts = [1, 2, 5, 10, 25];

  const handlePlace = async () => {
    if (!market || price <= 0) return;
    setPlacing(true);
    setResult(null);

    // This is a placeholder. When you're ready, this will call your order API.
    await new Promise((r) => setTimeout(r, 800));
    setResult({
      ok: false,
      msg: "Manual trading coming soon. This panel is ready for your order API.",
    });
    setPlacing(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-3">
      {/* Header */}
      <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
            <path d="M8 1v14M1 8h14" strokeLinecap="round" />
          </svg>
          <h2 className="text-[13px] font-semibold text-gray-200">Manual Trade</h2>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/10 text-blue-400 tracking-wider">BETA</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Place manual bets on the current BTC 15-minute window. Choose UP or DOWN, set your amount, and confirm.
          {settings.paperTrading && " Paper mode - no real orders will be placed."}
        </p>
      </div>

      {/* Market Info Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3 text-center">
          <span className="text-[8px] text-gray-600 uppercase">BTC Price</span>
          <p className="mono text-[14px] font-bold text-gray-200">
            ${scalp.binancePrice > 0 ? scalp.binancePrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "---"}
          </p>
        </div>
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3 text-center">
          <span className="text-[8px] text-gray-600 uppercase">Available</span>
          <p className="mono text-[14px] font-bold text-emerald-400">${capital.available.toFixed(2)}</p>
        </div>
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3 text-center">
          <span className="text-[8px] text-gray-600 uppercase">Change</span>
          <p className={`mono text-[14px] font-bold ${scalp.btcChangePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {(scalp.btcChangePercent * 100).toFixed(3)}%
          </p>
        </div>
      </div>

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide("up")}
          className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
            side === "up"
              ? "border-emerald-500/40 bg-emerald-500/[0.06]"
              : "border-white/[0.06] bg-[#111318] hover:border-white/[0.1]"
          }`}
        >
          <div className="text-[20px] mb-1">{"\u25B2"}</div>
          <div className={`text-[13px] font-bold ${side === "up" ? "text-emerald-400" : "text-gray-400"}`}>UP (Yes)</div>
          <div className="mono text-[16px] font-bold text-emerald-400 mt-1">
            ${market?.yesPrice.toFixed(2) ?? "---"}
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">
            Fair ${scalp.fairValue.up.toFixed(2)}
          </div>
        </button>
        <button
          onClick={() => setSide("down")}
          className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
            side === "down"
              ? "border-red-500/40 bg-red-500/[0.06]"
              : "border-white/[0.06] bg-[#111318] hover:border-white/[0.1]"
          }`}
        >
          <div className="text-[20px] mb-1">{"\u25BC"}</div>
          <div className={`text-[13px] font-bold ${side === "down" ? "text-red-400" : "text-gray-400"}`}>DOWN (No)</div>
          <div className="mono text-[16px] font-bold text-red-400 mt-1">
            ${market?.noPrice.toFixed(2) ?? "---"}
          </div>
          <div className="text-[9px] text-gray-600 mt-0.5">
            Fair ${scalp.fairValue.down.toFixed(2)}
          </div>
        </button>
      </div>

      {/* Amount */}
      <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-4">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2 block">Amount (USDC)</label>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-500 mono">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.5"
            min="0.1"
            className="w-full pl-7 pr-3 py-2.5 rounded-xl mono text-[16px] font-bold bg-black/30 border border-white/[0.06] text-gray-100 focus:border-blue-500/30 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {quickAmounts.map((qa) => (
            <button
              key={qa}
              onClick={() => setAmount(qa.toString())}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold mono transition-all ${
                amount === qa.toString()
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  : "bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:text-gray-300"
              }`}
            >
              ${qa}
            </button>
          ))}
          <button
            onClick={() => setAmount(capital.available.toFixed(2))}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:text-gray-300"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Order Summary */}
      {price > 0 && parseFloat(amount) > 0 && (
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-4 space-y-2">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Order Preview</h3>
          <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
            <span className="text-gray-500">Side</span>
            <span className={`text-right font-bold ${side === "up" ? "text-emerald-400" : "text-red-400"}`}>
              {side === "up" ? "UP (Yes)" : "DOWN (No)"}
            </span>
            <span className="text-gray-500">Price</span>
            <span className="text-right mono text-gray-300">${price.toFixed(2)}</span>
            <span className="text-gray-500">Cost</span>
            <span className="text-right mono text-gray-300">${parseFloat(amount).toFixed(2)}</span>
            <span className="text-gray-500">Shares</span>
            <span className="text-right mono text-gray-300">{shares.toFixed(2)}</span>
            <span className="text-gray-500">Payout if win</span>
            <span className="text-right mono text-emerald-400">${payout.toFixed(2)}</span>
            <span className="text-gray-500">Profit if win</span>
            <span className="text-right mono text-emerald-400">+${profit.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Place Button */}
      <button
        onClick={handlePlace}
        disabled={placing || price <= 0 || parseFloat(amount) <= 0}
        className={`w-full py-3 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-200 ${
          side === "up"
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15"
            : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15"
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {placing ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
            Placing...
          </span>
        ) : (
          `BUY ${side.toUpperCase()} - $${parseFloat(amount || "0").toFixed(2)}`
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-3 text-[11px] ${
          result.ok
            ? "bg-emerald-500/[0.04] border-emerald-500/10 text-emerald-400"
            : "bg-amber-500/[0.04] border-amber-500/10 text-amber-400"
        }`}>
          {result.msg}
        </div>
      )}

      {/* Info */}
      <div className="text-[9px] text-gray-600 text-center px-4">
        {settings.paperTrading
          ? "Paper mode - trades are simulated"
          : "Live mode - real USDC will be used"}
      </div>
    </div>
  );
}
