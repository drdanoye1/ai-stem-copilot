"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { mathApi, type VizCard } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LEVELS, CURRICULUM_CATEGORIES, CURRICULUM_REGISTRY, curriculumLabel } from "@/lib/personalization-taxonomy";
import { GroupedSelect } from "@/components/GroupedSelect";
import { VizRenderer } from "@/components/viz";
import { ReformulateBar } from "@/components/ReformulateBar";
import { BarChart3, Loader2, ChevronDown, Sparkles, ChevronRight, GraduationCap, FlaskConical, Globe, Lightbulb } from "lucide-react";
import { ModelSelector, useAiMode } from "@/components/ModelSelector";

const EXAMPLES = [
  { subject: "algebra",        topic: "Quadratic Functions and Their Transformations" },
  { subject: "statistics",     topic: "Normal Distribution and the Empirical Rule" },
  { subject: "calculus",       topic: "Derivatives as Slopes of Tangent Lines" },
  { subject: "trigonometry",   topic: "Unit Circle and Trigonometric Functions" },
  { subject: "linear_algebra", topic: "Linear Transformations and Eigenvectors" },
  { subject: "calculus",       topic: "Riemann Sums and Definite Integrals" },
];

const SUBJECTS = [
  { value: "algebra",                label: "Algebra"                  },
  { value: "calculus",               label: "Calculus"                 },
  { value: "geometry",               label: "Geometry"                 },
  { value: "trigonometry",           label: "Trigonometry"             },
  { value: "statistics",             label: "Statistics & Probability" },
  { value: "linear_algebra",         label: "Linear Algebra"           },
  { value: "differential_equations", label: "Differential Equations"   },
  { value: "precalculus",            label: "Pre-Calculus"             },
  { value: "discrete_math",          label: "Discrete Mathematics"     },
  { value: "number_theory",          label: "Number Theory"            },
  { value: "other",                  label: "Other"                    },
];
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

export default function VisualizationPage() {
  const params = useSearchParams();
  const { user } = useAuthStore();
  const [topic,      setTopic]      = useState(params.get("topic") ?? "");
  const [subject,    setSubject]    = useState(params.get("subject") ?? "algebra");
  const [level,      setLevel]      = useState(params.get("level") ?? "high_school");
  const [curriculum, setCurriculum] = useState(params.get("curriculum") ?? "general");
  const [curriculumTrack, setCurriculumTrack] = useState("");
  const { model, setModel } = useAiMode();
  const [loading,    setLoading]    = useState(false);
  const [charts,     setCharts]     = useState<VizCard[] | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [topicLabel, setTopicLabel] = useState("");
  const didAutoRun = useRef(false);

  // Default Level to the account's Education Level (the ground truth) once
  // it loads — but never override an explicit ?level= deep link, since that
  // reflects a deliberate choice carried over from another page.
  const appliedAccountLevelRef = useRef(false);
  useEffect(() => {
    if (!appliedAccountLevelRef.current && !params.get("level") && user?.level) {
      setLevel(user.level);
      appliedAccountLevelRef.current = true;
    }
  }, [user?.level]);

  // Seed Curriculum (+ Track) from the account's stored value once it
  // loads — but never override an explicit ?curriculum= deep link, since
  // that reflects a deliberate choice carried over from another page.
  const appliedAccountCurriculumRef = useRef(false);
  useEffect(() => {
    if (!appliedAccountCurriculumRef.current && !params.get("curriculum") && user?.curriculum) {
      setCurriculum(user.curriculum);
      setCurriculumTrack(user.curriculum_track || "");
      appliedAccountCurriculumRef.current = true;
    }
  }, [user?.curriculum, user?.curriculum_track]);

  const selectCurriculum = (value: string) => {
    setCurriculum(value);
    if (!CURRICULUM_REGISTRY[value]?.trackOptions?.includes(curriculumTrack)) {
      setCurriculumTrack("");
    }
  };
  const curriculumTrackOptions = CURRICULUM_REGISTRY[curriculum]?.trackOptions ?? null;

  const generate = async (t = topic) => {
    if (!t.trim()) return;
    setLoading(true); setError(null); setCharts(null);
    try {
      const { data } = await mathApi.visualize({ topic: t.trim(), subject, level, curriculum, curriculum_track: curriculumTrack || undefined, ai_mode: model });
      setCharts(data.charts);
      setTopicLabel(data.topic);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Visualization generation failed.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run if topic was passed via URL
  useEffect(() => {
    if (topic.trim() && !didAutoRun.current) {
      didAutoRun.current = true;
      generate(topic);
    }
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.25)" }}>
            <BarChart3 className="w-4 h-4" style={{ color: "#22d3ee" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
            Visualization Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Math Visualization Gallery
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          See any mathematical topic from multiple visual angles — functions, distributions, 3D surfaces, and geometric constructions.
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
            placeholder="e.g. Quadratic Functions, Normal Distribution, Pythagorean Theorem, Eigenvalues…"
            className="input-dark w-full py-3 text-sm" />
          <ReformulateBar
            value={topic}
            subject={subject}
            level={level}
            curriculum={curriculum}
            context="visualization"
            onSelect={setTopic}
            accent="#22d3ee"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <Select label="Subject"    value={subject}    onChange={setSubject}    options={SUBJECTS}  />
          <div>
            <Select label="Level" value={level} onChange={setLevel} options={LEVELS} />
            <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "#334155" }}>
              <span>Profile: {LEVELS.find(l => l.value === user?.level)?.label ?? "—"}</span>
              {user?.level && level !== user.level && (
                <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                  Session override
                </span>
              )}
            </p>
          </div>
          <div>
            <GroupedSelect label="Curriculum" value={curriculum} onChange={selectCurriculum} groups={CURRICULUM_CATEGORIES} />
            <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "#334155" }}>
              <span>Profile: {curriculumLabel(user?.curriculum) ?? "—"}</span>
              {user?.curriculum && curriculum !== user.curriculum && (
                <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                  Session override
                </span>
              )}
            </p>
            {curriculumTrackOptions && (
              <div className="mt-2 flex flex-wrap gap-2">
                {curriculumTrackOptions.map((t) => (
                  <button key={t} type="button" onClick={() => setCurriculumTrack(curriculumTrack === t ? "" : t)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={{
                      background: curriculumTrack === t ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${curriculumTrack === t ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: curriculumTrack === t ? "#a855f7" : "#475569",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>AI Model</label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
        </div>
        <button onClick={() => generate()} disabled={loading || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generating visualizations…</>
            : <><BarChart3 className="w-4 h-4" />Visualize {topic || "topic"}</>}
        </button>
      </div>

      {/* Try an example */}
      {!charts && !loading && (
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
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.30)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#22d3ee" }}>
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

      {/* Charts */}
      {charts && charts.length > 0 && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
              Visualization Gallery
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.20)" }}>
              {topicLabel}
            </span>
          </div>

          {charts.map((card, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              {/* Card header */}
              <div className="flex items-start gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(34,211,238,0.12)", fontSize: 11, color: "#22d3ee", fontWeight: 700 }}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{card.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{card.description}</p>
                </div>
              </div>
              {/* Chart */}
              <div className="px-5 py-5">
                <VizRenderer hint={card.hint} className="" />
              </div>
            </div>
          ))}

          {/* Bottom action bar */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
              AI Mathematics Copilot™ Visualization Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/theory?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <GraduationCap className="w-3.5 h-3.5" />Theory Lesson
              </a>
              <a href={`/simulation?topic=${encodeURIComponent(topicLabel)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.22)", color: "#34d399" }}>
                <FlaskConical className="w-3.5 h-3.5" />Simulate
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
