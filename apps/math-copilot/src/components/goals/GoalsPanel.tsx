"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { goalsApi, type LearningPlan, type LearningGoal } from "@/lib/api";
import { Target, ArrowRight } from "lucide-react";

const ACCENT = "#34d399";

/**
 * "Your Goals for This Experience" — a compact card showing the active
 * Personalized Learning Goals, Objectives & Outcomes Plan™'s Learning Aim
 * plus the single most subject-relevant Curriculum Goal, with a link to
 * the full /goals page. Renders nothing (not an empty/error state) while
 * loading or if no active plan exists yet, so it never blocks a learner
 * who hasn't generated one (e.g. a pre-existing account, or onboarding's
 * best-effort generation didn't fire/succeed).
 */
export function GoalsPanel({ subject }: { subject?: string | null }) {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    goalsApi.getActive()
      .then(({ data }) => { if (!cancelled) setPlan(data); })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || !plan || !plan.goals || plan.goals.length === 0) return null;

  const matched: LearningGoal =
    (subject && plan.goals.find(g => g.subject === subject)) || plan.goals[0];

  return (
    <div className="rounded-xl p-4 mb-6"
      style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)" }}>
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Your Goals for This Experience
          </span>
        </div>
        <Link href="/goals"
          className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80"
          style={{ color: ACCENT }}>
          View all goals <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <p className="text-xs mb-1.5" style={{ color: "#94a3b8" }}>{plan.learning_aim}</p>
      <p className="text-[13px] font-medium" style={{ color: "#f1f5f9" }}>{matched.curriculum_goal}</p>
      <p className="text-[11px] mt-1" style={{ color: "#64748b" }}>{matched.learning_objective}</p>
    </div>
  );
}
