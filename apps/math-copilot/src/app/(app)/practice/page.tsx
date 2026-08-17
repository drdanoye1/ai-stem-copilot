"use client";
import { useState, useEffect, useRef } from "react";
import { mathApi, outcomesApi, getErrorMessage, StructuredPracticeProblem, PracticeSubmitResult } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LEVELS, SUBLEVELS, CURRICULUM_CATEGORIES, CURRICULUM_REGISTRY, curriculumLabel } from "@/lib/personalization-taxonomy";
import { GroupedSelect } from "@/components/GroupedSelect";
import { MathOutput } from "@/components/MathOutput";
import { Loader2, ChevronDown, Sparkles, Bookmark, BookmarkCheck, Copy, CheckCircle2, Download, XCircle, Eye, EyeOff, ClipboardCheck } from "lucide-react";
import { ModelSelector, useAiMode } from "@/components/ModelSelector";
import { GoalsPanel } from "@/components/goals/GoalsPanel";

const SUBJECTS = [
  { value: "algebra",                label: "Algebra"                  },
  { value: "geometry",               label: "Geometry"                 },
  { value: "calculus",               label: "Calculus"                 },
  { value: "trigonometry",           label: "Trigonometry"             },
  { value: "statistics",             label: "Statistics"               },
  { value: "linear_algebra",         label: "Linear Algebra"           },
  { value: "differential_equations", label: "Differential Equations"   },
  { value: "discrete_math",          label: "Discrete Math"            },
];



const DIFFICULTIES = [
  { value: "easy",   label: "Easy",   accent: "#34d399", glow: "rgba(52,211,153,0.18)",  border: "rgba(52,211,153,0.40)"  },
  { value: "medium", label: "Medium", accent: "#fbbf24", glow: "rgba(251,191,36,0.18)",  border: "rgba(251,191,36,0.40)"  },
  { value: "hard",   label: "Hard",   accent: "#f87171", glow: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.40)" },
  { value: "mixed",  label: "Mixed",  accent: "#a78bfa", glow: "rgba(167,139,250,0.18)", border: "rgba(167,139,250,0.40)" },
];


function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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

export default function PracticePage() {
  const { user } = useAuthStore();
  const [subject,    setSubject]    = useState("algebra");
  const [topic,      setTopic]      = useState("");
  const [level,      setLevel]      = useState(user?.level || "high_school");
  const [sublevel,   setSublevel]   = useState("");
  const [curriculum, setCurriculum] = useState("general");
  const [curriculumTrack, setCurriculumTrack] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count,      setCount]      = useState(5);
  const { model, setModel } = useAiMode();
  const [running,       setRunning]       = useState(false);
  const [output,        setOutput]        = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [sessionId,     setSessionId]     = useState<string | null>(null);
  const [isSaved,       setIsSaved]       = useState(false);
  const [saveTitle,     setSaveTitle]     = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── Check My Work (Practice Check™ — Part II) ────────────────────────────────
  const [checkProblems, setCheckProblems] = useState<StructuredPracticeProblem[] | null>(null);
  const [checkLoading,  setCheckLoading]  = useState(false);
  const [checkError,    setCheckError]    = useState<string | null>(null);
  const [checkAnswers,  setCheckAnswers]  = useState<Record<string, string>>({});
  const [checkRevealed, setCheckRevealed] = useState<Record<string, boolean>>({});
  const [checkResults,  setCheckResults]  = useState<Record<string, PracticeSubmitResult>>({});
  const [checkSubmitting, setCheckSubmitting] = useState<Record<string, boolean>>({});

  // The `user?.level || "high_school"` initializer above only runs once, at
  // first render — but the auth store loads asynchronously (fetchMe()), so
  // `user` is frequently still null at that point and the fallback silently
  // sticks forever. This effect catches the account level once it actually
  // arrives, without clobbering a level the learner has since chosen here.
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

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  const handleDownloadMd = () => {
    if (!output) return;
    const md = `# Practice Set: ${subject.replace(/_/g," ")} — ${difficulty}\n\n**Topic:** ${topic || "General"}\n\n---\n\n${output}\n\n---\n\n*AI Mathematics Copilot™ — verify before professional use.*`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "practice-set.md";
    a.click();
  };

  const handleDownloadDoc = () => {
    if (!output) return;
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const fmt = (s: string) => s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,'<code style="font-family:Consolas,monospace;background:#f0f4f8;padding:1px 4px;">$1</code>');
    const body = output.split("\n").map(line => {
      const t = line.trim();
      if (/^<details>/.test(t))                 return '<div style="border-left:3pt solid #94a3b8;padding:6pt 12pt;margin:8pt 0;background:#f8fafc;">';
      if (/^<\/details>/.test(t))               return "</div>";
      if (/^<summary>(.*?)<\/summary>/.test(t)) return `<p style="font-weight:bold;color:#334155;">&#9658; ${esc(t.replace(/<\/?summary>/g,""))}</p>`;
      if (line.startsWith("### "))              return `<h3 style="font-size:12pt;color:#1e293b;">${fmt(esc(line.slice(4)))}</h3>`;
      if (line.startsWith("## "))               return `<h2 style="font-size:14pt;color:#0f172a;">${fmt(esc(line.slice(3)))}</h2>`;
      if (line.startsWith("# "))                return `<h1 style="font-size:16pt;color:#0f172a;">${fmt(esc(line.slice(2)))}</h1>`;
      if (line.startsWith("> "))                return `<blockquote style="border-left:3pt solid #aaa;margin:0;padding:4pt 12pt;color:#444;">${fmt(esc(line.slice(2)))}</blockquote>`;
      if (/^[-*] /.test(line))                  return `<p style="margin-left:20pt;">&#x2022; ${fmt(esc(line.slice(2)))}</p>`;
      if (/^\d+\.\s/.test(line))                return `<p style="margin-left:20pt;">${fmt(esc(line))}</p>`;
      if (/^---+$/.test(t))                     return '<hr style="border:none;border-top:1pt solid #ccc;margin:8pt 0;">';
      if (!t)                                   return '<p style="margin:2pt 0;">&nbsp;</p>';
      return `<p style="margin:3pt 0;">${fmt(esc(line))}</p>`;
    }).join("\n");
    const diffLabel = DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>Practice Set</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm;line-height:1.6;color:#1e293b}h1{border-bottom:1pt solid #aaa;padding-bottom:6pt}table{border-collapse:collapse;width:100%}td,th{border:1pt solid #aaa;padding:4pt 8pt}th{background:#f0f4f8;font-weight:bold}</style></head><body><h1 style="font-size:16pt;color:#0f172a;">Practice Set: ${esc(subject.replace(/_/g," "))} — ${esc(diffLabel)}</h1><div style="background:#f8fafc;border:1pt solid #e2e8f0;padding:10pt;margin-bottom:12pt;"><strong>Topic:</strong> ${esc(topic || "General")} &nbsp;|&nbsp; <strong>Questions:</strong> ${count}</div>${body}<hr style="border:none;border-top:1pt solid #ccc;margin:12pt 0;"><p style="color:#64748b;font-style:italic;font-size:9pt;">AI Mathematics Copilot&#x2122; &#x2014; verify before professional use.</p></body></html>`;
    const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-word;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "practice-set.doc";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDownloadPdf = () => {
    if (!output || !outputRef.current) return;
    const mathHtml = outputRef.current.querySelector(".math-output")?.innerHTML ?? "";
    const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const win = window.open("", "_blank");
    if (!win) { alert("Allow pop-ups to export PDF."); return; }
    const diffLabel = DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty;
    win.document.write(`<!DOCTYPE html><html><head><title>Practice Set — ${safe(subject)}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;line-height:1.7;color:#1a1a1a;padding:0 20px}h1{font-size:22px;margin-bottom:4px}p.meta{color:#555;font-size:13px;margin-bottom:28px}hr{border:none;border-top:1px solid #ddd;margin:24px 0}.math-output{font-size:15px}@media print{body{margin:20px}}</style></head><body><h1>Practice Set: ${safe(subject.replace(/_/g," "))} — ${safe(diffLabel)}</h1><p class="meta">Topic: ${safe(topic || "General")} · Questions: ${count}</p><hr/><div class="math-output">${mathHtml}</div><hr/><p style="color:#999;font-size:11px;font-style:italic;">AI Mathematics Copilot&#x2122; — verify before professional use.</p><script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script></body></html>`);
    win.document.close();
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const title = saveTitle || `${subject.replace(/_/g," ")} Practice — ${difficulty}`.slice(0, 72);
      await mathApi.saveSession(sessionId, title);
      setIsSaved(true);
      setShowSaveInput(false);
    } catch {}
    finally { setSaving(false); }
  };

  const handleUnsave = async () => {
    if (!sessionId) return;
    setSaving(true);
    try { await mathApi.unsaveSession(sessionId); setIsSaved(false); }
    catch {}
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    setRunning(true); setOutput(null); setError(null);
    try {
      const { data } = await mathApi.practice({
        subject, topic: topic.trim() || subject, level,
        sublevel: sublevel || undefined, difficulty, count, curriculum, curriculum_track: curriculumTrack || undefined,
        ai_mode: model, max_tokens: 4096,
      });
      setOutput(data.output_text || "");
      setSessionId(data.id);
      setIsSaved(data.is_saved === "true");
      setSaveTitle(`${subject.replace(/_/g," ")} Practice — ${difficulty}`.slice(0, 72));
      setShowSaveInput(false);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Check My Work (Practice Check™ — Part II) ────────────────────────────────
  // A small, additive, gradable flow — separate from the markdown practice
  // set above. Generates 3 structured problems with a single unambiguous
  // answer each, and grades what the learner submits (two-tier: exact
  // match, then AI-graded equivalence). Whether "Reveal solution" was
  // clicked before submitting is tracked here and sent with the answer —
  // that's how independence is derived, not from a self-report checkbox.
  const handleGenerateCheck = async () => {
    setCheckLoading(true); setCheckError(null);
    setCheckAnswers({}); setCheckRevealed({}); setCheckResults({}); setCheckSubmitting({});
    try {
      const { data } = await outcomesApi.generateStructuredPractice({
        subject, topic: topic.trim() || undefined, level, difficulty,
        curriculum, curriculum_track: curriculumTrack || undefined, ai_mode: model,
      });
      setCheckProblems(data);
    } catch (err: any) {
      setCheckError(getErrorMessage(err));
    } finally {
      setCheckLoading(false);
    }
  };

  const handleRevealSolution = (problemId: string) => {
    // Only the *first* reveal matters for independence — clicking again
    // (e.g. to re-check) shouldn't un-flip an already-recorded reveal.
    setCheckRevealed(prev => ({ ...prev, [problemId]: true }));
  };

  const handleSubmitCheckAnswer = async (problemId: string) => {
    const answer = (checkAnswers[problemId] || "").trim();
    if (!answer) return;
    setCheckSubmitting(prev => ({ ...prev, [problemId]: true }));
    try {
      const { data } = await outcomesApi.submitPracticeAnswer(problemId, {
        submitted_answer: answer,
        revealed_solution_first: !!checkRevealed[problemId],
      });
      setCheckResults(prev => ({ ...prev, [problemId]: data }));
    } catch (err: any) {
      setCheckError(getErrorMessage(err));
    } finally {
      setCheckSubmitting(prev => ({ ...prev, [problemId]: false }));
    }
  };

  const sublevelOpts = SUBLEVELS[level] || [];
  const diffAccent = DIFFICULTIES.find(d => d.value === difficulty);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#34d399" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#34d399" }}>
            Practice Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Practice Problem Generator
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Unlimited practice problems with worked solutions — tailored to your level, topic, and difficulty.
        </p>
      </div>

      <GoalsPanel subject={subject} />

      {/* Input card */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

        {/* Topic input */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
            Topic (optional)
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. Quadratic equations, Integration by parts, Matrix multiplication…"
            className="input-dark w-full py-3 text-sm"
          />
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
          <Select label="Subject"    value={subject}    onChange={setSubject}    options={SUBJECTS} />
          <div>
            <Select label="Level" value={level} onChange={v => { setLevel(v); setSublevel(""); }} options={LEVELS} />
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
              <Select label="Grade / Year" value={sublevel} onChange={setSublevel} options={sublevelOpts} />
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
              AI Model
            </label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
              Count
            </label>
            <div className="flex gap-1.5">
              {[3, 5, 10].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: count === n ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${count === n ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: count === n ? "#34d399" : "#475569",
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Difficulty pills */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
            Difficulty
          </label>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d.value} onClick={() => setDifficulty(d.value)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: difficulty === d.value ? d.glow : "rgba(255,255,255,0.04)",
                  border: `1px solid ${difficulty === d.value ? d.border : "rgba(255,255,255,0.08)"}`,
                  color: difficulty === d.value ? d.accent : "#475569",
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button onClick={handleGenerate} disabled={running}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={diffAccent ? { background: `${diffAccent.glow}`, border: `1px solid ${diffAccent.border}`, color: diffAccent.accent } : {}}>
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
            : <><Sparkles className="w-4 h-4" />Generate Practice Set</>}
        </button>
      </div>

      {/* Output */}
      {output && (
        <div ref={outputRef} className="rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
              <span className="text-xs font-semibold" style={{ color: "#34d399" }}>Practice Set</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
                {copied ? <CheckCircle2 className="w-3 h-3" style={{ color: "#34d399" }} /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              {sessionId && (
                showSaveInput ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSave()}
                      className="input-dark text-xs py-1.5 px-2.5 w-44" placeholder="Title…" autoFocus />
                    <button onClick={handleSave} disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setShowSaveInput(false)} className="text-xs px-2 py-1.5 rounded-lg" style={{ color: "#475569" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => isSaved ? handleUnsave() : setShowSaveInput(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      background: isSaved ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isSaved ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`,
                      color: isSaved ? "#34d399" : "#475569",
                    }}>
                    {isSaved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                    {isSaved ? "Saved" : "Save"}
                  </button>
                )
              )}
              <div ref={exportRef} className="relative">
                <button onClick={() => setShowExportMenu(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
                  <Download className="w-3 h-3" />Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-20 min-w-[140px]"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {[
                      { label: "Markdown (.md)", fn: handleDownloadMd },
                      { label: "Word (.doc)",    fn: handleDownloadDoc },
                      { label: "PDF (print)",    fn: handleDownloadPdf },
                    ].map(opt => (
                      <button key={opt.label} onClick={() => { opt.fn(); setShowExportMenu(false); }}
                        className="w-full text-left text-xs px-4 py-2.5 transition-all"
                        style={{ color: "#94a3b8" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <MathOutput content={output} />
          </div>

          {/* Cross-links */}
          <div className="flex items-center justify-between rounded-xl mx-6 mb-6 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
              AI Mathematics Copilot™ Practice Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/solve?problem=${encodeURIComponent(topic)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.22)", color: "#22d3ee" }}>
                <ChevronDown className="w-3.5 h-3.5" />Solve
              </a>
              <a href={`/theory?topic=${encodeURIComponent(topic || subject)}&subject=${subject}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <Sparkles className="w-3.5 h-3.5" />Theory
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Check My Work (Practice Check™) */}
      <div className="rounded-2xl p-6 mt-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" style={{ color: "#22d3ee" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Check My Work</h2>
          </div>
          <button onClick={handleGenerateCheck} disabled={checkLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee" }}>
            {checkLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <>{checkProblems ? "New Set" : "Generate 3 Problems"}</>}
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: "#475569" }}>
          3 gradable problems using the current subject/topic/level/difficulty above — submit an answer and get graded instantly.
        </p>

        {checkError && (
          <div className="rounded-xl px-4 py-3 mb-4 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            {checkError}
          </div>
        )}

        {checkProblems && checkProblems.length > 0 && (
          <div className="space-y-4">
            {checkProblems.map((p, i) => {
              const result = checkResults[p.id];
              const revealed = !!checkRevealed[p.id];
              const submitting = !!checkSubmitting[p.id];
              return (
                <div key={p.id} className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "#334155" }}>Problem {i + 1}</p>
                  <p className="text-sm mb-3" style={{ color: "#e2e8f0" }}>{p.problem_text}</p>

                  {!result && (
                    <>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <input type="text" value={checkAnswers[p.id] || ""}
                          onChange={e => setCheckAnswers(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && handleSubmitCheckAnswer(p.id)}
                          placeholder="Your answer…"
                          className="input-dark text-xs py-2 px-3 flex-1 min-w-[160px]" />
                        <button onClick={() => handleSubmitCheckAnswer(p.id)} disabled={submitting || !(checkAnswers[p.id] || "").trim()}
                          className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-50"
                          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                          {submitting ? "Checking…" : "Submit"}
                        </button>
                        <button onClick={() => handleRevealSolution(p.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
                          {revealed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {revealed ? "Solution revealed" : "Reveal solution"}
                        </button>
                      </div>
                      {revealed && (
                        <p className="text-[11px]" style={{ color: "#fbbf24" }}>
                          Revealing before submitting means this attempt counts as AI-assisted, not independent — that's fine, it just won't count toward mastery the same way.
                        </p>
                      )}
                    </>
                  )}

                  {result && (
                    <div className="rounded-lg p-3 mt-1"
                      style={{
                        background: result.is_correct ? "rgba(52,211,153,0.08)" : "rgba(244,63,94,0.08)",
                        border: `1px solid ${result.is_correct ? "rgba(52,211,153,0.25)" : "rgba(244,63,94,0.25)"}`,
                      }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {result.is_correct
                          ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#34d399" }} />
                          : <XCircle className="w-3.5 h-3.5" style={{ color: "#f87171" }} />}
                        <span className="text-xs font-semibold" style={{ color: result.is_correct ? "#34d399" : "#f87171" }}>
                          {result.is_correct ? "Correct" : "Not quite"}
                        </span>
                        <span className="text-[10px] ml-auto" style={{ color: "#475569" }}>
                          Mastery: {result.mastery_state}
                        </span>
                      </div>
                      {!result.is_correct && (
                        <p className="text-xs mb-1" style={{ color: "#94a3b8" }}>
                          Correct answer: <span style={{ color: "#e2e8f0" }}>{result.correct_answer}</span>
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "#94a3b8" }}>{result.solution_steps}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
