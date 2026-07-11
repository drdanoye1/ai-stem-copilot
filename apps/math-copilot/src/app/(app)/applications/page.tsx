"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import katex from "katex";
import { mathApi, getErrorMessage, type Application } from "@/lib/api";
import { MathOutput } from "@/components/MathOutput";
import { ReformulateBar } from "@/components/ReformulateBar";
import {
  Globe, Loader2, ChevronDown, Sparkles,
  GraduationCap, FlaskConical, BarChart3,
  Cpu, Heart, TrendingUp, Atom, TreePine, Building2,
  Music, Dumbbell, Star, ChevronRight, Lightbulb, Camera,
} from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";

/** Renders a LaTeX formula (with or without $ delimiters) as display math */
function Formula({ text }: { text: string }) {
  let expr = text.trim();
  if (expr.startsWith("$$") && expr.endsWith("$$")) {
    expr = expr.slice(2, -2).trim();
  } else if (expr.startsWith("$") && expr.endsWith("$")) {
    expr = expr.slice(1, -1).trim();
  }
  try {
    const html = katex.renderToString(expr, { displayMode: true, throwOnError: false });
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <code className="font-mono text-sm">{text}</code>;
  }
}

const ICON_MAP: Record<string, React.ReactNode> = {
  engineering:      <Cpu className="w-4 h-4" />,
  medicine:         <Heart className="w-4 h-4" />,
  finance:          <TrendingUp className="w-4 h-4" />,
  physics:          <Atom className="w-4 h-4" />,
  computer_science: <Cpu className="w-4 h-4" />,
  environment:      <TreePine className="w-4 h-4" />,
  architecture:     <Building2 className="w-4 h-4" />,
  music:            <Music className="w-4 h-4" />,
  sports:           <Dumbbell className="w-4 h-4" />,
  astronomy:        <Star className="w-4 h-4" />,
};

const FIELD_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  engineering:      { bg: "rgba(34,211,238,0.08)",  color: "#22d3ee", border: "rgba(34,211,238,0.20)"  },
  medicine:         { bg: "rgba(251,113,133,0.08)", color: "#fb7185", border: "rgba(251,113,133,0.20)" },
  finance:          { bg: "rgba(52,211,153,0.08)",  color: "#34d399", border: "rgba(52,211,153,0.20)"  },
  physics:          { bg: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "rgba(167,139,250,0.20)" },
  computer_science: { bg: "rgba(99,102,241,0.08)",  color: "#818cf8", border: "rgba(99,102,241,0.20)"  },
  environment:      { bg: "rgba(52,211,153,0.08)",  color: "#34d399", border: "rgba(52,211,153,0.20)"  },
  architecture:     { bg: "rgba(251,191,36,0.08)",  color: "#fbbf24", border: "rgba(251,191,36,0.20)"  },
  music:            { bg: "rgba(251,191,36,0.08)",  color: "#fbbf24", border: "rgba(251,191,36,0.20)"  },
  sports:           { bg: "rgba(251,113,133,0.08)", color: "#fb7185", border: "rgba(251,113,133,0.20)" },
  astronomy:        { bg: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "rgba(167,139,250,0.20)" },
};
const DEFAULT_COLOR = { bg: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "rgba(255,255,255,0.10)" };

const EXAMPLES = [
  // General
  { cat: "General",    subject: "calculus",                topic: "Differential Equations in Medicine" },
  { cat: "General",    subject: "statistics",              topic: "Linear Regression in Machine Learning" },
  { cat: "General",    subject: "linear_algebra",          topic: "Matrix Transformations in Computer Graphics" },
  { cat: "General",    subject: "calculus",                topic: "Fourier Series in Signal Processing" },
  { cat: "General",    subject: "statistics",              topic: "Probability Theory in Finance & Insurance" },
  { cat: "General",    subject: "algebra",                 topic: "Cryptography and Number Theory" },

  // Mechanical Engineering
  { cat: "Mechanical", subject: "differential_equations",  topic: "Vibration Analysis of Mechanical Systems" },
  { cat: "Mechanical", subject: "calculus",                topic: "Stress-Strain Analysis and Hooke's Law" },
  { cat: "Mechanical", subject: "differential_equations",  topic: "Heat Conduction and Fourier's Law" },
  { cat: "Mechanical", subject: "calculus",                topic: "Fluid Mechanics and Navier-Stokes Equations" },
  { cat: "Mechanical", subject: "linear_algebra",          topic: "Finite Element Analysis in Structural Design" },

  // Electrical Engineering
  { cat: "Electrical", subject: "differential_equations",  topic: "RLC Circuit Analysis and Impedance" },
  { cat: "Electrical", subject: "calculus",                topic: "Laplace Transform in Control Systems" },
  { cat: "Electrical", subject: "linear_algebra",          topic: "Power Flow Analysis in Electrical Grids" },
  { cat: "Electrical", subject: "calculus",                topic: "Maxwell's Equations and Electromagnetism" },
  { cat: "Electrical", subject: "differential_equations",  topic: "Transmission Line Theory and Wave Equations" },

  // Electronic Engineering
  { cat: "Electronic", subject: "calculus",                topic: "Transistor Characteristics and Load Lines" },
  { cat: "Electronic", subject: "discrete_math",           topic: "Digital Signal Processing and Z-Transforms" },
  { cat: "Electronic", subject: "differential_equations",  topic: "PID Control Systems Design" },
  { cat: "Electronic", subject: "statistics",              topic: "Noise Analysis and Signal-to-Noise Ratio" },
  { cat: "Electronic", subject: "calculus",                topic: "Operational Amplifier Feedback Analysis" },

  // Chemical Engineering
  { cat: "Chemical",   subject: "differential_equations",  topic: "Chemical Reaction Kinetics and Rate Laws" },
  { cat: "Chemical",   subject: "calculus",                topic: "Mass Balance in Distillation Columns" },
  { cat: "Chemical",   subject: "differential_equations",  topic: "Diffusion, Mass Transfer, and Fick's Law" },
  { cat: "Chemical",   subject: "calculus",                topic: "Thermodynamics of Chemical Processes" },
  { cat: "Chemical",   subject: "statistics",              topic: "Process Control and Statistical Quality Control" },

  // Civil Engineering
  { cat: "Civil",      subject: "linear_algebra",          topic: "Structural Analysis using Stiffness Matrix" },
  { cat: "Civil",      subject: "calculus",                topic: "Fluid Flow in Pipes and Bernoulli Equation" },
  { cat: "Civil",      subject: "statistics",              topic: "Geotechnical Reliability and Soil Mechanics" },
  { cat: "Civil",      subject: "differential_equations",  topic: "Seismic Wave Propagation and Earthquake Engineering" },
  { cat: "Civil",      subject: "calculus",                topic: "Traffic Flow Models and Optimization" },

  // Aerospace Engineering
  { cat: "Aerospace",  subject: "calculus",                topic: "Orbital Mechanics and Kepler's Laws" },
  { cat: "Aerospace",  subject: "differential_equations",  topic: "Flight Dynamics and Stability Analysis" },
  { cat: "Aerospace",  subject: "calculus",                topic: "Rocket Propulsion and the Tsiolkovsky Equation" },
  { cat: "Aerospace",  subject: "linear_algebra",          topic: "Attitude Control and Rotation Matrices" },
  { cat: "Aerospace",  subject: "calculus",                topic: "Aerodynamics, Lift, and Drag Forces" },

  // Nuclear Engineering
  { cat: "Nuclear",    subject: "differential_equations",  topic: "Neutron Diffusion and Transport Equations" },
  { cat: "Nuclear",    subject: "calculus",                topic: "Radioactive Decay Chains and Half-Life" },
  { cat: "Nuclear",    subject: "linear_algebra",          topic: "Nuclear Reactor Criticality Analysis" },
  { cat: "Nuclear",    subject: "statistics",              topic: "Monte Carlo Methods in Radiation Shielding" },
  { cat: "Nuclear",    subject: "differential_equations",  topic: "Thermal-Hydraulics in Reactor Cooling Systems" },

  // Nano Engineering
  { cat: "Nano",       subject: "calculus",                topic: "Surface Energy and Thermodynamics at the Nanoscale" },
  { cat: "Nano",       subject: "statistics",              topic: "Stochastic Processes in Nanoscale Systems" },
  { cat: "Nano",       subject: "calculus",                topic: "Quantum Confinement in Nanostructures" },
  { cat: "Nano",       subject: "differential_equations",  topic: "Brownian Motion and Diffusion in Nanofluids" },
  { cat: "Nano",       subject: "calculus",                topic: "Van der Waals Forces and Nanotribology" },

  // Quantum Engineering
  { cat: "Quantum",    subject: "differential_equations",  topic: "Schrödinger Equation and Wave Functions" },
  { cat: "Quantum",    subject: "linear_algebra",          topic: "Quantum Gates, Qubits, and Unitary Matrices" },
  { cat: "Quantum",    subject: "differential_equations",  topic: "Quantum Harmonic Oscillator" },
  { cat: "Quantum",    subject: "linear_algebra",          topic: "Density Matrix and Quantum Entanglement" },
  { cat: "Quantum",    subject: "statistics",              topic: "Quantum Probability and Measurement Theory" },
];

const CATEGORIES = [
  { id: "All",        color: "#818cf8" },
  { id: "General",    color: "#818cf8" },
  { id: "Mechanical", color: "#f97316" },
  { id: "Electrical", color: "#facc15" },
  { id: "Electronic", color: "#22d3ee" },
  { id: "Chemical",   color: "#34d399" },
  { id: "Civil",      color: "#a78bfa" },
  { id: "Aerospace",  color: "#60a5fa" },
  { id: "Nuclear",    color: "#f43f5e" },
  { id: "Nano",       color: "#c084fc" },
  { id: "Quantum",    color: "#38bdf8" },
];

const LEVELS = [
  { value: "middle_school", label: "Middle School" }, { value: "high_school", label: "High School" },
  { value: "ap_ib", label: "AP / IB" }, { value: "community_college", label: "Community College" },
  { value: "university", label: "University" }, { value: "graduate", label: "Graduate" },
];
const SUBJECTS = [
  { value: "algebra", label: "Algebra" }, { value: "calculus", label: "Calculus" },
  { value: "statistics", label: "Statistics" }, { value: "geometry", label: "Geometry" },
  { value: "trigonometry", label: "Trigonometry" }, { value: "precalculus", label: "Pre-Calculus" },
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

function AppCard({ app, index }: { app: Application; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const c = FIELD_COLORS[app.icon?.toLowerCase()] ?? DEFAULT_COLOR;
  const icon = ICON_MAP[app.icon?.toLowerCase()] ?? <Globe className="w-4 h-4" />;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "var(--bg-surface)", border: open ? `1px solid ${c.border}` : "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header */}
      <button className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#f1f5f9" }}>{app.title}</p>
            <p className="text-[11px]" style={{ color: c.color }}>{app.field}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform" style={{
          color: "#475569", transform: open ? "rotate(90deg)" : "rotate(0deg)"
        }} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Problem */}
          <div className="pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#475569" }}>The Problem</p>
            <div className="text-sm math-output [&_p]:mb-0 [&_p]:leading-7" style={{ color: "#94a3b8" }}>
              <MathOutput content={app.problem} />
            </div>
          </div>

          {/* Math connection */}
          <div className="rounded-xl p-3.5"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: c.color }}>
              How the Math is Applied
            </p>
            <div className="text-sm [&_p]:mb-0 [&_p]:leading-7" style={{ color: "#94a3b8" }}>
              <MathOutput content={app.math_connection} />
            </div>
          </div>

          {/* Formula */}
          {app.formula && (
            <div className="rounded-xl px-4 py-4 text-center overflow-x-auto"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
              <Formula text={app.formula} />
            </div>
          )}

          {/* Example */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#475569" }}>Concrete Example</p>
            <div className="text-sm [&_p]:mb-0 [&_p]:leading-7" style={{ color: "#94a3b8" }}>
              <MathOutput content={app.example} />
            </div>
          </div>

          {/* Careers */}
          {app.careers?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#475569" }}>Career Paths</p>
              <div className="flex flex-wrap gap-2">
                {app.careers.map((career, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                    {career}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const searchParams = useSearchParams();
  const [topic,      setTopic]      = useState(searchParams.get("topic") ?? "");
  const [subject,    setSubject]    = useState(searchParams.get("subject") ?? "algebra");
  const [level,      setLevel]      = useState(searchParams.get("level") ?? "high_school");
  const [curriculum, setCurriculum] = useState(searchParams.get("curriculum") ?? "general");
  const { model, setModel } = useModel();
  const [loading,    setLoading]    = useState(false);
  const [apps,       setApps]       = useState<Application[] | null>(null);
  const [topicLabel, setTopicLabel] = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState("All");
  const didAutoRun = useRef(false);

  const generate = async (t = topic) => {
    if (!t.trim()) return;
    setLoading(true); setError(null); setApps(null);
    try {
      const { data } = await mathApi.applications({ topic: t.trim(), subject, level, curriculum, model_name: model });
      setApps(data.applications);
      setTopicLabel(data.topic);
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

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <Globe className="w-4 h-4" style={{ color: "#818cf8" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#818cf8" }}>
            Applications Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Real-World Applications
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Discover where this mathematics lives in the real world — industries, careers, and concrete examples.
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
            placeholder="e.g. Calculus Derivatives, Matrix Multiplication, Probability, Fourier Transform…"
            className="input-dark w-full py-3 text-sm" />
          <ReformulateBar
            value={topic}
            subject={subject}
            level={level}
            curriculum={curriculum}
            context="applications"
            onSelect={setTopic}
            accent="#818cf8"
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
            ? <><Loader2 className="w-4 h-4 animate-spin" />Finding applications…</>
            : <><Globe className="w-4 h-4" />Find Real-World Applications</>}
        </button>
      </div>

      {/* Try an example */}
      {!apps && !loading && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
              Try an example
            </span>
          </div>

          {/* Category filter pills */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map(({ id, color }) => {
              const active = selectedCat === id;
              return (
                <button key={id}
                  onClick={() => setSelectedCat(id)}
                  className="flex-shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                  style={{
                    background: active ? `${color}20` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? color + "50" : "rgba(255,255,255,0.08)"}`,
                    color: active ? color : "#475569",
                  }}>
                  {id}
                </button>
              );
            })}
          </div>

          {/* Example cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {EXAMPLES
              .filter(ex => selectedCat === "All" || ex.cat === selectedCat)
              .map((ex, i) => {
                const catColor = CATEGORIES.find(c => c.id === ex.cat)?.color ?? "#818cf8";
                return (
                  <button key={`${ex.cat}-${i}`}
                    onClick={() => { setTopic(ex.topic); setSubject(ex.subject); }}
                    className="text-left rounded-xl px-4 py-3 transition-all duration-150"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${catColor}50`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: catColor }}>
                      {ex.cat}
                    </span>
                    <p className="text-xs mt-1" style={{ color: "#64748b" }}>{ex.topic}</p>
                  </button>
                );
              })}
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

      {/* Applications */}
      {apps && apps.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#818cf8" }}>
              Applications of
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.10)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.20)" }}>
              {topicLabel}
            </span>
          </div>

          {apps.map((app, i) => <AppCard key={i} app={app} index={i} />)}

          {/* Bottom action bar */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#818cf8" }} />
              AI Mathematics Copilot™ Applications Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/theory?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <GraduationCap className="w-3.5 h-3.5" />Theory
              </a>
              <a href={`/simulation?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.22)", color: "#34d399" }}>
                <FlaskConical className="w-3.5 h-3.5" />Simulate
              </a>
              <a href={`/visualization?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.22)", color: "#22d3ee" }}>
                <BarChart3 className="w-3.5 h-3.5" />Visualize
              </a>
              <a href={`/scenario?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.22)", color: "#f97316" }}>
                <Camera className="w-3.5 h-3.5" />Scenario
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
