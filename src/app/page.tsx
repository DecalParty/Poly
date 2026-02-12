"use client";

import { useState } from "react";
import { useBotState } from "@/hooks/useBotState";
import StatusBar from "@/components/StatusBar";
import BotControls from "@/components/BotControls";
import CapitalPanel from "@/components/CapitalPanel";
import MarketGrid from "@/components/MarketGrid";
import PnlChart from "@/components/PnlChart";
import StrategyBreakdown from "@/components/StrategyBreakdown";
import TradeHistory from "@/components/TradeHistory";
import AlertsFeed from "@/components/AlertsFeed";
import SettingsPanel from "@/components/SettingsPanel";
import SetupPanel from "@/components/SetupPanel";

export default function DashboardPage() {
  const {
    state,
    trades,
    pnlHistory,
    dailyPnl,
    strategyPerf,
    alerts: hookAlerts,
    logs,
    sseConnected,
    startBot,
    stopBot,
    updateSettings,
    resetCircuitBreaker,
    resetStats,
    recentOutcomes,
  } = useBotState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"settings" | "setup">("settings");
  const allAlerts = state.alerts?.length > 0 ? state.alerts : hookAlerts;

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar
        botStatus={state.status}
        connection={state.connection}
        sseConnected={sseConnected}
        lastAction={state.lastAction}
        lastActionTime={state.lastActionTime}
        paperTrading={state.settings.paperTrading}
        cumulativePnl={state.cumulativePnl}
        totalTrades={state.totalTrades}
        clobReady={state.clobReady}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Live mode warning banner */}
      {!state.settings.paperTrading && (
        <div className="px-5 py-2 bg-red-500/[0.06] border-b border-red-500/10 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] font-bold text-red-400 tracking-wide">LIVE TRADING ACTIVE</span>
          <span className="text-[11px] text-red-400/60">Real USDC orders on Polymarket</span>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 p-4 lg:p-5 max-w-[1600px] w-full mx-auto space-y-4">
        {/* Row 1: Capital + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in">
          <CapitalPanel capital={state.capital} circuitBreaker={state.circuitBreaker} />
          <div className="lg:col-span-2">
            <BotControls
              status={state.status}
              settings={state.settings}
              onStart={startBot}
              onStop={stopBot}
              enabledAssets={state.settings.enabledAssets}
            />
          </div>
        </div>

        {/* Row 2: Markets */}
        <div className="fade-in" style={{ animationDelay: "50ms" }}>
          <MarketGrid
            activeMarkets={state.activeMarkets}
            positions={state.positions}
            enabledAssets={state.settings.enabledAssets}
            recentOutcomes={recentOutcomes}
          />
        </div>

        {/* Row 3: P&L + Strategy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in" style={{ animationDelay: "100ms" }}>
          <div className="lg:col-span-2">
            <PnlChart data={pnlHistory} dailyData={dailyPnl} />
          </div>
          <StrategyBreakdown strategies={strategyPerf} />
        </div>

        {/* Row 4: Trades + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in" style={{ animationDelay: "150ms" }}>
          <div className="lg:col-span-2">
            <TradeHistory trades={trades} />
          </div>
          <AlertsFeed alerts={allAlerts} logs={logs} />
        </div>
      </div>

      {/* Settings / Setup slide-out */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0c0e12] border-l border-white/[0.06] overflow-y-auto shadow-2xl" style={{ animation: "slideIn 0.25s ease-out" }}>
            {/* Header with tabs */}
            <div className="sticky top-0 z-10 bg-[#0c0e12]/90 backdrop-blur-md border-b border-white/[0.04]">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex gap-1">
                  <TabBtn active={sidebarTab === "settings"} onClick={() => setSidebarTab("settings")}>Settings</TabBtn>
                  <TabBtn active={sidebarTab === "setup"} onClick={() => setSidebarTab("setup")}>Setup</TabBtn>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors text-[16px]">
                  ✕
                </button>
              </div>
            </div>
            <div className="p-5">
              {sidebarTab === "settings" ? (
                <SettingsPanel settings={state.settings} botStatus={state.status} onSave={updateSettings} circuitBreaker={state.circuitBreaker} onResetCircuitBreaker={resetCircuitBreaker} onResetStats={resetStats} />
              ) : (
                <SetupPanel />
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
        active
          ? "bg-white/[0.06] text-gray-200"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}
