"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { GraduationCap, Send, RotateCcw, ChevronDown, Sparkles, BookOpen, Eye, Download } from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";
import { mentorApi, type MentorMessage, type MentorSession } from "@/lib/api";

const ACCENT = "#a855f7";

const SUBJECTS = [
  { key: "algebra",               label: "Algebra" },
  { key: "calculus",              label: "Calculus" },
  { key: "geometry",              label: "Geometry" },
  { key: "trigonometry",          label: "Trigonometry" },
  { key: "statistics",            label: "Statistics" },
  { key: "linear_algebra",        label: "Linear Algebra" },
  { key: "differential_equations",label: "Differential Equations" },
  { key: "discrete_math",         label: "Discrete Math" },
  { key: "precalculus",           label: "Pre-Calculus" },
];

const LEVELS = [
  { key: "middle_school",  label: "Middle School" },
  { key: "high_school",    label: "High School" },
  { key: "ap_ib",          label: "AP / IB" },
  { key: "university",     label: "University" },
  { key: "graduate",       label: "Graduate" },
];

const STARTER_TOPICS = [
  "Why does the derivative of sin(x) equal cos(x)?",
  "What is the intuition behind integration by parts?",
  "How does the Fundamental Theorem of Calculus connect derivatives and integrals?",
  "Why do eigenvalues matter in linear algebra?",
  "What makes the number e so special?",
  "How does the quadratic formula actually work?",
  "Why is i² = −1 defined that way?",
  "What is the intuition behind Bayes' Theorem?",
];


// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, isLatest }: { msg: MentorMessage; isLatest: boolean }) {
  const isMentor = msg.role === "mentor";
  return (
    <div className={`flex gap-3 ${isMentor ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
        style={{
          background: isMentor ? `${ACCENT}20` : "rgba(255,255,255,0.06)",
          border: isMentor ? `1px solid ${ACCENT}30` : "1px solid rgba(255,255,255,0.10)",
          color: isMentor ? ACCENT : "#94a3b8",
        }}>
        {isMentor ? "∑" : "You"}
      </div>

      {/* Bubble + optional SVG diagram */}
      <div className={`flex flex-col gap-2 ${isMentor ? "items-start" : "items-end"} max-w-[78%]`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed w-full ${isLatest && isMentor ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}
          style={{
            background: isMentor ? `${ACCENT}12` : "rgba(255,255,255,0.05)",
            border: isMentor ? `1px solid ${ACCENT}20` : "1px solid rgba(255,255,255,0.08)",
            color: isMentor ? "#e2e8f0" : "#94a3b8",
            borderTopLeftRadius: isMentor ? "4px" : undefined,
            borderTopRightRadius: isMentor ? undefined : "4px",
          }}>
          {msg.content}
        </div>

        {/* SVG visual diagram */}
        {msg.svg_diagram && (
          <div
            className={`rounded-2xl overflow-hidden w-full ${isLatest ? "animate-in fade-in slide-in-from-bottom-2 duration-500" : ""}`}
            style={{ border: `1px solid ${ACCENT}25`, background: "#0f0a1e" }}>
            {/* Header bar */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{ borderBottom: `1px solid ${ACCENT}15`, background: `${ACCENT}08` }}>
              <Eye className="w-3 h-3" style={{ color: ACCENT }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                Visual Aid
              </span>
            </div>
            {/* SVG render */}
            <div
              className="w-full"
              style={{ lineHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: msg.svg_diagram }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Turn indicator ────────────────────────────────────────────────────────────

function TurnBadge({ count }: { count: number }) {
  const width = Math.min(100, (count / 10) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
        Discovery progress
      </span>
      <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: `${ACCENT}` }} />
      </div>
      <span className="text-[10px]" style={{ color: "#334155" }}>Turn {count}</span>
    </div>
  );
}

// ── Completion card ───────────────────────────────────────────────────────────

function CompletionCard({ insight, onNew }: { insight: string; onNew: () => void }) {
  return (
    <div className="rounded-2xl p-6 text-center"
      style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30` }}>
      <div className="text-4xl mb-3">🎉</div>
      <h3 className="font-bold text-base mb-2" style={{ color: "#f1f5f9" }}>
        You discovered it!
      </h3>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "#94a3b8" }}>{insight}</p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mx-auto"
        style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
        <RotateCcw className="w-4 h-4" />
        Start a new topic
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MentorPage() {
  // Setup state
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("algebra");
  const [level, setLevel] = useState("high_school");
  const { model: modelName, setModel: setModelName } = useModel();

  // Session state
  const [session, setSession] = useState<MentorSession | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom after new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  const startSession = useCallback(async (topicOverride?: string) => {
    const t = (topicOverride ?? topic).trim();
    if (!t) return;
    setError(null);
    setLoading(true);
    try {
      const res = await mentorApi.start({ topic: t, subject, level, model_name: modelName });
      setSession(res.data);
      setTopic(t);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Failed to start session. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [topic, subject, level, modelName]);

  const sendResponse = useCallback(async () => {
    if (!session || !userInput.trim() || loading) return;
    const msg = userInput.trim();
    setUserInput("");
    setError(null);
    setLoading(true);

    // Optimistic user bubble
    setSession(prev => prev ? {
      ...prev,
      messages: [...prev.messages, { role: "user", content: msg, svg_diagram: undefined }],
    } : prev);

    try {
      const res = await mentorApi.respond({
        session_id: session.session_id,
        user_message: msg,
        model_name: modelName,
      });
      setSession(res.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Failed to get mentor response.";
      setError(detail);
      // Roll back optimistic message
      setSession(prev => prev ? {
        ...prev,
        messages: prev.messages.slice(0, -1),
      } : prev);
      setUserInput(msg);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [session, userInput, loading, modelName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendResponse();
    }
  };

  const reset = () => {
    setSession(null);
    setTopic("");
    setUserInput("");
    setError(null);
  };

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}28` }}>
              <GraduationCap className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              AI Mentor Mode
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#f1f5f9" }}>
            Socratic Learning™
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            Your AI Mentor never gives you the answer. Instead it guides you through questions until
            you discover the insight yourself — the most durable form of mathematical understanding.
          </p>
        </div>

        {/* Method explainer */}
        <div className="rounded-2xl p-5 mb-8"
          style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}18` }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-xs font-semibold" style={{ color: ACCENT }}>How it works</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { n: "1", label: "You choose a topic", desc: "Pick any mathematical concept you want to truly understand." },
              { n: "2", label: "Mentor asks questions", desc: "The AI never explains — it asks questions that guide your thinking." },
              { n: "3", label: "You discover the answer", desc: "After 6–10 exchanges, the insight emerges from your own reasoning." },
            ].map(s => (
              <div key={s.n} className="rounded-xl p-3"
                style={{ background: "rgba(0,0,0,0.20)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-lg font-bold mb-1" style={{ color: ACCENT }}>{s.n}</div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: "#f1f5f9" }}>{s.label}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: "#475569" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Topic input */}
        <div className="mb-5">
          <label className="text-xs font-semibold block mb-2" style={{ color: "#94a3b8" }}>
            What do you want to understand?
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Why does the derivative of sin(x) equal cos(x)?"
            rows={2}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${topic ? ACCENT + "40" : "rgba(255,255,255,0.10)"}`,
              color: "#f1f5f9",
            }}
          />
        </div>

        {/* Starter topics */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#334155" }}>
            Or pick a topic to explore
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTER_TOPICS.map(t => (
              <button key={t}
                onClick={() => startSession(t)}
                className="text-[11px] px-3 py-1.5 rounded-lg text-left"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#64748b",
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#334155" }}>
              Subject
            </label>
            <div className="relative">
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs appearance-none outline-none pr-7"
                style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#334155" }}>
              Level
            </label>
            <div className="relative">
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs appearance-none outline-none pr-7"
                style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                {LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#334155" }}>
              AI Model
            </label>
            <ModelSelector value={modelName} onChange={setModelName} compact />
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button
          onClick={() => startSession()}
          disabled={!topic.trim() || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: topic.trim() ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
            border: `1px solid ${topic.trim() ? `${ACCENT}40` : "rgba(255,255,255,0.08)"}`,
            color: topic.trim() ? ACCENT : "#334155",
            cursor: topic.trim() ? "pointer" : "not-allowed",
          }}>
          {loading ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <GraduationCap className="w-4 h-4" />
          )}
          {loading ? "Starting session…" : "Begin Socratic Session"}
        </button>
      </div>
    );
  }

  // ── Active session ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-6 gap-4">

      {/* Session header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}28` }}>
          <GraduationCap className="w-4.5 h-4.5" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-0.5 truncate" style={{ color: "#f1f5f9" }}>
            {session.topic}
          </div>
          <div className="text-[10px]" style={{ color: "#334155" }}>
            {SUBJECTS.find(s => s.key === session.subject)?.label} ·{" "}
            {LEVELS.find(l => l.key === session.level)?.label} · Socratic Mode
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              const win = window.open("", "_blank");
              if (!win) { alert("Allow pop-ups to export PDF."); return; }
              const rows = session.messages.map(m =>
                `<div style="margin-bottom:16px"><strong style="color:${m.role==="mentor"?"#a855f7":"#22d3ee"}">${m.role === "mentor" ? "AI Mentor" : "You"}:</strong><br/>${m.content.replace(/\n/g,"<br/>")}</div>`
              ).join("");
              win.document.write(`<!DOCTYPE html><html><head><title>Mentor Session — ${session.topic}</title>
                <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;line-height:1.7;color:#1a1a1a}h1{font-size:22px;margin-bottom:4px}p{color:#555;font-size:13px;margin-bottom:32px}hr{border:none;border-top:1px solid #ddd;margin:24px 0}@media print{body{margin:20px}}</style>
                </head><body><h1>AI Mentor Session</h1><p>Topic: ${session.topic} · ${SUBJECTS.find(s=>s.key===session.subject)?.label} · ${LEVELS.find(l=>l.key===session.level)?.label}</p><hr/>${rows}<script>window.onload=()=>window.print()</script></body></html>`);
              win.document.close();
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
            <Download className="w-3 h-3" />PDF
          </button>
          <button onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
            <RotateCcw className="w-3 h-3" />New topic
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0">
        <TurnBadge count={session.turn_count} />
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 py-2 pr-1">
        {/* Intro note */}
        <div className="flex items-center gap-2 text-[10px]"
          style={{ color: "#334155" }}>
          <BookOpen className="w-3 h-3" />
          <span>Your AI Mentor will guide you with questions — never direct answers.</span>
        </div>

        {session.messages.map((msg, i) => (
          <Bubble key={i} msg={msg} isLatest={i === session.messages.length - 1} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}30`, color: ACCENT }}>
              ∑
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
              style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, borderTopLeftRadius: "4px" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: ACCENT, animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: ACCENT, animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: ACCENT, animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); sendResponse(); }} className="flex gap-3 mt-4 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Share your thinking… (Enter to send)"
          disabled={loading}
          rows={2}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none resize-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${userInput ? ACCENT + "40" : "rgba(255,255,255,0.1)"}`,
            color: "#f8fafc",
          }}
        />
        <button
          type="submit"
          disabled={loading || !userInput.trim()}
          className="px-5 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 flex-shrink-0"
          style={{ background: ACCENT, color: "#fff" }}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
