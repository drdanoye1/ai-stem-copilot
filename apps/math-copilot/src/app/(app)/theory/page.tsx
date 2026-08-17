"use client";
import { useState, useRef, useEffect } from "react";
import { mathApi, getErrorMessage, type MathSession, type LearningObjective, type VizHint } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LEVELS, SUBLEVELS, CURRICULUM_CATEGORIES, CURRICULUM_REGISTRY, curriculumLabel } from "@/lib/personalization-taxonomy";
import { GroupedSelect } from "@/components/GroupedSelect";
import { MathOutput } from "@/components/MathOutput";
import { ReformulateBar } from "@/components/ReformulateBar";
import { VizRenderer } from "@/components/viz";
import {
  GraduationCap, Loader2, ChevronDown, BookOpen, Sparkles,
  Bookmark, BookmarkCheck, Copy, CheckCircle2, Download, FlaskConical,
  ChevronRight, AlertCircle, BarChart3, Globe, Lightbulb, Camera,
} from "lucide-react";
import { ModelSelector, useAiMode } from "@/components/ModelSelector";
import { GoalsPanel } from "@/components/goals/GoalsPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { subject: "calculus",       topic: "The Fundamental Theorem of Calculus" },
  { subject: "linear_algebra", topic: "Eigenvalues and Eigenvectors" },
  { subject: "statistics",     topic: "Bayes' Theorem and Conditional Probability" },
  { subject: "algebra",        topic: "Complex Numbers and the Argand Plane" },
  { subject: "calculus",       topic: "Taylor and Maclaurin Series" },
  { subject: "geometry",       topic: "Euler's Formula: V − E + F = 2" },
];

// Single source of truth: mirrors the account profile's Education Level
// taxonomy (src/app/(app)/profile/page.tsx) so "Education Level" here
// always means the same thing it means on the profile page.
const THEORY_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "Plain language, intuitive proofs"      },
  { value: "intermediate", label: "Intermediate", desc: "Standard notation, full derivations"   },
  { value: "advanced",     label: "Advanced",     desc: "Rigorous proofs, formal notation"      },
  { value: "university",   label: "University",   desc: "Graduate-level rigour, abstract forms" },
];



const SUBJECTS = [
  { value: "algebra",                label: "Algebra"                  },
  { value: "arithmetic",             label: "Arithmetic"               },
  { value: "geometry",               label: "Geometry"                 },
  { value: "trigonometry",           label: "Trigonometry"             },
  { value: "precalculus",            label: "Pre-Calculus"             },
  { value: "calculus",               label: "Calculus"                 },
  { value: "statistics",             label: "Statistics & Probability" },
  { value: "linear_algebra",         label: "Linear Algebra"           },
  { value: "differential_equations", label: "Differential Equations"   },
  { value: "discrete_math",          label: "Discrete Mathematics"     },
  { value: "number_theory",          label: "Number Theory"            },
  { value: "other",                  label: "Other"                    },
];


const BLOOM_COLORS: Record<string, { bg: string; color: string }> = {
  Remember:   { bg: "rgba(251,113,133,0.12)", color: "#fb7185" },
  Understand: { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  Apply:      { bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  Analyze:    { bg: "rgba(34,211,238,0.12)",  color: "#22d3ee" },
  Evaluate:   { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  Create:     { bg: "rgba(99,102,241,0.12)",  color: "#818cf8" },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-dark w-full appearance-none pr-8 py-2 text-xs"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "#475569" }} />
      </div>
    </div>
  );
}

function LearningObjectives({ objectives, loading }: {
  objectives: LearningObjective[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl p-4 mb-6 flex items-center gap-3"
        style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#22d3ee" }} />
        <span className="text-xs" style={{ color: "#64748b" }}>Generating learning objectives…</span>
      </div>
    );
  }
  if (!objectives || objectives.length === 0) return null;
  return (
    <div className="rounded-xl p-4 mb-6"
      style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#22d3ee" }}>
        Learning Objectives — Bloom&apos;s Taxonomy
      </p>
      <div className="flex flex-wrap gap-2">
        {objectives.map((obj, i) => {
          const c = BLOOM_COLORS[obj.bloom] ?? { bg: "rgba(255,255,255,0.06)", color: "#94a3b8" };
          return (
            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{ background: c.bg, border: `1px solid ${c.color}25` }}
              title={obj.description}>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.color }}>
                {obj.bloom}
              </span>
              <span className="text-[11px]" style={{ color: "#94a3b8" }}>
                {obj.objective}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrerequisiteChips({ prereqs }: { prereqs: string[] }) {
  if (!prereqs || prereqs.length === 0) return null;
  return (
    <div className="rounded-xl p-4 mb-6"
      style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#fbbf24" }}>
        Suggested Prerequisites
      </p>
      <div className="flex flex-wrap gap-2">
        {prereqs.map((p, i) => (
          <a
            key={i}
            href={`/explore?topic=${encodeURIComponent(p)}`}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}
          >
            <BookOpen className="w-3 h-3" />
            {p}
            <ChevronRight className="w-2.5 h-2.5 opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TheoryPage() {
  const { user } = useAuthStore();
  const [topic,        setTopic]       = useState("");
  const [subject,      setSubject]     = useState("algebra");
  const [level,        setLevel]       = useState("high_school");
  const [sublevel,     setSublevel]    = useState("");
  const [theoryLevel,  setTheoryLevel] = useState("intermediate");
  const [curriculum,   setCurriculum]  = useState("general");
  const [curriculumTrack, setCurriculumTrack] = useState("");
  const { model, setModel } = useAiMode();

  const [loading,      setLoading]     = useState(false);
  const [objLoading,   setObjLoading]  = useState(false);
  const [error,        setError]       = useState<string | null>(null);

  const [session,      setSession]     = useState<MathSession | null>(null);
  const [objectives,   setObjectives]  = useState<LearningObjective[] | null>(null);
  const [prereqs]                      = useState<string[]>([]);  // future: parse from output
  const [vizHint,      setVizHint]     = useState<VizHint | null>(null);

  const [saved,        setSaved]       = useState(false);
  const [saveLoading,  setSaveLoading] = useState(false);
  const [copied,       setCopied]      = useState(false);
  const [saveTitle,    setSaveTitle]   = useState("");
  const [showSaveBox,  setShowSaveBox] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const sublevelOpts = SUBLEVELS[level] || [];

  // Default Education Level to the account's Education Level (the ground
  // truth) once it loads. Doesn't clobber a level the learner has since
  // changed here, and this effect only runs once.
  const appliedAccountLevelRef = useRef(false);
  useEffect(() => {
    if (!appliedAccountLevelRef.current && user?.level) {
      setLevel(user.level);
      appliedAccountLevelRef.current = true;
    }
  }, [user?.level]);

  // Seed Grade/Year from the account's stored value once it's both loaded
  // and valid for whatever level is currently resolved (waits on `level` so
  // it runs after the account's Education Level has already been applied).
  const appliedAccountSublevelRef = useRef(false);
  useEffect(() => {
    if (!appliedAccountSublevelRef.current && user?.grade_year && SUBLEVELS[level]?.some(o => o.value === user.grade_year)) {
      setSublevel(user.grade_year);
      appliedAccountSublevelRef.current = true;
    }
  }, [user?.grade_year, level]);

  // Seed Curriculum (+ Track) from the account's stored value once it
  // loads, without clobbering a curriculum the learner has since chosen
  // here for this session.
  const appliedAccountCurriculumRef = useRef(false);
  useEffect(() => {
    if (!appliedAccountCurriculumRef.current && user?.curriculum) {
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

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setObjLoading(true);
    setError(null);
    setSession(null);
    setObjectives(null);
    setVizHint(null);
    setSaved(false);
    setShowSaveBox(false);

    // Fire both in parallel — objectives is faster
    const objPromise = mathApi.objectives({
      topic: topic.trim(),
      subject,
      level,
      curriculum,
      curriculum_track: curriculumTrack || undefined,
      ai_mode: model,
    }).then(({ data }) => {
      setObjectives(data.objectives);
      setObjLoading(false);
    }).catch(() => setObjLoading(false));

    const theoryPromise = mathApi.theory({
      topic: topic.trim(),
      subject,
      level,
      sublevel: sublevel || undefined,
      theory_level: theoryLevel,
      curriculum,
      curriculum_track: curriculumTrack || undefined,
      ai_mode: model,
    }).then(({ data }) => {
      setSession(data);
      setSaveTitle(data.input_text);
      setVizHint(data.extra?.visualization_hints ?? null);
    }).catch(err => {
      setError(getErrorMessage(err));
    }).finally(() => setLoading(false));

    await Promise.all([objPromise, theoryPromise]);
  };

  const handleSave = async () => {
    if (!session || !saveTitle.trim()) return;
    setSaveLoading(true);
    try {
      await mathApi.saveSession(session.id, saveTitle.trim());
      setSaved(true);
      setShowSaveBox(false);
    } catch { /* silent */ }
    finally { setSaveLoading(false); }
  };

  const handleCopy = async () => {
    if (!session?.output_text) return;
    await navigator.clipboard.writeText(session.output_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMd = () => {
    if (!session?.output_text) return;
    const blob = new Blob([session.output_text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theory-${topic.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => window.print();

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <GraduationCap className="w-4 h-4" style={{ color: "#fbbf24" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#fbbf24" }}>
            Theory Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Theory Lesson Generator
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Rigorous mathematical lessons — historical background, formal definitions, derivations, proofs, theorems, and worked examples.
        </p>
      </div>

      <GoalsPanel subject={subject} />

      {/* Input card */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

        {/* Topic input */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
            Mathematical Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
            placeholder="e.g. The Fundamental Theorem of Calculus, Eigenvalues and Eigenvectors, Bayes' Theorem…"
            className="input-dark w-full py-3 text-sm"
            style={{ fontSize: "0.95rem" }}
          />
          <ReformulateBar
            value={topic}
            subject={subject}
            level={level}
            curriculum={curriculum}
            context="theory"
            onSelect={setTopic}
            accent="#fbbf24"
          />
        </div>

        {/* Theory depth pills */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
            Theory Depth
          </label>
          <div className="flex flex-wrap gap-2">
            {THEORY_LEVELS.map(tl => (
              <button
                key={tl.value}
                onClick={() => setTheoryLevel(tl.value)}
                className="flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all"
                style={{
                  background: theoryLevel === tl.value ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                  border: theoryLevel === tl.value ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.07)",
                  color: theoryLevel === tl.value ? "#fbbf24" : "#64748b",
                  minWidth: "130px",
                }}
              >
                <span className="text-xs font-semibold">{tl.label}</span>
                <span className="text-[10px] mt-0.5 opacity-70">{tl.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid of selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          <Select label="Subject" value={subject} onChange={setSubject} options={SUBJECTS} />
          <div>
            <Select label="Education Level" value={level} onChange={v => { setLevel(v); setSublevel(""); }} options={LEVELS} />
            <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "#334155" }}>
              <span>Profile: {LEVELS.find(l => l.value === user?.level)?.label ?? "—"}</span>
              {user?.level && level !== user.level && (
                <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                  Session override
                </span>
              )}
            </p>
          </div>
          {sublevelOpts.length > 0 && (
            <div>
              <Select label="Year / Grade" value={sublevel} onChange={setSublevel}
                options={[{ value: "", label: "— Any —" }, ...sublevelOpts]} />
              <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "#334155" }}>
                <span>Profile: {sublevelOpts.find(o => o.value === user?.grade_year)?.label ?? "—"}</span>
                {user?.grade_year && sublevel !== user.grade_year && (
                  <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                    Session override
                  </span>
                )}
              </p>
            </div>
          )}
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

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generating Theory Lesson…</>
          ) : (
            <><GraduationCap className="w-4 h-4" />Generate Theory Lesson</>
          )}
        </button>
      </div>

      {/* Try an example */}
      {!session && !loading && (
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
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.30)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#fbbf24" }}>
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
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.20)" }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#fb7185" }} />
          <p className="text-sm" style={{ color: "#fb7185" }}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !session && (
        <div className="rounded-2xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#fbbf24" }} />
            <span className="text-sm font-medium" style={{ color: "#64748b" }}>
              AI is building your Theory Lesson — derivations, proofs, and worked examples…
            </span>
          </div>
          {[80, 60, 90, 50, 75, 65].map((w, i) => (
            <div key={i} className="h-3 rounded-full mb-3 animate-pulse"
              style={{ width: `${w}%`, background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      )}

      {/* Output */}
      {session && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-4 h-4" style={{ color: "#fbbf24" }} />
              <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
                {session.input_text}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.22)" }}>
                Theory
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Copy */}
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}
                title="Copy markdown">
                {copied ? <CheckCircle2 className="w-3 h-3" style={{ color: "#34d399" }} /> : <Copy className="w-3 h-3" />}
              </button>
              {/* Export MD */}
              <button onClick={handleExportMd}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}
                title="Export Markdown">
                <Download className="w-3 h-3" /><span>MD</span>
              </button>
              {/* Export PDF */}
              <button onClick={handleExportPdf}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}
                title="Print / Export PDF">
                <Download className="w-3 h-3" /><span>PDF</span>
              </button>
              {/* Save */}
              {!saved ? (
                <button onClick={() => setShowSaveBox(b => !b)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: showSaveBox ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                    border: showSaveBox ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    color: showSaveBox ? "#fbbf24" : "#64748b",
                  }}>
                  <Bookmark className="w-3 h-3" />Save
                </button>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                  <BookmarkCheck className="w-3 h-3" />Saved
                </div>
              )}
            </div>
          </div>

          {/* Save title box */}
          {showSaveBox && !saved && (
            <div className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(251,191,36,0.03)" }}>
              <input
                className="input-dark flex-1 py-1.5 text-xs"
                placeholder="Title for saved lesson…"
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <button onClick={handleSave} disabled={saveLoading || !saveTitle.trim()}
                className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                {saveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </button>
              <button onClick={() => setShowSaveBox(false)}
                className="px-3 py-1.5 text-xs rounded-lg transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                Cancel
              </button>
            </div>
          )}

          {/* Meta bar */}
          <div className="flex items-center gap-4 px-5 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
            {[
              { label: "Subject", value: subject.replace(/_/g, " ") },
              { label: "Level", value: level.replace(/_/g, " ") },
              { label: "Depth", value: theoryLevel },
              { label: "Model", value: model },
              session.duration_ms ? { label: "Time", value: `${(session.duration_ms / 1000).toFixed(1)}s` } : null,
              { label: "Tokens", value: `${session.token_count ?? 0} tok` },
            ].filter(Boolean).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px]" style={{ color: "#475569" }}>{m.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Visualization */}
          {vizHint && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <VizRenderer hint={vizHint} />
            </div>
          )}

          {/* Prerequisites */}
          <div className="px-5 pt-4">
            <PrerequisiteChips prereqs={prereqs} />
          </div>

          {/* Learning Objectives */}
          <div className="px-5">
            <LearningObjectives objectives={objectives} loading={objLoading} />
          </div>

          {/* Theory content */}
          <div ref={outputRef} className="px-5 pb-6">
            <MathOutput markdown={session.output_text} />
          </div>
        </div>
      )}

      {/* Cross-links */}
      {session && (
        <div className="mt-6 rounded-2xl p-5"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#475569" }}>
            Continue Learning
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: `/solve?topic=${encodeURIComponent(topic)}`,    label: "Solve Problems",   icon: "∑",  color: "#22d3ee" },
              { href: `/explore?topic=${encodeURIComponent(topic)}`,  label: "Explore Topic",    icon: "◎",  color: "#818cf8" },
              { href: `/practice?topic=${encodeURIComponent(topic)}`, label: "Practice",         icon: "✎",  color: "#34d399" },
              { href: `/mentor?topic=${encodeURIComponent(topic)}`,   label: "Ask AI Mentor",    icon: "💬", color: "#fbbf24" },
            ].map(link => (
              <a key={link.href} href={link.href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = link.color + "44"; (e.currentTarget as HTMLElement).style.color = link.color; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
              >
                <span style={{ color: link.color }}>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
