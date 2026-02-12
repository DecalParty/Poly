"use client";

import { useState, useCallback } from "react";

interface StepResult {
  ok: boolean;
  label: string;
  detail: string;
}

interface SetupData {
  steps: Record<string, StepResult>;
  readyForLive: boolean;
  walletAddress: string | null;
}

export default function SetupPanel() {
  const [testing, setTesting] = useState(false);
  const [data, setData] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/test");
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || "Test failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
    setTesting(false);
  }, []);

  const stepOrder = ["envVars", "rpc", "wallet", "clobRead", "clobAuth"];

  return (
    <div className="space-y-4">
      {/* How it works � dead simple */}
      <div className="rounded-xl bg-blue-500/[0.04] border border-blue-500/10 p-4">
        <h3 className="text-[13px] font-semibold text-blue-400 mb-3">How to go live</h3>
        <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
          Everything happens on your VPS. Nothing to enter in the bot UI.
        </p>

        <div className="space-y-3">
          <SimpleStep n={1} title="Get a VPS in Amsterdam">
            Hetzner, Vultr, or DigitalOcean. Pick Amsterdam. ~$5/mo is fine.
          </SimpleStep>

          <SimpleStep n={2} title="Clone & install on the VPS">
            <code className="block mt-1.5 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.04] text-[10px] mono text-gray-400">
              git clone your-repo && cd your-repo && npm install
            </code>
          </SimpleStep>

          <SimpleStep n={3} title="Create .env.local on the VPS">
            <p className="text-gray-500 mb-2">Create a file called <code className="px-1 py-0.5 rounded bg-white/[0.06] text-gray-400">.env.local</code> in the project folder with two lines:</p>
            <div className="space-y-1">
              <EnvLine name="PRIVATE_KEY" value="0x_from_metamask" />
              <EnvLine name="FUNDER_ADDRESS" value="0x_from_polymarket_profile" />
            </div>
            <p className="text-[9px] text-gray-600 mt-2">
              Private key: MetaMask &rarr; Account &rarr; Export Private Key<br />
              Funder address: polymarket.com &rarr; Profile &rarr; your wallet address
            </p>
          </SimpleStep>

          <SimpleStep n={4} title="Start the bot">
            <code className="block mt-1.5 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.04] text-[10px] mono text-gray-400">
              npm run build && npm start
            </code>
          </SimpleStep>

          <SimpleStep n={5} title="Test & switch to Live">
            Hit the button below, check everything is green, then go to Settings &rarr; Trading Mode &rarr; Live.
          </SimpleStep>
        </div>
      </div>

      {/* Test button */}
      <button onClick={runTest} disabled={testing}
        className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all duration-300 ${
          testing
            ? "bg-white/[0.04] text-gray-500 border border-white/[0.06] cursor-wait"
            : "bg-blue-500/[0.08] text-blue-400 border border-blue-500/15 hover:bg-blue-500/[0.12]"
        }`}
      >
        {testing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Testing...
          </span>
        ) : data ? "Re-test" : "Test Connections"}
      </button>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/10">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-2">
          {stepOrder.map((key, i) => {
            const step = data.steps[key];
            if (!step) return null;
            return (
              <div key={key} className={`flex items-start gap-3 p-3 rounded-xl border ${
                step.ok ? "bg-emerald-500/[0.02] border-emerald-500/10" : "bg-white/[0.015] border-white/[0.04]"
              }`}>
                {step.ok ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-gray-600 font-bold">{i + 1}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-gray-200">{step.label}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5 break-all">{step.detail}</p>
                </div>
              </div>
            );
          })}

          {/* Status */}
          <div className={`p-4 rounded-xl border text-center ${
            data.readyForLive ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-white/[0.015] border-white/[0.06]"
          }`}>
            {data.readyForLive ? (
              <>
                <p className="text-[13px] font-semibold text-emerald-400">Ready for Live Trading</p>
                <p className="text-[11px] text-gray-500 mt-1">Go to Settings &rarr; Trading Mode &rarr; type CONFIRM</p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-gray-400">Not Ready</p>
                <p className="text-[11px] text-gray-600 mt-1">Fix the failing steps, then re-test</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[9px] font-bold text-blue-400">{n}</span>
      </div>
      <div className="flex-1">
        <p className="text-[12px] font-medium text-gray-200 mb-1">{title}</p>
        <div className="text-[10px] text-gray-500 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function EnvLine({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-black/30 border border-white/[0.04] mono text-[10px]">
      <span className="text-blue-400">{name}</span>
      <span className="text-gray-600">=</span>
      <span className="text-gray-400">{value}</span>
    </div>
  );
}
