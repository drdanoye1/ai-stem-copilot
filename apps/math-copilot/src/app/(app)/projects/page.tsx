"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Compass, Star, Clock, ChevronRight, X, Send, CheckCircle,
  AlertCircle, Lightbulb, ChevronDown, RotateCcw, BookOpen,
} from "lucide-react";
import {
  projectsApi,
  type DiscoveryProject,
  type ProjectFeedback,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const ACCENT = "#8b5cf6";

const SUBJECT_META: Record<string, { label: string; color: string }> = {
  algebra:                { label: "Algebra",                 color: "#22d3ee" },
  calculus:               { label: "Calculus",                color: "#34d399" },
  statistics:             { label: "Statistics",              color: "#fbbf24" },
  geometry:               { label: "Geometry",                color: "#f97316" },
  linear_algebra:         { label: "Linear Algebra",          color: "#f43f5e" },
  differential_equations: { label: "Differential Equations",  color: "#a855f7" },
};

const LEVEL_META: Record<string, string> = {
  high_school: "High School",
  university:  "University",
  graduate:    "Graduate",
};

const MODELS = [
  { key: "gpt-4o",          label: "GPT-4o" },
  { key: "gpt-4o-mini",     label: "GPT-4o Mini" },
  { key: "claude-sonnet-4", label: "Claude Sonnet" },
  { key: "claude-haiku-4",  label: "Claude Haiku" },
];

// ── How It Works banner ───────────────────────────────────────────────────────
const HOW_STEPS = [
  { n: "1", icon: "📋", title: "Read the Steps",   body: "Work through the numbered steps and expand hints if you get stuck." },
  { n: "2", icon: "✏️",  title: "Write Your Solution", body: "Type your full working in the Submit tab — the AI grades your reasoning, not just the final answer." },
  { n: "3", icon: "🎯", title: "Get AI Feedback",  body: "Receive a score, rubric breakdown, strengths, and personalised next steps." },
];

function HowItWorksBanner() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs text-left"
        style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", color: "#a78bfa" }}>
        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-semibold">How It Works</span>
        <span className="ml-auto" style={{ color: "#475569" }}>▼ Show</span>
      </button>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(139,92,246,0.12)" }}>
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
          <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>How It Works</span>
        </div>
        <button onClick={() => setOpen(false)}
          className="text-[10px] px-2 py-0.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.06)", color: "#475569" }}>
          Hide ▲
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {HOW_STEPS.map(s => (
          <div key={s.n} className="text-center">
            <div className="text-xl mb-1.5">{s.icon}</div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>
              Step {s.n}
            </p>
            <p className="text-[11px] font-semibold mb-1" style={{ color: "#e2e8f0" }}>{s.title}</p>
            <p className="text-[10px] leading-relaxed" style={{ color: "#475569" }}>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 text-[10px]" style={{ color: "#334155" }}>
        <span style={{ color: "#6366f1" }}>💡</span>
        Use the <strong className="text-slate-400 mx-0.5">Steps & Hints</strong> tab first, then
        <strong className="text-slate-400 mx-0.5">Submit Work</strong>, then check
        <strong className="text-slate-400 mx-0.5">AI Feedback</strong>.
      </div>
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className="w-3 h-3"
          style={{
            color: i < n ? "#fbbf24" : "rgba(255,255,255,0.10)",
            fill:  i < n ? "#fbbf24" : "none",
          }} />
      ))}
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen }: { project: DiscoveryProject; onOpen: () => void }) {
  const sm = SUBJECT_META[project.subject] ?? { label: project.subject, color: ACCENT };
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-2xl p-5 transition-all duration-200 w-full"
      style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.border = `1px solid ${sm.color}30`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${sm.color}12`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}25` }}>
          {sm.label}
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "#475569" }}>
          {LEVEL_META[project.level] ?? project.level}
        </span>
      </div>

      <p className="font-semibold text-sm mb-2 group-hover:text-white transition-colors" style={{ color: "#e2e8f0" }}>
        {project.title}
      </p>
      <p className="text-[11px] leading-relaxed mb-4 line-clamp-2" style={{ color: "#475569" }}>
        {project.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stars n={project.difficulty} />
          <div className="flex items-center gap-1 text-[10px]" style={{ color: "#334155" }}>
            <Clock className="w-3 h-3" />
            {project.estimated_hours}h
          </div>
        </div>
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: sm.color }} />
      </div>
    </button>
  );
}

// ── Feedback panel ────────────────────────────────────────────────────────────
function FeedbackPanel({ feedback }: { feedback: ProjectFeedback }) {
  const scoreColor = feedback.score >= 80 ? "#34d399" : feedback.score >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="rounded-2xl p-5 text-center"
        style={{ background: `${scoreColor}08`, border: `1px solid ${scoreColor}25` }}>
        <p className="text-5xl font-bold mb-1" style={{ color: scoreColor }}>{feedback.score}</p>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: scoreColor }}>
          {feedback.verdict}
        </p>
      </div>

      {feedback.strengths.length > 0 && (
        <div className="rounded-xl p-4"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#34d399" }}>
            Strengths
          </p>
          <ul className="space-y-1.5">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "#e2e8f0" }}>
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#34d399" }} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div className="rounded-xl p-4"
          style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#fbbf24" }}>
            Areas to Improve
          </p>
          <ul className="space-y-1.5">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "#e2e8f0" }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.rubric_scores.length > 0 && (
        <div className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#475569" }}>
            Rubric Breakdown
          </p>
          <div className="space-y-3">
            {feedback.rubric_scores.map((r, i) => {
              const c = r.score >= 80 ? "#34d399" : r.score >= 60 ? "#fbbf24" : "#f87171";
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>{r.criterion}</span>
                    <span className="text-xs font-bold" style={{ color: c }}>{r.score}%</span>
                  </div>
                  <div className="h-1 rounded-full mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-1 rounded-full transition-all duration-500"
                      style={{ width: `${r.score}%`, background: c }} />
                  </div>
                  <p className="text-[10px]" style={{ color: "#475569" }}>{r.comment}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {feedback.next_steps && (
        <div className="rounded-xl p-4 flex gap-3"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
          <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>{feedback.next_steps}</p>
        </div>
      )}
    </div>
  );
}

// ── Project detail drawer ─────────────────────────────────────────────────────
function ProjectDrawer({
  project,
  onClose,
}: {
  project: DiscoveryProject;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const sm = SUBJECT_META[project.subject] ?? { label: project.subject, color: ACCENT };

  const [tab, setTab] = useState<"steps" | "submit" | "feedback">("steps");
  const [workText, setWorkText] = useState("");
  const [modelName, setModelName] = useState("gpt-4o");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ProjectFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = useCallback(async () => {
    if (!workText.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await projectsApi.submit(project.id, workText.trim(), modelName);
      setFeedback(data);
      setTab("feedback");
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [project.id, workText, modelName, loading]);

  const canSubmit = !!user; // Any authenticated user can submit; enforce plan gate when billing is live

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="ml-auto w-full max-w-2xl h-full flex flex-col overflow-hidden"
        style={{ background: "var(--bg-page)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-start gap-4 p-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}25` }}>
                {sm.label}
              </span>
              <Stars n={project.difficulty} />
              <div className="flex items-center gap-1 text-[10px]" style={{ color: "#334155" }}>
                <Clock className="w-3 h-3" />{project.estimated_hours}h
              </div>
            </div>
            <h2 className="text-lg font-bold leading-snug" style={{ color: "#f1f5f9" }}>{project.title}</h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#475569" }}>{project.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(255,255,255,0.06)", color: "#475569" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-1 px-6 pt-4">
          {[
            { id: "steps",   label: "Steps & Hints" },
            { id: "submit",  label: "Submit Work" },
            ...(feedback ? [{ id: "feedback", label: "AI Feedback" }] : []),
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === t.id ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t.id ? `${ACCENT}40` : "rgba(255,255,255,0.06)"}`,
                color: tab === t.id ? ACCENT : "#475569",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── How It Works banner ── */}
          <HowItWorksBanner />

          {/* ── Steps tab ── */}
          {tab === "steps" && (
            <>
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {project.steps_json.map((step, i) => (
                  <div key={i} className="rounded-xl p-4"
                    style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                        style={{ background: `${sm.color}18`, color: sm.color }}>
                        {step.step}
                      </div>
                      <div>
                        <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>
                          {step.instruction}
                        </p>
                        {step.hint && (
                          <details className="mt-2">
                            <summary className="text-[10px] font-semibold cursor-pointer select-none"
                              style={{ color: "#475569" }}>
                              💡 Show hint
                            </summary>
                            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#64748b" }}>
                              {step.hint}
                            </p>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rubric preview */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-3.5 h-3.5" style={{ color: "#475569" }} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#334155" }}>
                    Marking Rubric
                  </p>
                </div>
                <div className="space-y-2">
                  {project.rubric_json.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#94a3b8" }}>{r.criterion}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#64748b" }}>
                        {r.weight}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setTab("submit")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}35`, color: ACCENT }}>
                <Send className="w-4 h-4" /> Write my submission
              </button>
            </>
          )}

          {/* ── Submit tab ── */}
          {tab === "submit" && (
            <>
              {!canSubmit && (
                <div className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.20)" }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: ACCENT }}>Pro feature</p>
                  <p className="text-xs" style={{ color: "#475569" }}>
                    AI feedback on submissions is available on the Pro plan.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2"
                  style={{ color: "#475569" }}>
                  Your Solution
                </label>
                <textarea
                  value={workText}
                  onChange={e => setWorkText(e.target.value)}
                  placeholder={"Write your full solution here. Show all working — the AI grades on " +
                    "your reasoning, not just final answers. Use plain text for equations " +
                    "(e.g. x^2 + 3x - 4 = 0)."}
                  rows={12}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none leading-relaxed"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${workText ? `${ACCENT}35` : "rgba(255,255,255,0.08)"}`,
                    color: "#f1f5f9",
                    fontFamily: "monospace",
                  }}
                />
                <p className="text-[10px] mt-1" style={{ color: "#334155" }}>
                  {workText.length} characters
                </p>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5"
                  style={{ color: "#475569" }}>
                  AI Model
                </label>
                <div className="relative">
                  <select value={modelName} onChange={e => setModelName(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs appearance-none outline-none pr-7"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                    {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "#475569" }} />
                </div>
              </div>

              {error && (
                <div className="rounded-xl px-4 py-2.5 text-xs"
                  style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!workText.trim() || loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: workText.trim() && canSubmit ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${workText.trim() && canSubmit ? `${ACCENT}35` : "rgba(255,255,255,0.08)"}`,
                  color: workText.trim() && canSubmit ? ACCENT : "#334155",
                  cursor: workText.trim() && canSubmit && !loading ? "pointer" : "not-allowed",
                }}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {loading ? "Getting AI feedback…" : "Submit for AI Feedback"}
              </button>
            </>
          )}

          {/* ── Feedback tab ── */}
          {tab === "feedback" && feedback && (
            <>
              <button
                onClick={() => { setFeedback(null); setWorkText(""); setTab("submit"); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <RotateCcw className="w-3 h-3" /> Try again
              </button>
              <FeedbackPanel feedback={feedback} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selected, setSelected] = useState<DiscoveryProject | null>(null);

  useEffect(() => {
    projectsApi.list()
      .then(({ data }) => setProjects(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p =>
    (!filterSubject || p.subject === filterSubject) &&
    (!filterLevel   || p.level   === filterLevel)
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}28` }}>
            <Compass className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Discovery Projects™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#f1f5f9" }}>
          Mission-Based Learning
        </h1>
        <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#475569" }}>
          Work through structured real-world projects step-by-step. Submit your solutions
          and receive AI feedback scored against a rubric.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Subject filters */}
        <button
          onClick={() => setFilterSubject("")}
          className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
          style={{
            background: !filterSubject ? `${ACCENT}18` : "var(--bg-surface)",
            border: `1px solid ${!filterSubject ? `${ACCENT}40` : "rgba(255,255,255,0.06)"}`,
            color: !filterSubject ? ACCENT : "#475569",
          }}
        >
          All
        </button>
        {Object.entries(SUBJECT_META).map(([key, sm]) => {
          const active = filterSubject === key;
          return (
            <button key={key} onClick={() => setFilterSubject(active ? "" : key)}
              className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
              style={{
                background: active ? `${sm.color}15` : "var(--bg-surface)",
                border: `1px solid ${active ? `${sm.color}35` : "rgba(255,255,255,0.06)"}`,
                color: active ? sm.color : "#475569",
              }}>
              {sm.label}
            </button>
          );
        })}

        {/* Level filter */}
        <div className="ml-auto relative">
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs appearance-none outline-none pr-6"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: filterLevel ? "#f1f5f9" : "#475569",
            }}
          >
            <option value="">All levels</option>
            {Object.entries(LEVEL_META).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#475569" }} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl h-44 animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm mb-3" style={{ color: "#475569" }}>
            Could not load projects. Make sure the backend is running.
          </p>
          <button
            onClick={() => { setError(false); setLoading(true); projectsApi.list().then(({ data }) => setProjects(data)).catch(() => setError(true)).finally(() => setLoading(false)); }}
            className="text-xs px-4 py-2 rounded-xl"
            style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}35` }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Compass className="w-10 h-10 mx-auto mb-3" style={{ color: "#334155" }} />
          <p className="text-sm" style={{ color: "#475569" }}>No projects match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p)} />
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-[11px] mt-4 text-center" style={{ color: "#334155" }}>
          {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          {filterSubject || filterLevel ? " matching your filters" : " available"}
        </p>
      )}

      {/* Drawer */}
      {selected && (
        <ProjectDrawer project={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
