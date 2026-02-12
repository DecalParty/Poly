"use client";

import { useState } from "react";
import type { BotStatus, BotSettings, MarketAsset } from "@/types";

interface BotControlsProps {
  status: BotStatus;
  settings: BotSettings;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  enabledAssets: MarketAsset[];
}

export default function BotControls({
  status, settings, onStart, onStop, enabledAssets,
}: BotControlsProps) {
  const [loading, setLoading] = useState(false);
  const isRunning = status === "running";
  const isLive = !settings.paperTrading;

  const handleToggle = async () => {
    setLoading(true);
    try { isRunning ? await onStop() : await onStart(); } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className={`card p-5 h-full flex flex-col ${isLive ? "ring-1 ring-red-500/20" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Controls</h2>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400 tracking-wider">LIVE TRADING</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isRunning ? "bg-emerald-400 pulse-dot shadow-[0_0_8px_rgba(16,185,129,0.4)]" : status === "error" ? "bg-red-400" : "bg-gray-700"
            }`} />
            <span className="text-[12px] font-medium capitalize text-gray-400">{status}</span>
          </div>
          {!isLive && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-amber-400/10 text-amber-400">PAPER</span>
          )}
          <button onClick={handleToggle} disabled={loading}
            className={`px-5 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-200 ${
              isRunning
                ? "bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/15"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/15"
            } ${loading ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {loading ? (
              <span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
            ) : isRunning ? "STOP" : "START"}
          </button>
        </div>
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-6 gap-2">
        <Tile label="Strategy" value="DCA" sub="Accumulator" color="text-blue-400" />
        <Tile label="Buy Size" value={`$${settings.highConfBuyAmount.toFixed(2)}`} sub="per interval" color="text-emerald-400" />
        <Tile label="Interval" value={`${settings.highConfBuyInterval}s`} sub="between buys" color="text-amber-400" />
        <Tile label="Entry" value={`$${settings.highConfEntryMin} - $${settings.highConfEntryMax}`} sub="price range" color="text-gray-300" />
        <Tile
          label="Mode"
          value={isLive ? "Live" : "Paper"}
          sub={isLive ? "real USDC" : "simulated"}
          color={isLive ? "text-red-400" : "text-amber-400"}
        />
        <Tile label="Window" value={`${Math.floor(settings.highConfTimeMax / 60)}m`} sub="max remaining" color="text-gray-300" />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2.5 py-2">
      <p className="text-[7px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[13px] font-bold leading-none ${color}`}>{value}</p>
      <p className="text-[8px] text-gray-600 mt-0.5">{sub}</p>
    </div>
  );
}
