"use client";
import { useState } from "react";
import { mathApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MathOutput } from "@/components/MathOutput";
import { PenLine, Loader2, ChevronDown } from "lucide-react";

const SUBJECTS = [
  { value: "algebra",                label: "Algebra" },
  { value: "geometry",               label: "Geometry" },
  { value: "calculus",               label: "Calculus" },
  { value: "trigonometry",           label: "Trigonometry" },
  { value: "statistics",             label: "Statistics" },
  { value: "linear_algebra",         label: "Linear Algebra" },
  { value: "differential_equations", label: "Differential Equations" },
  { value: "discrete_math",          label: "Discrete Math" },
];

const LEVELS   = [
  { value: "middle_school", label: "Middle School" },
  { value: "high_school",   label: "High School" },
  { value: "ap_ib",         label: "AP / IB" },
  { value: "university",    label: "University" },
  { value: "graduate",      label: "Graduate" },
];

const DIFFICULTIES = [
  { value: "easy",   label: "Easy",   color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "hard",   label: "Hard",   color: "bg-red-100 text-red-700 border-red-200" },
  { value: "mixed",  label: "Mixed",  color: "bg-violet-100 text-violet-700 border-violet-200" },
];

const MODELS = [
  { value: "gpt-4o",          label: "GPT-4o" },
  { value: "gpt-4o-mini",     label: "GPT-4o Mini (faster)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
];

export default function PracticePage() {
  const { user } = useAuthStore();
  const [subject,    setSubject]    = useState("algebra");
  const [topic,      setTopic]      = useState("");
  const [level,      setLevel]      = useState(user?.level || "high_school");
  const [difficulty, setDifficulty] = useState("medium");
  const [count,      setCount]      = useState(5);
  const [model,      setModel]      = useState("gpt-4o");
  const [running,    setRunning]    = useState(false);
  const [output,     setOutput]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const handleGenerate = async () => {
    setRunning(true); setOutput(null); setError(null);
    try {
      const { data } = await mathApi.practice({
        subject, topic: topic || undefined, level, count, difficulty,
        model_name: model, max_tokens: 4096,
      });
      setOutput(data.output_text || "");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Generation failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <PenLine className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900">Practice Problems</h1>
        </div>
        <p className="text-sm text-gray-500">Generate unlimited problems at your level. Each comes with a full worked solution.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        {/* Difficulty selector */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Difficulty</p>
          <div className="flex gap-2.5">
            {DIFFICULTIES.map((d) => (
              <button key={d.value} onClick={() => setDifficulty(d.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  difficulty === d.value ? d.color : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[
            { label: "Subject",  value: subject, set: setSubject, opts: SUBJECTS },
            { label: "Level",    value: level,   set: setLevel,   opts: LEVELS   },
            { label: "AI Model", value: model,   set: setModel,   opts: MODELS   },
          ].map(({ label, value, set, opts }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <div className="relative">
                <select value={value} onChange={(e) => set(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 appearance-none pr-7">
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Specific topic (optional)</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Integration by parts"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Number of problems</label>
            <div className="flex gap-1.5">
              {[3, 5, 8, 10].map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    count === n ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 text-gray-600 hover:border-brand-300 bg-white"
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={running}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
          {running ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><PenLine className="w-4 h-4" />Generate {count} Problems</>}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-5">{error}</div>}

      {output && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-7 py-6 animate-slide-up overflow-x-auto">
          <MathOutput content={output} />
        </div>
      )}
    </div>
  );
}
