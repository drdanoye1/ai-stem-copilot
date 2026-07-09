"use client";
import { useState, useEffect, useRef } from "react";
import { mathApi, type SubjectInfo, type VizHint } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MathOutput } from "@/components/MathOutput";
import { ReformulateBar } from "@/components/ReformulateBar";
import { VizRenderer } from "@/components/viz";
import { BookOpen, Loader2, ChevronDown, Search, ChevronRight, Sparkles, Bookmark, BookmarkCheck, Copy, CheckCircle2, Download } from "lucide-react";
import { ModelSelector, useModel } from "@/components/ModelSelector";

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

export default function ExplorePage() {
  const { user } = useAuthStore();
  const [subjects,    setSubjects]   = useState<SubjectInfo[]>([]);
  const [selected,    setSelected]   = useState<SubjectInfo | null>(null);
  const [topic,       setTopic]      = useState("");
  const [level,       setLevel]      = useState(user?.level || "high_school");
  const [sublevel,    setSublevel]   = useState("");
  const { model, setModel } = useModel();
  const [curriculum,  setCurriculum] = useState("general");
  const [examples,    setExamples]   = useState(3);
  const [running,       setRunning]       = useState(false);
  const [output,        setOutput]        = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [sessionId,     setSessionId]     = useState<string | null>(null);
  const [vizHint,       setVizHint]       = useState<VizHint | null>(null);
  const [isSaved,       setIsSaved]       = useState(false);
  const [saveTitle,     setSaveTitle]     = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saving,        setSaving]        = useState(false);
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

  useEffect(() => {
    mathApi.subjects()
      .then(({ data }) => { setSubjects(data.subjects); setSelected(data.subjects[1]); })
      .catch(() => {});
  }, []);

  const handleExplore = async () => {
    if (!topic.trim()) return;
    setRunning(true); setOutput(null); setError(null); setVizHint(null);
    try {
      const { data } = await mathApi.explore({
        topic: topic.trim(),
        subject: selected?.key || "algebra",
        level,
        sublevel: sublevel || undefined,
        example_count: examples,
        curriculum,
        model_name: model,
        max_tokens: 4096,
      });
      setOutput(data.output_text || "");
      setSessionId(data.id);
      setIsSaved(data.is_saved === "true");
      setSaveTitle(topic.trim().slice(0, 72));
      setShowSaveInput(false);
      setVizHint(data.extra?.visualization_hints ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Exploration failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      await mathApi.saveSession(sessionId, saveTitle || topic.trim().slice(0, 72));
      setIsSaved(true); setShowSaveInput(false);
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

  const handleDownloadMd = () => {
    if (!output) return;
    const safe = (s: string) => s;
    const md = `# Math Exploration: ${safe(topic)}\n\n**Subject:** ${selected?.label || "Mathematics"}\n\n---\n\n${output}\n\n---\n\n*AI Mathematics Copilot™ — verify before professional use.*`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "math-exploration.md";
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
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>Math Exploration</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm;line-height:1.6;color:#1e293b}h1{border-bottom:1pt solid #aaa;padding-bottom:6pt}table{border-collapse:collapse;width:100%}td,th{border:1pt solid #aaa;padding:4pt 8pt}th{background:#f0f4f8;font-weight:bold}</style></head><body><h1 style="font-size:16pt;color:#0f172a;">Math Exploration: ${esc(topic)}</h1><div style="background:#f8fafc;border:1pt solid #e2e8f0;padding:10pt;margin-bottom:12pt;"><strong>Subject:</strong> ${esc(selected?.label || "Mathematics")}</div>${body}<hr style="border:none;border-top:1pt solid #ccc;margin:12pt 0;"><p style="color:#64748b;font-style:italic;font-size:9pt;">AI Mathematics Copilot&#x2122; &#x2014; verify before professional use.</p></body></html>`;
    const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-word;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "math-exploration.doc";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDownloadPdf = () => {
    if (!output || !outputRef.current) return;
    const mathHtml = outputRef.current.querySelector(".math-output")?.innerHTML ?? "";
    const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const win = window.open("", "_blank");
    if (!win) { alert("Allow pop-ups to export PDF."); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Math Exploration — ${safe(topic)}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;line-height:1.7;color:#1a1a1a;padding:0 20px}h1{font-size:22px;margin-bottom:4px}p.meta{color:#555;font-size:13px;margin-bottom:28px}hr{border:none;border-top:1px solid #ddd;margin:24px 0}.math-output{font-size:15px}@media print{body{margin:20px}}</style></head><body><h1>Math Exploration: ${safe(topic)}</h1><p class="meta">Subject: ${safe(selected?.label || "Mathematics")}</p><hr/><div class="math-output">${mathHtml}</div><hr/><p style="color:#999;font-size:11px;font-style:italic;">AI Mathematics Copilot&#x2122; — verify before professional use.</p><script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script></body></html>`);
    win.document.close();
  };

  const sublevelOpts = SUBLEVELS[level] || [];

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "#a855f7" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>
            Explore Intelligence™
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Math Concept Explorer
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Deep-dive into any mathematical concept — history, definitions, worked examples, proofs, and connections.
        </p>
      </div>

      {/* Subject picker */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {subjects.map(s => (
            <button key={s.key}
              onClick={() => setSelected(s)}
              className="rounded-xl px-3 py-2.5 text-center transition-all"
              style={{
                background: selected?.key === s.key ? `${s.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${selected?.key === s.key ? `${s.color}40` : "rgba(255,255,255,0.07)"}`,
              }}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-[10px] font-semibold truncate" style={{ color: selected?.key === s.key ? s.color : "#475569" }}>
                {s.label}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input card */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

        {/* Topic input */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>
            Topic to Explore
          </label>
          <div className="relative flex items-center gap-2">
            <Search className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: "#334155" }} />
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleExplore()}
              placeholder={`e.g. ${selected ? `${selected.label} topic…` : "Limits, Complex Numbers, Fourier Transform…"}`}
              className="input-dark w-full py-3 pl-9 text-sm"
            />
          </div>
          <ReformulateBar
            value={topic}
            subject={selected?.key || "algebra"}
            level={level}
            curriculum={curriculum}
            context="explore"
            onSelect={setTopic}
            accent="#a855f7"
          />
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          <Select label="Level"      value={level}      onChange={v => { setLevel(v); setSublevel(""); }} options={LEVELS} />
          {sublevelOpts.length > 0 && (
            <Select label="Grade / Year" value={sublevel} onChange={setSublevel} options={sublevelOpts} />
          )}
          <Select label="Curriculum" value={curriculum} onChange={setCurriculum} options={CURRICULA} />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>Examples</label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(n => (
                <button key={n} onClick={() => setExamples(n)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: examples === n ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${examples === n ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: examples === n ? "#a855f7" : "#475569",
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#475569" }}>AI Model</label>
            <ModelSelector value={model} onChange={setModel} compact />
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <button onClick={handleExplore} disabled={running || !topic.trim()}
          className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" />Exploring…</>
            : <><BookOpen className="w-4 h-4" />Explore Topic</>}
        </button>
      </div>

      {/* Sublevel chips */}
      {sublevelOpts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-[10px] font-semibold uppercase tracking-widest self-center mr-1" style={{ color: "#334155" }}>
            Grade
          </span>
          {sublevelOpts.map(sl => (
            <button key={sl.value} onClick={() => setSublevel(sl.value)}
              className="text-[11px] px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: sublevel === sl.value ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sublevel === sl.value ? "rgba(168,85,247,0.30)" : "rgba(255,255,255,0.08)"}`,
                color: sublevel === sl.value ? "#a855f7" : "#475569",
              }}>
              {sl.label}
            </button>
          ))}
        </div>
      )}

      {/* Output */}
      {output && (
        <div ref={outputRef} className="rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#a855f7" }} />
              <span className="text-xs font-semibold" style={{ color: "#a855f7" }}>Exploration</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
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
                      style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: "#a855f7" }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setShowSaveInput(false)} className="text-xs px-2 py-1.5 rounded-lg" style={{ color: "#475569" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => isSaved ? handleUnsave() : setShowSaveInput(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      background: isSaved ? "rgba(168,85,247,0.10)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isSaved ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.08)"}`,
                      color: isSaved ? "#a855f7" : "#475569",
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

          {/* Viz + output */}
          <div className="p-6">
            {vizHint && vizHint.type !== "none" && (
              <div className="mb-6">
                <VizRenderer hint={vizHint} />
              </div>
            )}
            <MathOutput content={output} />
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between rounded-xl mx-6 mb-6 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#334155" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#a855f7" }} />
              AI Mathematics Copilot™ Explore Intelligence™
            </span>
            <div className="flex items-center gap-2">
              <a href={`/theory?topic=${encodeURIComponent(topic)}&subject=${selected?.key || "algebra"}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
                <ChevronRight className="w-3.5 h-3.5" />Theory Lesson
              </a>
              <a href={`/practice?topic=${encodeURIComponent(topic)}&subject=${selected?.key || "algebra"}&level=${level}&curriculum=${curriculum}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.22)", color: "#34d399" }}>
                <ChevronRight className="w-3.5 h-3.5" />Practice
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
