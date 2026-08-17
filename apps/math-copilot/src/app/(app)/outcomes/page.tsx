"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import {
  outcomesApi, getErrorMessage,
  type OutcomesDashboard, type MasteryTopic, type EvidenceEvent, type Insight,
} from "@/lib/api";
import {
  Award, ChevronDown, ChevronUp, RefreshCw, Sparkles, TrendingUp,
  Lightbulb, Target as TargetIcon, ArrowRight, Users,
} from "lucide-react";

const ACCENT = "#a78bfa";

// ── Mastery state colors — categorical badges only, never a bar/percentage
// width for mastery_state itself (see part-3-outcomes-dashboard build
// record for why: mastery_state is categorical, not a scalar). ──────────────
const MASTERY_COLORS: Record<string, string> = {
  "Not Yet Demonstrated": "#64748b",
  "Emerging":             "#fbbf24",
  "Developing":           "#818cf8",
  "Proficient":           "#34d399",
  "Mastered":             "#22d3ee",
};
function masteryColor(state: string) {
  return MASTERY_COLORS[state] ?? MASTERY_COLORS["Not Yet Demonstrated"];
}

function MasteryBadge({ state }: { state: string }) {
  const c = masteryColor(state);
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
      style={{ background: `${c}18`, border: `1px solid ${c}40`, color: c }}>
      {state}
    </span>
  );
}

function TopicCard({ topic, learnerEmail }: { topic: MasteryTopic; learnerEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
    if (!open && evidence === null) {
      setLoading(true);
      outcomesApi.getEvidence(topic.subject, topic.topic === "general" ? undefined : topic.topic, learnerEmail)
        .then(({ data }) => setEvidence(data))
        .catch(() => setEvidence([]))
        .finally(() => setLoading(false));
    }
    setOpen(v => !v);
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none" onClick={toggle}>
        <span className="text-xs font-medium capitalize flex-1 truncate" style={{ color: "#cbd5e1" }}>
          {topic.subject.replace(/_/g, " ")}{topic.topic !== "general" ? ` — ${topic.topic}` : ""}
        </span>
        <MasteryBadge state={topic.mastery_state} />
        <span className="text-[10px] hidden sm:block flex-shrink-0" style={{ color: "#475569" }}>
          {topic.evidence_count} evidence · {topic.independent_correct_count} independent-correct
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} />
               : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} />}
      </div>
      {open && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] pt-3 pb-2 uppercase tracking-widest font-semibold" style={{ color: "#334155" }}>
            Evidence Portfolio™
          </p>
          {loading ? (
            <p className="text-xs" style={{ color: "#475569" }}>Loading…</p>
          ) : !evidence || evidence.length === 0 ? (
            <p className="text-xs" style={{ color: "#475569" }}>No evidence events found.</p>
          ) : (
            <div className="space-y-1.5">
              {evidence.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-[11px] flex-wrap">
                  <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                    {e.source}
                  </span>
                  <span style={{ color: "#475569" }}>{e.independence_level}</span>
                  <span style={{ color: "#334155" }}>· {e.bloom_level}</span>
                  {e.is_correct !== null && e.is_correct !== undefined && (
                    <span style={{ color: e.is_correct ? "#34d399" : "#f87171" }}>
                      {e.is_correct ? "correct" : "incorrect"}
                    </span>
                  )}
                  <span className="ml-auto" style={{ color: "#334155" }}>
                    {e.created_at ? new Date(e.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon: Icon, label, text, color }: { icon: any; label: string; text: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: `${color}0d`, border: `1px solid ${color}28` }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>{label}</span>
      </div>
      <p className="text-sm" style={{ color: "#cbd5e1" }}>{text}</p>
    </div>
  );
}

export default function OutcomesPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const learnerEmail = searchParams.get("learner_email") || undefined;

  const [dashboard, setDashboard] = useState<OutcomesDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  useEffect(() => {
    setDashboardLoading(true); setDashboardError(null);
    outcomesApi.getDashboard(learnerEmail)
      .then(({ data }) => setDashboard(data))
      .catch(err => setDashboardError(getErrorMessage(err)))
      .finally(() => setDashboardLoading(false));
  }, [learnerEmail]);

  useEffect(() => {
    if (!dashboard) return;
    setInsightLoading(true); setInsightError(null);
    outcomesApi.getInsights({ learnerEmail })
      .then(({ data }) => setInsight(data))
      .catch(err => setInsightError(getErrorMessage(err)))
      .finally(() => setInsightLoading(false));
    // Re-fetch only when the identity being viewed changes, or once the
    // dashboard has loaded for the first time — not on every dashboard
    // object identity change, since getInsights is itself cached server-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerEmail, !!dashboard]);

  const handleRefreshInsights = () => {
    setInsightLoading(true); setInsightError(null);
    outcomesApi.getInsights({ learnerEmail, force: true })
      .then(({ data }) => setInsight(data))
      .catch(err => setInsightError(getErrorMessage(err)))
      .finally(() => setInsightLoading(false));
  };

  const isViewingOther = !!dashboard && !!user?.email && dashboard.learner_email.toLowerCase() !== user.email.toLowerCase();
  const maxWeek = Math.max(...(dashboard?.trends.map(w => w.evidence_count) ?? [0]), 1);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}26`, border: `1px solid ${ACCENT}40` }}>
            <Award className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Academic Outcomes
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Academic Outcomes / Mastery Dashboard™
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Everything here is computed directly from your evidence — real Practice Check attempts and tool activity, never a guessed score.
        </p>
      </div>

      {isViewingOther && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-6"
          style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.28)" }}>
          <span className="text-xs flex items-center gap-2" style={{ color: ACCENT }}>
            <Users className="w-3.5 h-3.5" />
            Viewing {dashboard!.learner_name}'s dashboard ({dashboard!.learner_email})
          </span>
          <Link href="/outcomes" className="text-xs font-semibold flex-shrink-0" style={{ color: ACCENT }}>
            Return to my dashboard →
          </Link>
        </div>
      )}

      {dashboardError && (
        <div className="rounded-xl px-4 py-3 mb-6 text-xs"
          style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
          {dashboardError}
        </div>
      )}

      {dashboardLoading && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <Award className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm" style={{ color: "#475569" }}>Loading your Academic Outcomes…</p>
        </div>
      )}

      {dashboard && !dashboardLoading && dashboard.topics.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <TargetIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm mb-4" style={{ color: "#475569" }}>Not Yet Demonstrated — no evidence logged yet.</p>
          <Link href="/practice" className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-semibold"
            style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
            Try a Check My Work problem <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {dashboard && !dashboardLoading && dashboard.topics.length > 0 && (
        <div className="space-y-6">

          {/* Per-topic mastery */}
          <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#475569" }}>Mastery by Topic</p>
            <p className="text-[11px] mb-5" style={{ color: "#334155" }}>
              Independent, correct Practice Check attempts count most toward advancing a mastery state.
            </p>
            <div className="space-y-2">
              {dashboard.topics.map(t => (
                <TopicCard key={`${t.subject}::${t.topic}`} topic={t} learnerEmail={learnerEmail} />
              ))}
            </div>
          </div>

          {/* Career competency rollup */}
          {dashboard.career_competencies.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#475569" }}>Career Competency Rollup</p>
              <p className="text-[11px] mb-5" style={{ color: "#334155" }}>
                Evidence grouped by the Career Mathematics Competency Registry™ from your active learning plan.
              </p>
              <div className="space-y-2">
                {dashboard.career_competencies.map(cc => (
                  <div key={cc.career_competency_key} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-xs font-medium flex-1 truncate" style={{ color: "#cbd5e1" }}>
                      {cc.career_competency_key.replace(/_/g, " ")}
                    </span>
                    <MasteryBadge state={cc.mastery_state} />
                    <span className="text-[10px] hidden sm:block flex-shrink-0" style={{ color: "#475569" }}>
                      {cc.evidence_count} evidence
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend over time */}
          <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
                Evidence Over Time — Last {dashboard.trends.length} Weeks
              </p>
            </div>
            <div className="flex items-end gap-2 h-28">
              {dashboard.trends.map(w => (
                <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: "#64748b" }}>{w.evidence_count || ""}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${(w.evidence_count / maxWeek) * 80}px`,
                      minHeight: w.evidence_count ? 4 : 0,
                      background: w.evidence_count ? `${ACCENT}8c` : "rgba(255,255,255,0.04)",
                    }} />
                  {w.independent_correct_count > 0 && (
                    <span className="text-[9px]" style={{ color: "#34d399" }}>{w.independent_correct_count} ind.</span>
                  )}
                  <span className="text-[9px]" style={{ color: "#334155" }}>
                    {new Date(w.week_start).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights & Next Steps */}
          <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
                  AI Insights &amp; Next Steps™
                </p>
              </div>
              <div className="flex items-center gap-2">
                {insight && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: insight.from_cache ? "rgba(255,255,255,0.05)" : "rgba(52,211,153,0.12)",
                      color: insight.from_cache ? "#475569" : "#34d399",
                    }}>
                    {insight.from_cache ? "cached" : "just generated"}
                  </span>
                )}
                <button onClick={handleRefreshInsights} disabled={insightLoading}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
                  <RefreshCw className={`w-3 h-3 ${insightLoading ? "animate-spin" : ""}`} />
                  {insightLoading ? "Refreshing…" : "Refresh insights"}
                </button>
              </div>
            </div>
            <p className="text-[11px] mb-5" style={{ color: "#334155" }}>
              Interprets the mastery data above in plain language — it never invents a score or a mastery level of its own.
            </p>

            {insightError && (
              <div className="rounded-xl px-4 py-3 mb-4 text-xs"
                style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
                {insightError}
              </div>
            )}

            {insightLoading && !insight ? (
              <div className="grid sm:grid-cols-3 gap-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-2xl p-5 h-28 animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            ) : insight ? (
              <div className="grid sm:grid-cols-3 gap-4">
                <InsightCard icon={Sparkles} label="Strengths" text={insight.strengths} color="#34d399" />
                <InsightCard icon={Lightbulb} label="Opportunities" text={insight.opportunities} color="#fbbf24" />
                <InsightCard icon={ArrowRight} label="Next Steps" text={insight.next_steps} color={ACCENT} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
