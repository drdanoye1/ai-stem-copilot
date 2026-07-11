"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";
import { mathApi, getErrorMessage, type SimulateResponse, type SimParam } from "@/lib/api";
import { sampleWithParams } from "@/components/viz/mathEval";
import { MathOutput } from "@/components/MathOutput";
import { ReformulateBar } from "@/components/ReformulateBar";
import {
  FlaskConical, Loader2, ChevronDown, Sparkles, Lightbulb,
  BarChart3, GraduationCap,
} from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";

const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then(m => m.default),
  { ssr: false, loading: () => (
    <div className="animate-pulse rounded-xl" style={{ height: 320, background: "rgba(255,255,255,0.03)" }} />
  )}
);

const EXAMPLES = [
  { subject: "calculus",     topic: "Exponential Growth and Decay" },
  { subject: "calculus",     topic: "Logistic Growth Model" },
  { subject: "algebra",      topic: "Sine Wave Amplitude and Frequency" },
  { subject: "calculus",     topic: "Damped Harmonic Oscillator" },
  { subject: "statistics",   topic: "Central Limit Theorem Simulation" },
  { subject: "calculus",     topic: "Projectile Motion with Gravity" },
];

const LEVELS = [
  { value: "middle_school", label: "Middle School" }, { value: "high_school", label: "High School" },
  { value: "ap_ib", label: "AP / IB" }, { value: "community_college", label: "Community College" },
  { value: "university", label: "University" }, { value: "graduate", label: "Graduate" },
];
const SUBJECTS = [
  { value: "algebra", label: "Algebra" }, { value: "calculus", label: "Calculus" },
  { value: "trigonometry", label: "Trigonometry" }, { value: "statistics", label: "Statistics" },
  { value: "geometry", label: "Geometry" }, { value: "precalculus", label: "Pre-Calculus" },
  { value: "linear_algebra", label: "Linear Algebra" },
  { value: "differential_equations", label: "Differential Equations" }, { value: "other", label: "Other" },
];
const CURRICULA = [
  { value: "general", label: "General" }, { value: "waec", label: "WAEC" },
  { value: "cambridge", label: "Cambridge" }, { value: "ib", label: "IB" },
  { value: "ap", label: "AP" }, { value: "gcse", label: "GCSE" },
];

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="input-dark w-full appearance-none pr-8 py-2 text-xs">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "#475569" }} />
      </div>
    </div>
  );
}

function ParamSlider({
  param, value, onChange,
}: { param: SimParam; value: number; onChange: (v: number) => void }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{param.label}</span>
          <span className="ml-2 text-xs font-mono" style={{ color: "#64748b" }}>({param.name})</span>
        </div>
        <span className="text-sm font-bold font-mono px-2.5 py-1 rounded-lg"
          style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.20)" }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #22d3ee ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
          outline: "none",
        }}
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: "#334155" }}>{param.min}</span>
        <span className="text-[10px]" style={{ color: "#334155" }}>{param.max}</span>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const searchParams = useSearchParams();
  const [topic,      setTopic]      = useState(searchParams.get("topic") ?? "");
  const [subject,    setSubject]    = useState(searchParams.get("subject") ?? "algebra");
  const [level,      setLevel]      = useState(searchParams.get("level") ?? "high_school");
  const [curriculum, setCurriculum] = useState(searchParams.get("curriculum") ?? "general");
  const { model, setModel } = useModel();
  const [loading,    setLoading]    = useState(false);
  const [sim,        setSim]        = useState<SimulateResponse | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [paramVals,  setParamVals]  = useState<Record<string, number>>({});
  const didAutoRun = useRef(false);

  const generate = async (t = topic) => {
    if (!t.trim()) return;
    setLoading(true); setError(null); setSim(null);
    try {
      const { data } = await mathApi.simulate({ topic: t.trim(), subject, level, curriculum, model_name: model });
      setSim(data);
      const defaults: Record<string, number> = {};
      data.parameters.forEach(p => { defaults[p.name] = p.default; });
      setParamVals(defaults);
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (topic.trim() && !didAutoRun.current) {
      didAutoRun.current = true;
      generate(topic);
    }
  }, []);

  const setParam = useCallback((name: string, val: number) => {
    setParamVals(prev => ({ ...prev, [name]: val }));
  }, []);

  const plotData: PlotParams["data"] = useMemo(() => {
    if (!sim) return [];
    const xMin = sim.x_range?.[0] ?? -10;
    const xMax = sim.x_range?.[1] ?? 10;
    const { x, y } = sampleWithParams(sim.expression, xMin, xMax, paramVals, 500);
    return [{
      x, y,
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "#22d3ee", width: 2.5 },
      name: sim.topic,
      hovertemplate: "x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>",
    }];
  }, [sim, paramVals]);

  const plotLayout: PlotParams["layout"] = useMemo(() => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,255,255,0.03)",
    font: { color: "#94a3b8", family: "Arial", size: 11 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)", zerolinecolor: "rgba(255,255,255,0.15)",
             tickfont: { color: "#64748b", size: 10 } },
    yaxis: { gridcolor: "rgba(255,255,255,0.06)", zerolinecolor: "rgba(255,255,255,0.15)",
             tickfont: { color: "#64748b", size: 10 }, title: { text: sim?.y_label ?? "f(x)", font: { color: "#64748b" } } },
    margin: { t: 20, r: 20, b: 40, l: 55 },
    hovermode: "x unified" as const,
    autosize: true,
  }), [sim?.y_label]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}>
            <FlaskConical className="w-4 h-4" style={{ color: "#34d399" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#34d399" }}>
            Simulation Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Interactive Math Simulator
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Adjust parameters with live sliders and watch the mathematical relationship transform in real time.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
            Mathematical Topic
          </label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
            placeholder="e.g. Sine Wave, Quadratic Function, Exponential Growth, Spring Oscillation…"
            className="input-dark w-full py-3 text-sm" />
          <ReformulateBar
            value={topic}
            subject={subject}
            level={level}
            curriculum={curriculum}
            context="simulation"
            onSelect={setTopic}
            accent="#34d399"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <Select label="Subject"    value={subject}    onChange={setSubject}    options={SUBJECTS}  />
          <Select label="Level"      value={level}      onChange={setLevel}      options={LEVELS}    />
          <Select label="Curriculum" value={curriculum} onChange={setCurriculum} options={CURRICULA} />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>AI Model</label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
        </div>
        <button onClick={() => generate()} disabled={loading || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Building simulation…</>
            : <><FlaskConical className="w-4 h-4" />Build Simulation</>}
        </button>
      </div>

      {/* Try an example */}
      {!sim && !loading && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
              Try an example
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {EXAMPLES.map((ex, i) => (
              <button key={i}
                onClick={() => { setTopic(ex.topic); setSubject(ex.subject); }}
                className="text-left rounded-xl px-4 py-3 transition-all duration-150"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.30)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#34d399" }}>
                  {ex.subject.replace(/_/g, " ")}
                </span>
                <p className="text-xs mt-1" style={{ color: "#64748b" }}>{ex.topic}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-5 text-sm flex gap-2"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#fca5a5" }}>
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* Simulation */}
      {sim && (
        <div className="space-y-5 animate-slide-up">
          {/* Description + key insight */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#34d399" }}>
              {sim.topic}
            </p>
            <div className="text-sm mb-4 [&_p]:mb-0 [&_p]:leading-7" style={{ color: "#94a3b8" }}>
              <MathOutput content={sim.description} />
            </div>
            {sim.key_insight && (
              <div className="flex items-start gap-2.5 rounded-xl p-3"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
                <div className="text-xs [&_p]:mb-0 [&_p]:text-xs [&_p]:leading-relaxed" style={{ color: "#fbbf24" }}>
                  <strong>Key Insight: </strong>
                  <MathOutput content={sim.key_insight} />
                </div>
              </div>
            )}
          </div>

          {/* Live chart + sliders */}
          <div className="grid lg:grid-cols-[1fr_280px] gap-5">
            {/* Chart */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid rgba(34,211,238,0.12)" }}>
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium" style={{ color: "#64748b" }}>
                  Live — updates as you move sliders
                </span>
              </div>
              <Plot data={plotData} layout={plotLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "340px" }}
                useResizeHandler />
            </div>

            {/* Sliders */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
                Parameters
              </p>
              {sim.parameters.map(p => (
                <ParamSlider key={p.name} param={p} value={paramVals[p.name] ?? p.default}
                  onChange={v => setParam(p.name, v)} />
              ))}

              {/* What to observe */}
              {sim.what_to_observe?.length > 0 && (
                <div className="rounded-xl p-3 mt-4"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#475569" }}>
                    What to Observe
                  </p>
                  {sim.what_to_observe.map((obs, i) => (
                    <div key={i} className="mb-2 last:mb-0">
                      <span className="text-[10px] font-bold font-mono" style={{ color: "#22d3ee" }}>
                        {obs.parameter}
                      </span>
                      <div className="text-[11px] mt-0.5 [&_p]:mb-0 [&_p]:text-[11px] [&_p]:leading-snug" style={{ color: "#64748b" }}>
                        <MathOutput content={obs.effect} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reset */}
              <button
                onClick={() => {
                  const d: Record<string, number> = {};
                  sim.parameters.forEach(p => { d[p.name] = p.default; });
                  setParamVals(d);
                }}
                className="w-full py-2 text-xs rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                Reset to defaults
              </button>
            </div>
          </div>

          {/* Bottom links */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
              AI Mathematics Copilot™ Simulation Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/theory?topic=${encodeURIComponent(sim.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <GraduationCap className="w-3.5 h-3.5" />Theory
              </a>
              <a href={`/visualization?topic=${encodeURIComponent(sim.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.22)", color: "#22d3ee" }}>
                <BarChart3 className="w-3.5 h-3.5" />Visualize
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
