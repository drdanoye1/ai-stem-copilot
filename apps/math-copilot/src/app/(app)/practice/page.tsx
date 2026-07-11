"use client";
import { useState, useEffect, useRef } from "react";
import { mathApi, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MathOutput } from "@/components/MathOutput";
import { Loader2, ChevronDown, Sparkles, Bookmark, BookmarkCheck, Copy, CheckCircle2, Download } from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";

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

const LEVELS = [
  { value: "middle_school",     label: "Middle School"     },
  { value: "high_school",       label: "High School"       },
  { value: "ap_ib",             label: "AP / IB"           },
  { value: "community_college", label: "Community College" },
  { value: "university",        label: "University"        },
  { value: "graduate",          label: "Graduate"          },
];

const SUBLEVELS: Record<string, { value: string; label: string }[]> = {
  middle_school: [
    { value: "grade_6",  label: "Grade 6"  },
    { value: "grade_7",  label: "Grade 7"  },
    { value: "grade_8",  label: "Grade 8"  },
  ],
  high_school: [
    { value: "grade_9",  label: "Grade 9"  },
    { value: "grade_10", label: "Grade 10" },
    { value: "grade_11", label: "Grade 11" },
    { value: "grade_12", label: "Grade 12" },
  ],
  community_college: [
    { value: "year_1", label: "Year 1" },
    { value: "year_2", label: "Year 2" },
  ],
  university: [
    { value: "year_1", label: "Year 1" },
    { value: "year_2", label: "Year 2" },
    { value: "year_3", label: "Year 3" },
    { value: "year_4", label: "Year 4" },
  ],
};

const CURRICULA = [
  { value: "general",   label: "General"    },
  { value: "waec",      label: "WAEC"       },
  { value: "cambridge", label: "Cambridge"  },
  { value: "ib",        label: "IB"         },
  { value: "ap",        label: "AP"         },
  { value: "gcse",      label: "GCSE"       },
  { value: "sat",       label: "SAT / ACT"  },
  { value: "abet",      label: "ABET"       },
  { value: "tvet",      label: "TVET"       },
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
  const [difficulty, setDifficulty] = useState("medium");
  const [count,      setCount]      = useState(5);
  const { model, setModel } = useModel();
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
        sublevel: sublevel || undefined, difficulty, count, curriculum,
        model_name: model, max_tokens: 4096,
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
          <Select label="Level"      value={level}      onChange={v => { setLevel(v); setSublevel(""); }} options={LEVELS} />
          {sublevelOpts.length > 0 && (
            <Select label="Grade / Year" value={sublevel} onChange={setSublevel} options={sublevelOpts} />
          )}
          <Select label="Curriculum" value={curriculum} onChange={setCurriculum} options={CURRICULA} />
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
    </div>
  );
}
