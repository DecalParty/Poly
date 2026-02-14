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
    <div className={`bg-[#111318] rounded-xl border p-3 ${isLive ? "border-red-500/15" : "border-white/[0.04]"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Status + Mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isRunning ? "bg-emerald-400 pulse-dot shadow-[0_0_8px_rgba(16,185,129,0.4)]" : status === "error" ? "bg-red-400" : "bg-gray-700"
            }`} />
            <span className="text-[11px] font-semibold capitalize text-gray-300">{status}</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${
            isLive ? "bg-red-500/10 text-red-400" : "bg-amber-400/10 text-amber-400"
          }`}>
            {isLive ? "LIVE" : "PAPER"}
          </span>
        </div>

        {/* Center: Config tiles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <MiniTile label="Strategy" value="Scalp" />
          <MiniTile label="Size" value={`$${settings.scalpTradeSize}`} />
          <MiniTile label="Gap" value={`$${settings.scalpMinGap}`} />
          <MiniTile label="Entry" value={`${settings.scalpEntryMin}-${settings.scalpEntryMax}`} />
          <MiniTile label="Positions" value={`${settings.scalpMaxPositions}`} />
        </div>

        {/* Right: Start/Stop */}
        <button onClick={handleToggle} disabled={loading}
          className={`px-5 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-200 flex-shrink-0 ${
            isRunning
              ? "bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20"
          } ${loading ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {loading ? (
            <span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
          ) : isRunning ? "STOP" : "START"}
        </button>
      </div>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.04]">
      <span className="text-[7px] text-gray-600 uppercase tracking-wider">{label}</span>
      <span className="mono text-[10px] font-semibold text-gray-300 ml-1">{value}</span>
    </div>
  );
}
