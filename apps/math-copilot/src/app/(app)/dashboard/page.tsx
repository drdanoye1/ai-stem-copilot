"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { mathApi, type ProgressData } from "@/lib/api";
import { Calculator, BookOpen, PenLine, TrendingUp, Zap, Clock } from "lucide-react";

const QUICK_ACTIONS = [
  { href: "/solve",    icon: Calculator, label: "Solve a Problem",     color: "bg-brand-600",   desc: "Step-by-step AI solution" },
  { href: "/explore",  icon: BookOpen,   label: "Explore a Topic",     color: "bg-violet-600",  desc: "Deep-dive any concept" },
  { href: "/practice", icon: PenLine,    label: "Practice Problems",   color: "bg-emerald-600", desc: "AI-generated exercises" },
];

const SUBJECT_COLORS: Record<string, string> = {
  algebra: "bg-blue-100 text-blue-700",
  calculus: "bg-emerald-100 text-emerald-700",
  geometry: "bg-violet-100 text-violet-700",
  trigonometry: "bg-indigo-100 text-indigo-700",
  statistics: "bg-amber-100 text-amber-700",
  linear_algebra: "bg-rose-100 text-rose-700",
  other: "bg-gray-100 text-gray-700",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    mathApi.progress()
      .then(({ data }) => setProgress(data))
      .catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm capitalize">
          {user?.level?.replace(/_/g, " ")} level · Ready to practice?
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-brand-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Sessions</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{progress?.total_sessions ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">This Week</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{progress?.sessions_this_week ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-violet-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subjects</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{progress?.subjects_practiced?.length ?? 0}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Start</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, color, desc }) => (
            <Link key={href} href={href}
              className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-brand-100 transition-all">
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-gray-900 text-sm group-hover:text-brand-700 transition-colors">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      {progress && progress.recent_sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Sessions</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {progress.recent_sessions.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${SUBJECT_COLORS[s.subject] || SUBJECT_COLORS.other}`}>
                  {s.subject.replace(/_/g, " ")}
                </div>
                <p className="text-sm text-gray-700 truncate flex-1">{s.input_text}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!progress || progress.recent_sessions.length === 0) && (
        <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl border border-brand-100 p-8 text-center">
          <div className="text-4xl mb-3">∑</div>
          <h3 className="font-bold text-gray-900 mb-2">Start your first session</h3>
          <p className="text-gray-500 text-sm mb-4">
            Type any math problem and let AI walk you through the solution step-by-step.
          </p>
          <Link href="/solve"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            <Calculator className="w-4 h-4" />
            Solve your first problem
          </Link>
        </div>
      )}
    </div>
  );
}
