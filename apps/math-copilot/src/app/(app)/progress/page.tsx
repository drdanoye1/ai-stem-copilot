"use client";
import { useEffect, useState } from "react";
import { mathApi, type ProgressData } from "@/lib/api";
import { TrendingUp, Zap, BookOpen, Clock, Calculator, PenLine } from "lucide-react";
import Link from "next/link";

const SESSION_ICONS: Record<string, React.ReactNode> = {
  solve:    <Calculator className="w-3.5 h-3.5" />,
  explore:  <BookOpen   className="w-3.5 h-3.5" />,
  practice: <PenLine    className="w-3.5 h-3.5" />,
};
const SESSION_COLORS: Record<string, string> = {
  solve:    "bg-brand-100 text-brand-700",
  explore:  "bg-violet-100 text-violet-700",
  practice: "bg-emerald-100 text-emerald-700",
};

export default function ProgressPage() {
  const [data, setData]       = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mathApi.progress()
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-bold text-gray-900">My Progress</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Sessions",  value: data?.total_sessions ?? 0,        icon: <Zap className="w-4 h-4 text-brand-600" />,    bg: "bg-brand-100" },
          { label: "This Week",       value: data?.sessions_this_week ?? 0,    icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, bg: "bg-emerald-100" },
          { label: "Subjects Studied", value: data?.subjects_practiced?.length ?? 0, icon: <BookOpen className="w-4 h-4 text-violet-600" />, bg: "bg-violet-100" },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Topic progress */}
      {data?.topic_progress && data.topic_progress.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Subjects Practiced</h2>
          <div className="space-y-3">
            {data.topic_progress.map((tp) => (
              <div key={`${tp.subject}-${tp.topic}`} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{tp.subject.replace(/_/g, " ")}</span>
                    <span className="text-xs text-gray-400">{tp.problems_solved} sessions</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-brand-500 rounded-full transition-all"
                      style={{ width: `${Math.min(tp.problems_solved * 10, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {data?.recent_sessions && data.recent_sessions.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Sessions</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recent_sessions.map((s) => (
              <div key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${SESSION_COLORS[s.session_type] || "bg-gray-100 text-gray-600"}`}>
                  {SESSION_ICONS[s.session_type]}
                  <span className="capitalize">{s.session_type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{s.input_text}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{s.subject.replace(/_/g, " ")} · {s.level.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm mb-4">No sessions yet. Start practicing to track your progress.</p>
          <Link href="/solve" className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            <Calculator className="w-4 h-4" />Start solving
          </Link>
        </div>
      )}
    </div>
  );
}
