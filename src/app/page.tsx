"use client";

import { useState } from "react";
import { useBotState } from "@/hooks/useBotState";
import StatusBar from "@/components/StatusBar";
import BotControls from "@/components/BotControls";
import CapitalPanel from "@/components/CapitalPanel";
import ScalpPanel from "@/components/ScalpPanel";
import PnlChart from "@/components/PnlChart";
import StrategyBreakdown from "@/components/StrategyBreakdown";
import TradeHistory from "@/components/TradeHistory";
import AlertsFeed from "@/components/AlertsFeed";
import SettingsPanel from "@/components/SettingsPanel";
import SetupPanel from "@/components/SetupPanel";
import ManualTradePanel from "@/components/ManualTradePanel";
import type { ScalpData } from "@/types";

const DEFAULT_SCALP: ScalpData = {
  binancePrice: 0,
  windowOpenPrice: 0,
  btcChangePercent: 0,
  fairValue: { up: 0.5, down: 0.5 },
  positions: [],
  pendingBuys: [],
  cooldownUntil: 0,
};

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
    scalpData,
  } = useBotState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"settings" | "setup">("settings");
  const [mainTab, setMainTab] = useState<"dashboard" | "history" | "logs" | "trade">("dashboard");
  const allAlerts = state.alerts?.length > 0 ? state.alerts : hookAlerts;

  const scalp = scalpData || state.scalp || DEFAULT_SCALP;

  return (
    <div className="min-h-screen flex flex-col bg-[#08090c]">
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
        walletBalance={state.walletBalance}
        walletAddress={state.walletAddress}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Live mode warning */}
      {!state.settings.paperTrading && (
        <div className="px-5 py-1 bg-red-500/[0.04] border-b border-red-500/10 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[9px] font-bold text-red-400 tracking-wide">LIVE TRADING ACTIVE</span>
        </div>
      )}

      {/* Tab Bar */}
      <div className="px-4 pt-2 pb-0 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-0.5 bg-white/[0.02] rounded-lg p-0.5 w-fit border border-white/[0.04]">
          {(["dashboard", "history", "logs"] as const).map((tab) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                mainTab === tab
                  ? "bg-white/[0.08] text-gray-100 shadow-sm"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              {tab === "dashboard" ? "Dashboard" : tab === "history" ? "History" : "Logs"}
            </button>
          ))}
          {/* Manual Trade tab - creative optional entry */}
          <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
          <button onClick={() => setMainTab("trade")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 flex items-center gap-1.5 ${
              mainTab === "trade"
                ? "bg-blue-500/10 text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v12M2 8h12" />
            </svg>
            Trade
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-3 lg:p-4 pt-2 max-w-[1600px] w-full mx-auto space-y-2">

        {mainTab === "dashboard" && (
          <>
            {/* Controls + Capital - single row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 slide-up">
              <div className="lg:col-span-3">
                <BotControls
                  status={state.status}
                  settings={state.settings}
                  onStart={startBot}
                  onStop={stopBot}
                  enabledAssets={state.settings.enabledAssets}
                />
              </div>
              <CapitalPanel capital={state.capital} circuitBreaker={state.circuitBreaker} />
            </div>

            {/* Scalp Panel - main content */}
            <div className="slide-up" style={{ animationDelay: "50ms" }}>
              <ScalpPanel
                activeMarkets={state.activeMarkets}
                scalp={scalp}
                settings={state.settings}
                recentOutcomes={recentOutcomes}
              />
            </div>
          </>
        )}

        {mainTab === "history" && (
          <>
            {/* P&L Chart */}
            <div className="fade-in">
              <PnlChart data={pnlHistory} dailyData={dailyPnl} />
            </div>
            {/* Strategy + Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 fade-in" style={{ animationDelay: "25ms" }}>
              <div className="lg:col-span-2">
                <TradeHistory trades={trades} />
              </div>
              <StrategyBreakdown strategies={strategyPerf} />
            </div>
          </>
        )}

        {mainTab === "logs" && (
          <div className="fade-in">
            <AlertsFeed alerts={allAlerts} logs={logs} />
          </div>
        )}

        {mainTab === "trade" && (
          <div className="fade-in">
            <ManualTradePanel
              activeMarkets={state.activeMarkets}
              scalp={scalp}
              settings={state.settings}
              capital={state.capital}
            />
          </div>
        )}
      </div>

      {/* Settings Slide-out */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0c0e12] border-l border-white/[0.06] overflow-y-auto shadow-2xl" style={{ animation: "slideIn 0.25s ease-out" }}>
            <div className="sticky top-0 z-10 bg-[#0c0e12]/90 backdrop-blur-md border-b border-white/[0.04]">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex gap-1">
                  <TabBtn active={sidebarTab === "settings"} onClick={() => setSidebarTab("settings")}>Settings</TabBtn>
                  <TabBtn active={sidebarTab === "setup"} onClick={() => setSidebarTab("setup")}>Setup</TabBtn>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors text-[16px]">
                  &#x2715;
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
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
        active ? "bg-white/[0.06] text-gray-200" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}
