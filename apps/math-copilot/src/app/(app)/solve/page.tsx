"use client";
import { useState, useRef } from "react";
import { mathApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MathOutput } from "@/components/MathOutput";
import {
  Calculator, Loader2, Copy, CheckCircle2, ChevronDown,
  Download, RotateCcw, Lightbulb,
} from "lucide-react";

const SUBJECTS = [
  { value: "arithmetic",             label: "Arithmetic" },
  { value: "algebra",                label: "Algebra" },
  { value: "geometry",               label: "Geometry" },
  { value: "trigonometry",           label: "Trigonometry" },
  { value: "precalculus",            label: "Pre-Calculus" },
  { value: "calculus",               label: "Calculus" },
  { value: "statistics",             label: "Statistics & Probability" },
  { value: "linear_algebra",         label: "Linear Algebra" },
  { value: "differential_equations", label: "Differential Equations" },
  { value: "discrete_math",          label: "Discrete Mathematics" },
];

const LEVELS = [
  { value: "middle_school", label: "Middle School" },
  { value: "high_school",   label: "High School" },
  { value: "ap_ib",         label: "AP / IB" },
  { value: "university",    label: "University" },
  { value: "graduate",      label: "Graduate" },
  { value: "professional",  label: "Professional" },
];

const STYLES = [
  { value: "detailed", label: "Detailed (every step)" },
  { value: "quick",    label: "Quick (key steps only)" },
  { value: "proof",    label: "Proof / Rigorous" },
];

const MODELS = [
  { value: "gpt-4o",           label: "GPT-4o" },
  { value: "gpt-4o-mini",      label: "GPT-4o Mini (faster)" },
  { value: "claude-sonnet-4",  label: "Claude Sonnet 4" },
  { value: "claude-haiku-4",   label: "Claude Haiku 4 (faster)" },
];

const EXAMPLES = [
  { subject: "calculus",      problem: "Find the derivative of f(x) = x³ · sin(x) using the product rule." },
  { subject: "algebra",       problem: "Solve the quadratic equation 3x² − 7x + 2 = 0." },
  { subject: "linear_algebra", problem: "Find the eigenvalues and eigenvectors of A = [[2,1],[1,2]]." },
  { subject: "statistics",    problem: "A sample of n=50 has mean x̄=72 and σ=8. Find the 95% confidence interval for μ." },
];

export default function SolvePage() {
  const { user } = useAuthStore();
  const [problem, setProblem] = useState("");
  const [subject, setSubject] = useState("algebra");
  const [level, setLevel]     = useState(user?.level || "high_school");
  const [style, setStyle]     = useState("detailed");
  const [model, setModel]     = useState("gpt-4o");
  const [running, setRunning] = useState(false);
  const [output, setOutput]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [tokens, setTokens]   = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleSolve = async () => {
    if (!problem.trim()) return;
    setRunning(true);
    setOutput(null);
    setError(null);
    try {
      const { data } = await mathApi.solve({
        problem: problem.trim(),
        subject,
        level,
        style,
        model_name: model,
        max_tokens: 3500,
      });
      setOutput(data.output_text || "");
      setTokens(data.prompt_tokens + data.completion_tokens);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Solver error. Check AI API keys are configured.");
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

  const handleDownloadMd = () => {
    if (!output) return;
    const md = `# Math Solution\n\n**Problem:** ${problem}\n\n---\n\n${output}\n\n---\n\n*AI Mathematics Copilot™ — requires verification before professional use.*`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "math-solution.md";
    a.click();
  };

  const handleReset = () => { setProblem(""); setOutput(null); setError(null); setTokens(0); };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-bold text-gray-900">AI Math Solver</h1>
        </div>
        <p className="text-sm text-gray-500">Type any math problem — get a complete, step-by-step solution with LaTeX.</p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        {/* Problem input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Your Problem
          </label>
          <textarea
            rows={4}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSolve(); }}
            placeholder="e.g. Find the derivative of x³ · sin(x)&#10;or: Solve 3x² − 7x + 2 = 0&#10;or: Find the eigenvalues of [[2,1],[1,2]]"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none bg-gray-50 focus:bg-white font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">Tip: use ^ for exponents, * for multiply, sqrt() for square root. ⌘+Enter to solve.</p>
        </div>

        {/* Settings row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Subject",  value: subject, set: setSubject, opts: SUBJECTS },
            { label: "Level",    value: level,   set: setLevel,   opts: LEVELS   },
            { label: "Style",    value: style,   set: setStyle,   opts: STYLES   },
            { label: "AI Model", value: model,   set: setModel,   opts: MODELS   },
          ].map(({ label, value, set, opts }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <div className="relative">
                <select value={value} onChange={(e) => set(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 appearance-none pr-7">
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>

        {/* Solve button */}
        <button onClick={handleSolve} disabled={running || !problem.trim()}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2"
          style={{ background: "var(--brand-gradient)" }}>
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" />Solving…</>
            : <><Calculator className="w-4 h-4" />Solve with AI</>}
        </button>
      </div>

      {/* Example problems */}
      {!output && !running && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Try an example</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {EXAMPLES.map((ex, i) => (
              <button key={i}
                onClick={() => { setProblem(ex.problem); setSubject(ex.subject); }}
                className="text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-all group">
                <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wide capitalize">
                  {ex.subject.replace(/_/g, " ")}
                </span>
                <p className="text-xs text-gray-700 mt-0.5 font-mono group-hover:text-brand-800">{ex.problem}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-5 flex items-start gap-2">
          <span className="text-red-400 mt-0.5">⚠</span>
          {error}
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="animate-slide-up">
          {/* Action bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Solution</span>
              {tokens > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {tokens.toLocaleString()} tokens
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg transition-colors">
                {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={handleDownloadMd}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg transition-colors">
                <Download className="w-3 h-3" />.md
              </button>
              <button onClick={handleReset}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg transition-colors">
                <RotateCcw className="w-3 h-3" />New
              </button>
            </div>
          </div>

          {/* Rendered solution */}
          <div ref={outputRef}
            className="bg-white border border-gray-200 rounded-2xl shadow-sm px-7 py-6 overflow-x-auto">
            <MathOutput content={output} />
          </div>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            ⚠ AI-generated solution — verify before submitting for graded work or professional use.
          </p>
        </div>
      )}
    </div>
  );
}
