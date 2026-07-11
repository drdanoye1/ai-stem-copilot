"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { mathApi, getErrorMessage, type ScenarioResponse } from "@/lib/api";
import {
  Camera, Loader2, ChevronDown, Sparkles, Lightbulb,
  GraduationCap, BarChart3, FlaskConical, Globe, AlertCircle,
  ZoomIn, Download,
} from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { cat: "Mechanical",  subject: "differential_equations", topic: "Fatigue Failure in Aircraft Wings" },
  { cat: "Electrical",  subject: "differential_equations", topic: "Power Grid Surge and Voltage Regulation" },
  { cat: "Chemical",    subject: "differential_equations", topic: "Runaway Reaction in a Chemical Reactor" },
  { cat: "Civil",       subject: "linear_algebra",         topic: "Bridge Load Distribution and Structural Failure" },
  { cat: "Aerospace",   subject: "calculus",               topic: "Orbital Decay and Re-entry Trajectory" },
  { cat: "Nuclear",     subject: "differential_equations", topic: "Reactor Coolant Loss and Core Meltdown Prevention" },
  { cat: "Quantum",     subject: "linear_algebra",         topic: "Qubit Decoherence and Quantum Error Correction" },
  { cat: "Nano",        subject: "calculus",               topic: "Nanoparticle Drug Delivery Targeting" },
  { cat: "Electronic",  subject: "calculus",               topic: "Transistor Breakdown and Signal Amplification" },
  { cat: "General",     subject: "calculus",               topic: "Epidemic Growth and Intervention Modelling" },
  { cat: "General",     subject: "statistics",             topic: "Climate Change and Temperature Anomaly Detection" },
  { cat: "Mechanical",  subject: "calculus",               topic: "Heat Exchanger Fouling and Thermal Efficiency" },
];

const CAT_COLORS: Record<string, string> = {
  General:    "#818cf8",
  Mechanical: "#f97316",
  Electrical: "#facc15",
  Electronic: "#22d3ee",
  Chemical:   "#34d399",
  Civil:      "#a78bfa",
  Aerospace:  "#60a5fa",
  Nuclear:    "#f43f5e",
  Nano:       "#c084fc",
  Quantum:    "#38bdf8",
};

const LEVELS = [
  { value: "middle_school",     label: "Middle School"     },
  { value: "high_school",       label: "High School"       },
  { value: "ap_ib",             label: "AP / IB"           },
  { value: "community_college", label: "Community College" },
  { value: "university",        label: "University"        },
  { value: "graduate",          label: "Graduate"          },
];
const SUBJECTS = [
  { value: "algebra",                label: "Algebra"                  },
  { value: "calculus",               label: "Calculus"                 },
  { value: "statistics",             label: "Statistics & Probability" },
  { value: "geometry",               label: "Geometry"                 },
  { value: "trigonometry",           label: "Trigonometry"             },
  { value: "linear_algebra",         label: "Linear Algebra"           },
  { value: "differential_equations", label: "Differential Equations"   },
  { value: "precalculus",            label: "Pre-Calculus"             },
  { value: "discrete_math",          label: "Discrete Mathematics"     },
  { value: "other",                  label: "Other"                    },
];
const CURRICULA = [
  { value: "general",    label: "General"    },
  { value: "waec",       label: "WAEC"       },
  { value: "cambridge",  label: "Cambridge"  },
  { value: "ib",         label: "IB"         },
  { value: "ap",         label: "AP"         },
  { value: "gcse",       label: "GCSE"       },
];
const IMAGE_MODELS = [
  { value: "dall-e-3",     label: "DALL-E 3 (Premium)"   },
  { value: "gpt-image-1",  label: "GPT-Image-1 (Latest)" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
        {label}
      </label>
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

function ImageSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="aspect-square w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="p-4 space-y-2">
        <div className="h-3 rounded w-1/3" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="h-2.5 rounded w-3/4" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="h-2.5 rounded w-1/2" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
    </div>
  );
}

function ScenarioImage({
  url, label, description, accent,
}: {
  url: string; label: string; description: string; accent: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div className="rounded-2xl overflow-hidden transition-all"
        style={{ background: "var(--bg-surface)", border: `1px solid ${accent}30` }}>
        {/* Label badge */}
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: `1px solid ${accent}20`, background: `${accent}08` }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
            {label}
          </span>
          {url && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomed(true)}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
                title="View full size">
                <ZoomIn className="w-3 h-3" style={{ color: accent }} />
              </button>
              <a href={url} download target="_blank" rel="noreferrer"
                className="w-6 h-6 rounded-md flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <Download className="w-3 h-3" style={{ color: accent }} />
              </a>
            </div>
          )}
        </div>

        {/* Image or placeholder when image unavailable */}
        {url ? (
          <div className="relative aspect-square w-full overflow-hidden cursor-zoom-in"
            onClick={() => setZoomed(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          </div>
        ) : (
          <div className="aspect-square w-full flex flex-col items-center justify-center gap-3"
            style={{ background: `${accent}06`, borderTop: `1px solid ${accent}15` }}>
            <Camera className="w-10 h-10 opacity-20" style={{ color: accent }} />
            <p className="text-xs text-center px-6" style={{ color: "#475569" }}>
              Image generation unavailable.<br />
              Add OpenAI credits to enable DALL-E images.
            </p>
          </div>
        )}

        {/* Description */}
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{description}</p>
        </div>
      </div>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setZoomed(false)}>
          <div className="max-w-3xl w-full relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>
                {label}
              </span>
              <button onClick={() => setZoomed(false)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="w-full rounded-xl" />
            <p className="text-xs mt-3 text-center" style={{ color: "#64748b" }}>{description}</p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScenarioPage() {
  const params = useSearchParams();
  const [topic,      setTopic]      = useState(params.get("topic")      ?? "");
  const [subject,    setSubject]    = useState(params.get("subject")    ?? "calculus");
  const [level,      setLevel]      = useState(params.get("level")      ?? "high_school");
  const [curriculum, setCurriculum] = useState(params.get("curriculum") ?? "general");
  const { model, setModel } = useModel();
  const [imageModel,  setImageModel]  = useState("dall-e-3");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<ScenarioResponse | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const didAutoRun = useRef(false);

  const generate = async (t = topic) => {
    if (!t.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await mathApi.scenario({
        topic: t.trim(), subject, level, curriculum, model_name: model, image_model: imageModel,
      });
      setResult(data);
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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}>
            <Camera className="w-4 h-4" style={{ color: "#f97316" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
            Scenario Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Problem &amp; Solution Visualizer
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          See the real-world problem your mathematics solves — and what success looks like — as photorealistic scenes.
        </p>
      </div>

      {/* ── Input card ── */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
            Mathematical Topic or Engineering Problem
          </label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
            placeholder="e.g. Fatigue Failure in Aircraft Wings, Epidemic Growth Modelling, Reactor Criticality…"
            className="input-dark w-full py-3 text-sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          <Select label="Subject"      value={subject}     onChange={setSubject}     options={SUBJECTS}      />
          <Select label="Level"        value={level}       onChange={setLevel}       options={LEVELS}        />
          <Select label="Curriculum"   value={curriculum}  onChange={setCurriculum}  options={CURRICULA}     />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>AI Model</label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
          <Select label="Image Model"  value={imageModel}  onChange={setImageModel}  options={IMAGE_MODELS}  />
        </div>

        {/* Cost notice */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4"
          style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)" }}>
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#f97316" }} />
          <p className="text-[11px]" style={{ color: "#94a3b8" }}>
            Generates <strong style={{ color: "#f97316" }}>2 photorealistic images</strong> via{" "}
            <strong style={{ color: "#f97316" }}>
              {IMAGE_MODELS.find(m => m.value === imageModel)?.label ?? imageModel}
            </strong>.
            
            {" "}Each generation uses additional AI credits.
          </p>
        </div>

        <button onClick={() => generate()} disabled={loading || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generating scenario…</>
            : <><Camera className="w-4 h-4" />Visualize Scenario</>}
        </button>
      </div>

      {/* ── Try an example ── */}
      {!result && !loading && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
              Try an example
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {EXAMPLES.map((ex, i) => {
              const color = CAT_COLORS[ex.cat] ?? "#818cf8";
              return (
                <button key={i}
                  onClick={() => { setTopic(ex.topic); setSubject(ex.subject); }}
                  className="text-left rounded-xl px-4 py-3 transition-all duration-150"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}50`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                    {ex.cat}
                  </span>
                  <p className="text-xs mt-1" style={{ color: "#64748b" }}>{ex.topic}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl p-4 mb-5 flex items-start gap-3"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#f87171" }} />
          <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#f97316" }} />
            <span className="text-sm" style={{ color: "#475569" }}>
              Crafting image prompts, then generating both scenes in parallel…
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <ImageSkeleton />
            <ImageSkeleton />
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="animate-slide-up space-y-6">
          {/* Topic label */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
              Scenario
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(249,115,22,0.10)", color: "#f97316", border: "1px solid rgba(249,115,22,0.20)" }}>
              {result.topic}
            </span>
          </div>

          {/* Side-by-side images */}
          <div className="grid sm:grid-cols-2 gap-5">
            <ScenarioImage
              url={result.problem_image_url}
              label="The Problem"
              description={result.problem_description}
              accent="#f43f5e"
            />
            <ScenarioImage
              url={result.solution_image_url}
              label="The Solution"
              description={result.solution_description}
              accent="#34d399"
            />
          </div>

          {/* Prompt transparency panel */}
          <details className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <summary className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest cursor-pointer select-none"
              style={{ color: "#334155" }}>
              View DALL-E Prompts
            </summary>
            <div className="px-4 pb-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#f43f5e" }}>Problem Prompt</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "#64748b" }}>{result.problem_prompt}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#34d399" }}>Solution Prompt</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "#64748b" }}>{result.solution_prompt}</p>
              </div>
            </div>
          </details>

          {/* Regenerate button */}
          <button onClick={() => generate()}
            className="btn-primary w-full py-2.5 text-sm font-semibold">
            <Camera className="w-4 h-4" />
            Regenerate Scenario
          </button>

          {/* ── Bottom action bar ── */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
              AI Mathematics Copilot™ Scenario Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/theory?topic=${encodeURIComponent(result.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <GraduationCap className="w-3.5 h-3.5" />Theory
              </a>
              <a href={`/visualization?topic=${encodeURIComponent(result.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.22)", color: "#22d3ee" }}>
                <BarChart3 className="w-3.5 h-3.5" />Visualize
              </a>
              <a href={`/simulation?topic=${encodeURIComponent(result.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.22)", color: "#34d399" }}>
                <FlaskConical className="w-3.5 h-3.5" />Simulate
              </a>
              <a href={`/applications?topic=${encodeURIComponent(result.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)", color: "#818cf8" }}>
                <Globe className="w-3.5 h-3.5" />Applications
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
