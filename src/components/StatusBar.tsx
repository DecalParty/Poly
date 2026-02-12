"use client";

import type { BotStatus, ConnectionStatus } from "@/types";

interface StatusBarProps {
  botStatus: BotStatus;
  connection: ConnectionStatus;
  sseConnected: boolean;
  lastAction: string;
  lastActionTime: string | null;
  paperTrading: boolean;
  cumulativePnl: number;
  totalTrades: number;
  clobReady: boolean;
  onSettingsClick?: () => void;
}

export default function StatusBar({
  botStatus, connection, sseConnected, lastAction, lastActionTime,
  paperTrading, cumulativePnl, totalTrades, clobReady, onSettingsClick,
}: StatusBarProps) {
  const isRunning = botStatus === "running";

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-[#0c0e12] border-b border-white/[0.04]">
      <div className="flex items-center gap-4">
        {/* Logo / brand */}
        <span className="text-[14px] font-bold tracking-tight text-gray-100">
          POLY<span className="text-blue-400">BOT</span>
        </span>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* Status dot */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            isRunning ? "bg-emerald-400 pulse-dot" : botStatus === "error" ? "bg-red-400" : "bg-gray-600"
          }`} />
          <span className="text-[12px] text-gray-400 capitalize">{botStatus}</span>
        </div>

        {/* Stream */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1 h-1 rounded-full ${sseConnected ? "bg-emerald-400" : "bg-gray-600"}`} />
          <span className="text-[11px] text-gray-600">{sseConnected ? "Live" : "Offline"}</span>
        </div>

        {/* Mode */}
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${
          paperTrading ? "bg-amber-400/10 text-amber-400" : "bg-red-400/10 text-red-400"
        }`}>
          {paperTrading ? "PAPER" : "LIVE"}
        </span>

        {/* Connection indicators */}
        {!paperTrading && (
          <>
            <div className="w-px h-4 bg-white/[0.06]" />
            <div className="flex items-center gap-1" title="Polymarket CLOB API">
              <div className={`w-1.5 h-1.5 rounded-full ${clobReady ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-[10px] text-gray-600">CLOB</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* P&L */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-600">P&L</span>
          <span className={`mono text-[13px] font-bold ${cumulativePnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {cumulativePnl >= 0 ? "+" : ""}${cumulativePnl.toFixed(2)}
          </span>
        </div>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* Trades */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-600">Trades</span>
          <span className="mono text-[12px] text-gray-300">{totalTrades}</span>
        </div>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* Last action */}
        <span className="text-[11px] text-gray-600 max-w-[200px] truncate">
          {lastAction}
          {lastActionTime && (
            <span className="ml-1 text-gray-700">{new Date(lastActionTime).toLocaleTimeString()}</span>
          )}
        </span>

        {/* Settings */}
        {onSettingsClick && (
          <>
            <div className="w-px h-4 bg-white/[0.06]" />
            <button onClick={onSettingsClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
              title="Settings"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M13.5 8a5.5 5.5 0 01-.3 1.8l1.3.7-1 1.7-1.3-.7a5.5 5.5 0 01-1.5 1l.1 1.5h-2l.1-1.5a5.5 5.5 0 01-1.5-1l-1.3.7-1-1.7 1.3-.7A5.5 5.5 0 012.5 8a5.5 5.5 0 01.3-1.8l-1.3-.7 1-1.7 1.3.7a5.5 5.5 0 011.5-1L5 2h2l-.1 1.5a5.5 5.5 0 011.5 1l1.3-.7 1 1.7-1.3.7A5.5 5.5 0 0113.5 8z" />
              </svg>
              <span className="text-[11px] font-medium">Settings</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
