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
  walletBalance: number | null;
  walletAddress: string | null;
  onSettingsClick?: () => void;
}

export default function StatusBar({
  botStatus, connection, sseConnected, lastAction, lastActionTime,
  paperTrading, cumulativePnl, totalTrades, clobReady, walletBalance, walletAddress, onSettingsClick,
}: StatusBarProps) {
  const isRunning = botStatus === "running";

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#0c0e12] border-b border-white/[0.04]">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <span className="text-[13px] font-bold tracking-tight text-gray-100">
          POLY<span className="text-blue-400">BOT</span>
        </span>

        <div className="w-px h-3.5 bg-white/[0.06]" />

        {/* Status */}
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${
            isRunning ? "bg-emerald-400 pulse-dot" : botStatus === "error" ? "bg-red-400" : "bg-gray-600"
          }`} />
          <span className="text-[11px] text-gray-400 capitalize">{botStatus}</span>
        </div>

        {/* Stream */}
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full ${sseConnected ? "bg-emerald-400" : "bg-gray-600"}`} />
          <span className="text-[10px] text-gray-600">{sseConnected ? "Live" : "Off"}</span>
        </div>

        {/* Mode */}
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${
          paperTrading ? "bg-amber-400/10 text-amber-400" : "bg-red-400/10 text-red-400"
        }`}>
          {paperTrading ? "PAPER" : "LIVE"}
        </span>

        {/* CLOB */}
        {!paperTrading && (
          <>
            <div className="w-px h-3.5 bg-white/[0.06]" />
            <div className="flex items-center gap-1" title="Polymarket CLOB API">
              <div className={`w-1.5 h-1.5 rounded-full ${clobReady ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-[9px] text-gray-600">CLOB</span>
            </div>
          </>
        )}

        {/* Wallet */}
        {walletBalance !== null && (
          <>
            <div className="w-px h-3.5 bg-white/[0.06]" />
            <div className="flex items-center gap-1" title={walletAddress || "Wallet"}>
              <span className="mono text-[11px] font-bold text-gray-200">${walletBalance.toFixed(2)}</span>
              {walletAddress && (
                <span className="text-[9px] text-gray-600">{walletAddress.slice(0, 4)}..{walletAddress.slice(-3)}</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* P&L */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-600">P&L</span>
          <span className={`mono text-[12px] font-bold ${cumulativePnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {cumulativePnl >= 0 ? "+" : ""}${cumulativePnl.toFixed(2)}
          </span>
        </div>

        <div className="w-px h-3.5 bg-white/[0.06]" />

        {/* Trades */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-600">Trades</span>
          <span className="mono text-[11px] text-gray-300">{totalTrades}</span>
        </div>

        <div className="w-px h-3.5 bg-white/[0.06]" />

        {/* Last action */}
        <span className="text-[10px] text-gray-600 max-w-[160px] truncate">
          {lastAction}
          {lastActionTime && (
            <span className="ml-1 text-gray-700">{new Date(lastActionTime).toLocaleTimeString()}</span>
          )}
        </span>

        {/* Settings */}
        {onSettingsClick && (
          <>
            <div className="w-px h-3.5 bg-white/[0.06]" />
            <button onClick={onSettingsClick}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-gray-400 hover:text-gray-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
              title="Settings"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M13.5 8a5.5 5.5 0 01-.3 1.8l1.3.7-1 1.7-1.3-.7a5.5 5.5 0 01-1.5 1l.1 1.5h-2l.1-1.5a5.5 5.5 0 01-1.5-1l-1.3.7-1-1.7 1.3-.7A5.5 5.5 0 012.5 8a5.5 5.5 0 01.3-1.8l-1.3-.7 1-1.7 1.3.7a5.5 5.5 0 011.5-1L5 2h2l-.1 1.5a5.5 5.5 0 011.5 1l1.3-.7 1 1.7-1.3.7A5.5 5.5 0 0113.5 8z" />
              </svg>
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
