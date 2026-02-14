"use client";
import { useState, useEffect } from "react";
import type { BotSettings, BotStatus, MarketAsset, CircuitBreakerState } from "@/types";
import { ALL_ASSETS } from "@/types";
interface SettingsPanelProps { settings: BotSettings; botStatus: BotStatus; onSave: (s: Record<string, unknown>) => Promise<{ success: boolean }>; circuitBreaker: CircuitBreakerState; onResetCircuitBreaker: () => Promise<void>; onResetStats: () => Promise<void>; }
export default function SettingsPanel({ settings, botStatus, onSave, circuitBreaker, onResetCircuitBreaker, onResetStats }: SettingsPanelProps) {
  const [form, setForm] = useState<BotSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState("");
  const [confirmCbReset, setConfirmCbReset] = useState(false);
  const [cbResetting, setCbResetting] = useState(false);
  const [confirmStatsReset, setConfirmStatsReset] = useState(false);
  const [statsResetting, setStatsResetting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ mode: true, capital: false, markets: false, scalp: true });
  useEffect(() => { setForm(settings); }, [settings]);
  const disabled = botStatus === "running";
  const handleNumChange = (field: keyof BotSettings, value: string) => { setForm((prev) => ({ ...prev, [field]: parseFloat(value) || 0 })); };
  const handleBoolChange = (field: keyof BotSettings, value: boolean) => { setForm((prev) => ({ ...prev, [field]: value })); };
  const toggleAsset = (asset: MarketAsset) => { setForm((prev) => { const c = prev.enabledAssets || []; const n = c.includes(asset) ? c.filter((a: MarketAsset) => a !== asset) : [...c, asset]; return { ...prev, enabledAssets: n.length > 0 ? n : [asset] }; }); };
  const toggleSection = (key: string) => { setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })); };
  const handleSave = async () => { setSaving(true); setSaved(false); try { const r = await onSave(form as unknown as Record<string, unknown>); if (r.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); } } catch {} setSaving(false); };
  const hasChanges = JSON.stringify(form) !== JSON.stringify(settings);
  const f = form as any;
  return (<div className="space-y-3">
    {disabled && <div className="px-4 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/10"><p className="text-[11px] text-amber-400/90 font-medium">Stop the bot to edit settings</p></div>}
    <Sec title="Trading Mode" open={openSections.mode} onToggle={() => toggleSection("mode")} badge={form.paperTrading ? { text: "PAPER", color: "text-amber-400 bg-amber-400/10" } : { text: "LIVE", color: "text-red-400 bg-red-400/10" }}>
      <div className={`flex items-center justify-between p-3 rounded-xl border ${form.paperTrading ? "bg-white/[0.02] border-white/[0.04]" : "bg-red-500/[0.04] border-red-500/15"}`}>
        <div><span className="text-[13px] font-medium text-gray-200">{form.paperTrading ? "Paper Trading" : "Live Trading"}</span><p className="text-[10px] text-gray-500 mt-0.5">{form.paperTrading ? "Simulated, no real money" : "Real USDC on Polymarket"}</p></div>
        {form.paperTrading ? <button onClick={() => { if (!disabled) setConfirmLive(true); }} disabled={disabled} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-all disabled:opacity-30">Go Live</button> : <button onClick={() => { if (!disabled) handleBoolChange("paperTrading", true); }} disabled={disabled} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] transition-all disabled:opacity-30">Switch to Paper</button>}
      </div>
    </Sec>
    <Sec title="Capital" open={openSections.capital} onToggle={() => toggleSection("capital")} subtitle={`$${form.maxTotalExposure} max`}>
      <div className="grid grid-cols-2 gap-3">
        <NF label="Max Exposure" value={form.maxTotalExposure} field="maxTotalExposure" onChange={handleNumChange} disabled={disabled} prefix="$" step="5" />
        <NF label="Daily Loss Limit" value={form.dailyLossLimit} field="dailyLossLimit" onChange={handleNumChange} disabled={disabled} prefix="$" step="1" />
        <NF label="Loss Limit" value={form.lossLimit} field="lossLimit" onChange={handleNumChange} disabled={disabled} suffix="trades" step="1" />
      </div>
    </Sec>
    <Sec title="Markets" open={openSections.markets} onToggle={() => toggleSection("markets")}>
      <div className="flex flex-wrap gap-2">{ALL_ASSETS.map((asset) => { const en = (form.enabledAssets || []).includes(asset); return (<button key={asset} onClick={() => !disabled && toggleAsset(asset)} disabled={disabled} className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${en ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-white/[0.02] text-gray-500 border-white/[0.06] hover:border-white/[0.1]"} ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}>{asset}</button>); })}</div>
    </Sec>
    <Sec title="Scalp Strategy" open={openSections.scalp} onToggle={() => toggleSection("scalp")} badge={f.scalpEnabled !== false ? { text: "ACTIVE", color: "text-emerald-400 bg-emerald-400/10" } : { text: "OFF", color: "text-gray-500 bg-white/[0.04]" }}>
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div><span className="text-[12px] font-medium text-gray-300">Bitbo Edge Scalper</span><p className="text-[10px] text-gray-500 mt-0.5">Uses Bitbo's 1-2s price lead to buy undervalued sides</p></div>
        <Tog value={f.scalpEnabled !== false} onChange={(v: boolean) => handleBoolChange("scalpEnabled" as any, v)} disabled={disabled} />
      </div>
      {f.scalpEnabled !== false && <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NF label="Trade Size" value={f.scalpTradeSize ?? 12} field="scalpTradeSize" onChange={handleNumChange} disabled={disabled} prefix="$" step="1" />
          <NF label="Max Positions" value={f.scalpMaxPositions ?? 2} field="scalpMaxPositions" onChange={handleNumChange} disabled={disabled} step="1" />
          <NF label="Min Gap" value={f.scalpMinGap ?? 0.02} field="scalpMinGap" onChange={handleNumChange} disabled={disabled} prefix="$" step="0.01" />
          <NF label="Profit Target" value={f.scalpProfitTarget ?? 0.03} field="scalpProfitTarget" onChange={handleNumChange} disabled={disabled} prefix="$" step="0.01" />
          <NF label="Entry Min" value={f.scalpEntryMin ?? 0.15} field="scalpEntryMin" onChange={handleNumChange} disabled={disabled} prefix="$" step="0.01" />
          <NF label="Entry Max" value={f.scalpEntryMax ?? 0.85} field="scalpEntryMax" onChange={handleNumChange} disabled={disabled} prefix="$" step="0.01" />
          <NF label="Exit Window" value={f.scalpExitWindow ?? 120} field="scalpExitWindow" onChange={handleNumChange} disabled={disabled} suffix="sec" step="10" />
          <NF label="Half Size After" value={f.scalpHalfSizeAfter ?? 420} field="scalpHalfSizeAfter" onChange={handleNumChange} disabled={disabled} suffix="sec left" step="30" />
        </div>
        <div className="rounded-xl bg-white/[0.015] border border-white/[0.04] p-3">
          <p className="text-[10px] text-gray-500 font-semibold mb-1">How it works</p>
          <p className="text-[10px] text-gray-600 leading-relaxed">Predicts fair values using Bitbo BTC velocity + 30min trend. Market buys when a side is {((f.scalpMinGap ?? 0.02) * 100).toFixed(0)}+ cents undervalued. Sells at entry + ${(f.scalpProfitTarget ?? 0.03).toFixed(2)} or at exit window ({f.scalpExitWindow ?? 120}s left). Halves trade size with {Math.floor((f.scalpHalfSizeAfter ?? 420) / 60)}min left.</p>
        </div>
      </div>}
    </Sec>
    <button onClick={handleSave} disabled={!hasChanges || saving || disabled} className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ${saved ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : hasChanges && !disabled ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15" : "bg-white/[0.03] text-gray-600 border border-white/[0.06] cursor-not-allowed"}`}>{saving ? "Saving..." : saved ? "Saved" : hasChanges ? "Save Changes" : "No Changes"}</button>
    {circuitBreaker.triggered && <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4 space-y-3">
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-[12px] font-semibold text-red-400">Circuit Breaker Active</span></div>
      {circuitBreaker.reason && <p className="text-[11px] text-gray-400">{circuitBreaker.reason}</p>}
      {!confirmCbReset ? <button onClick={() => setConfirmCbReset(true)} className="w-full py-2 rounded-xl text-[12px] font-semibold bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/15 transition-colors">Disable Circuit Breaker</button> : <div className="flex gap-2"><button onClick={() => setConfirmCbReset(false)} className="flex-1 py-2 rounded-xl text-[12px] bg-white/[0.04] text-gray-400 border border-white/[0.06]">Cancel</button><button onClick={async () => { setCbResetting(true); try { await onResetCircuitBreaker(); } catch {} setCbResetting(false); setConfirmCbReset(false); }} disabled={cbResetting} className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20 disabled:opacity-40">{cbResetting ? "Resetting..." : "Confirm"}</button></div>}
    </div>}
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
      <span className="text-[12px] font-semibold text-gray-400">Reset Stats</span>
      <p className="text-[10px] text-gray-600">Delete all trade history and analytics.</p>
      {!confirmStatsReset ? <button onClick={() => setConfirmStatsReset(true)} className="w-full py-2 rounded-xl text-[12px] font-semibold bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] transition-colors">Reset All Stats</button> : <div className="flex gap-2"><button onClick={() => setConfirmStatsReset(false)} className="flex-1 py-2 rounded-xl text-[12px] bg-white/[0.04] text-gray-400 border border-white/[0.06]">Cancel</button><button onClick={async () => { setStatsResetting(true); try { await onResetStats(); } catch {} setStatsResetting(false); setConfirmStatsReset(false); }} disabled={statsResetting} className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20 disabled:opacity-40">{statsResetting ? "Deleting..." : "Confirm Delete"}</button></div>}
    </div>
    {confirmLive && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"><div className="bg-[#13151a] border border-red-500/20 rounded-2xl p-6 max-w-sm mx-4"><h3 className="text-[14px] font-semibold text-red-400 mb-3">Switch to Live Trading</h3><p className="text-[13px] text-gray-400 mb-4">Real USDC trades. Type <strong className="text-gray-200">CONFIRM</strong> to proceed.</p><input type="text" value={liveConfirmText} onChange={(e) => setLiveConfirmText(e.target.value)} placeholder="Type CONFIRM" className="w-full mb-3 px-3 py-2 rounded-xl text-[13px] mono bg-black/40 border border-white/[0.08] text-gray-200 focus:border-red-500/30 focus:outline-none" /><div className="flex gap-2"><button onClick={() => setConfirmLive(false)} className="flex-1 py-2 rounded-xl text-[13px] bg-white/[0.04] text-gray-400 border border-white/[0.06]">Cancel</button><button onClick={() => { if (liveConfirmText === "CONFIRM") { setConfirmLive(false); handleBoolChange("paperTrading", false); } }} disabled={liveConfirmText !== "CONFIRM"} className="flex-1 py-2 rounded-xl text-[13px] bg-red-500/10 text-red-400 border border-red-500/20 font-medium disabled:opacity-30">Enable Live</button></div></div></div>}
  </div>);
}
function Sec({ title, open, onToggle, children, badge, subtitle }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; badge?: { text: string; color: string }; subtitle?: string; }) {
  return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
      <div className="flex items-center gap-2.5">
        <span className={`text-[9px] text-gray-600 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>&#x25B6;</span>
        <span className="text-[12px] font-semibold text-gray-200 tracking-wide">{title}</span>
        {badge && <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider ${badge.color}`}>{badge.text}</span>}
      </div>
      {subtitle && !open && <span className="text-[10px] text-gray-600 mono">{subtitle}</span>}
    </button>
    <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}><div className="px-4 pb-4 pt-1">{children}</div></div>
  </div>);
}
function NF({ label, value, field, onChange, disabled, prefix, suffix, step }: { label: string; value: number; field: string; onChange: (f: any, v: string) => void; disabled?: boolean; prefix?: string; suffix?: string; step: string; }) {
  return (<div>
    <label className="block text-[10px] text-gray-500 font-medium mb-1.5 tracking-wide">{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600">{prefix}</span>}
      <input type="number" step={step} value={value} onChange={(e) => onChange(field, e.target.value)} disabled={disabled} className={`w-full mono text-[12px] py-2 rounded-xl bg-black/30 border border-white/[0.06] text-gray-200 focus:border-blue-500/30 focus:outline-none transition-all disabled:opacity-30 ${prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-10" : "px-3"}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600">{suffix}</span>}
    </div>
  </div>);
}
function Tog({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; }) {
  return (<button type="button" onClick={() => !disabled && onChange(!value)} className={`relative w-9 h-5 rounded-full transition-all duration-300 ${value ? "bg-emerald-500/80" : "bg-white/[0.08]"} ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}><span className={`absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${value ? "translate-x-[16px]" : "translate-x-0"}`} /></button>);
}
