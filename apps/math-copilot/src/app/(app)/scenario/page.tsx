"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { mathApi, getErrorMessage, type ScenarioResponse } from "@/lib/api";
import {
  Camera, Loader2, ChevronDown, Sparkles, AlertTriangle,
  CheckCircle2, BookOpen, FlaskConical, ZoomIn,
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
  General:    "#818cf8", Mechanical: "#f97316", Electrical: "#facc15",
  Electronic: "#22d3ee", Chemical:   "#34d399", Civil:      "#a78bfa",
  Aerospace:  "#60a5fa", Nuclear:    "#f43f5e", Nano:       "#c084fc",
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
  { value: "general",   label: "General"   },
  { value: "waec",      label: "WAEC"      },
  { value: "cambridge", label: "Cambridge" },
  { value: "ib",        label: "IB"        },
  { value: "ap",        label: "AP"        },
  { value: "gcse",      label: "GCSE"      },
];

const IMAGE_MODELS = [
  { value: "gpt-image-1", label: "GPT-Image-1" },
  { value: "dall-e-3",    label: "DALL-E 3"    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "#475569" }}>{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="input-dark w-full appearance-none pr-8 py-2 text-xs">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
          style={{ color: "#475569" }} />
      </div>
    </div>
  );
}

function ScenarioSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      {[0, 1].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="aspect-video w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="p-5 space-y-3">
            <div className="h-4 rounded w-3/4" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-3 rounded w-full" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-3 rounded w-5/6" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioCard({
  imageUrl, title, subtitle, description, accent, icon: Icon, footerLabel,
}: {
  imageUrl: string; title: string; subtitle: string; description: string;
  accent: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  footerLabel: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-surface)", border: `1px solid ${accent}30` }}>

        {/* Header */}
        <div className="flex items-start gap-2.5 px-5 py-3"
          style={{ background: `${accent}08`, borderBottom: `1px solid ${accent}20` }}>
          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>{title}</p>
            {subtitle && (
              <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: accent, opacity: 0.75 }}>
                {subtitle}
              </p>
            )}
          </div>
          {imageUrl && (
            <button onClick={() => setZoomed(true)}
              className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
              <ZoomIn className="w-3 h-3" style={{ color: accent }} />
            </button>
          )}
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="relative w-full overflow-hidden cursor-zoom-in" style={{ aspectRatio: "16/9" }}
            onClick={() => setZoomed(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          </div>
        )}

        {/* Description */}
        <div className="p-5 flex-1">
          <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>{description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 px-5 py-2.5"
          style={{ borderTop: `1px solid ${accent}12`, background: `${accent}04` }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#475569" }}>
            {footerLabel}
          </span>
        </div>
      </div>

      {/* Lightbox */}
      {zoomed && imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setZoomed(false)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold" style={{ color: accent }}>{title}</span>
              <button onClick={() => setZoomed(false)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>Close</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} className="w-full rounded-xl" />
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
  const [level,      setLevel]      = useState(params.get("level")      ?? "university");
  const [curriculum, setCurriculum] = useState(params.get("curriculum") ?? "general");
  const [imageModel, setImageModel] = useState("gpt-image-1");
  const { model, setModel } = useModel();
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ScenarioResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = params.get("topic");   if (t) setTopic(t);
    const s = params.get("subject"); if (s) setSubject(s);
    const l = params.get("level");   if (l) setLevel(l);
  }, [params]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await mathApi.scenario({
        topic: topic.trim(), subject, level, curriculum,
        model_name: model, image_model: imageModel,
      });
      setResult(data);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.25)" }}>
            <Camera className="w-4 h-4" style={{ color: "#fb923c" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#fb923c" }}>
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

      {/* Input card */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "#475569" }}>Mathematical Topic or Engineering Problem</label>
          <input type="text" value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. Differential equations in bridge design, Fourier transforms in signal processing…"
            className="input-dark w-full py-3 text-sm" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          <Select label="Subject"      value={subject}    onChange={setSubject}    options={SUBJECTS} />
          <Select label="Level"        value={level}      onChange={setLevel}      options={LEVELS} />
          <Select label="Curriculum"   value={curriculum} onChange={setCurriculum} options={CURRICULA} />
          <Select label="Image Model"  value={imageModel} onChange={setImageModel} options={IMAGE_MODELS} />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#475569" }}>AI Model</label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-xs"
          style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.18)", color: "#94a3b8" }}>
          <Camera className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#fb923c" }} />
          Generates <strong className="mx-1 text-orange-300">2 photorealistic images</strong> via
          <strong className="mx-1 text-orange-300">{IMAGE_MODELS.find(m => m.value === imageModel)?.label}</strong>.
          Each generation uses additional AI credits.
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, rgba(251,146,60,0.25), rgba(249,115,22,0.15))",
                   border: "1px solid rgba(251,146,60,0.35)", color: "#fb923c" }}>
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generating Scenario…</>
            : <><Camera className="w-4 h-4" />Visualize Scenario</>}
        </button>
      </div>

      {/* Examples */}
      {!result && !loading && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#fb923c" }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
              Try an Example
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => { setTopic(ex.topic); setSubject(ex.subject); }}
                className="text-left px-4 py-3 rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}>
                <span className="text-[10px] font-bold uppercase tracking-widest block mb-1"
                  style={{ color: CAT_COLORS[ex.cat] ?? "#818cf8" }}>{ex.cat}</span>
                <span className="text-xs" style={{ color: "#94a3b8" }}>{ex.topic}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div ref={outputRef}><ScenarioSkeleton /></div>}

      {/* Result */}
      {result && !loading && (
        <div ref={outputRef} className="space-y-4">
          {/* Topic banner */}
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
            style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.20)" }}>
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#fb923c" }} />
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#fb923c" }}>
                Scenario Generated
              </p>
              <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{result.topic}</p>
            </div>
          </div>

          {/* Two scenario cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScenarioCard
              imageUrl={result.problem_image_url}
              title="The Problem"
              subtitle={result.problem_prompt}
              description={result.problem_description}
              accent="#f87171"
              icon={AlertTriangle}
              footerLabel="Real-world failure scenario"
            />
            <ScenarioCard
              imageUrl={result.solution_image_url}
              title="The Solution"
              subtitle={result.solution_prompt}
              description={result.solution_description}
              accent="#34d399"
              icon={CheckCircle2}
              footerLabel="Mathematics in action"
            />
          </div>

          {/* Cross-links */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Camera className="w-3.5 h-3.5" style={{ color: "#fb923c" }} />
              Scenario Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/solve?problem=${encodeURIComponent(result.problem_description)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.22)", color: "#22d3ee" }}>
                <Sparkles className="w-3 h-3" />Solve
              </a>
              <a href={`/theory?topic=${encodeURIComponent(result.topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.22)", color: "#a78bfa" }}>
                <BookOpen className="w-3 h-3" />Theory
              </a>
            </div>
          </div>

          <button onClick={() => { setResult(null); setTopic(""); }}
            className="w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569" }}>
            ← Try Another Scenario
          </button>
        </div>
      )}
    </div>
  );
}
