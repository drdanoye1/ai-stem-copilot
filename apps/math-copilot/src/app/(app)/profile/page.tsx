"use client";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { User, GraduationCap, Mail, Shield, Clock, Check, Loader2, Edit3 } from "lucide-react";

const LEVELS = [
  { value: "pre_k",         label: "Pre-K / Kindergarten",    sub: "Ages 3–6" },
  { value: "middle_school", label: "Middle School",           sub: "Ages 11–14" },
  { value: "high_school",   label: "High School",             sub: "Ages 14–18" },
  { value: "ap_ib",         label: "AP / IB Advanced",        sub: "Advanced secondary" },
  { value: "university",    label: "University / College",     sub: "Undergraduate" },
  { value: "graduate",      label: "Graduate / Postgraduate",  sub: "Masters & PhD" },
  { value: "professional",  label: "Professional / Researcher",sub: "Industry & research" },
];

const ROLE_LABELS: Record<string, string> = {
  student:  "Student",
  teacher:  "Educator",
  parent:   "Parent",
  admin:    "Administrator",
};

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const token = typeof window !== "undefined" ? localStorage.getItem("math_copilot_token") : null;

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [level, setLevel]       = useState(user?.level ?? "high_school");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { data } = await authApi.updateProfile({ full_name: fullName, level });
      // Refresh the store so all pages see the updated data immediately
      if (token) {
        setAuth(token, {
          ...data,
          sessions_count: data.sessions_count ?? user?.sessions_count ?? "0",
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Could not save changes — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.full_name?.[0] || user?.email?.[0] || "?").toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#22d3ee" }}>
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Your Profile
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Update your display name and education level — changes apply immediately across the platform.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">

        {/* Left: profile card */}
        <div className="rounded-2xl p-6 flex flex-col items-center text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mb-4 text-white"
            style={{ background: "linear-gradient(135deg, #06b6d4, #818cf8)", boxShadow: "0 0 24px rgba(34,211,238,0.25)" }}>
            {initials}
          </div>

          <p className="text-base font-bold mb-0.5" style={{ color: "#f1f5f9" }}>
            {user?.full_name || "—"}
          </p>
          <p className="text-xs mb-4" style={{ color: "#475569" }}>{user?.email}</p>

          {/* Role badge */}
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{
              background: user?.role === "admin" ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.06)",
              border: user?.role === "admin" ? "1px solid rgba(167,139,250,0.30)" : "1px solid rgba(255,255,255,0.12)",
              color: user?.role === "admin" ? "#a78bfa" : "#64748b",
            }}>
            {ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "Student"}
          </span>

          {/* Meta info */}
          <div className="w-full mt-6 space-y-3 text-left">
            {[
              { icon: Mail,          label: "Email",        value: user?.email ?? "—" },
              { icon: GraduationCap, label: "Level",        value: LEVELS.find(l => l.value === user?.level)?.label ?? "—" },
              { icon: Shield,        label: "Role",         value: ROLE_LABELS[user?.role ?? ""] ?? "—" },
              { icon: Clock,         label: "Member since", value: memberSince },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#334155" }} />
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#334155" }}>{label}</div>
                  <div className="text-xs" style={{ color: "#94a3b8" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: edit form */}
        <div className="md:col-span-2">
          <div className="rounded-2xl p-7"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

            <div className="flex items-center gap-2 mb-6">
              <Edit3 className="w-4 h-4" style={{ color: "#22d3ee" }} />
              <span className="text-sm font-bold" style={{ color: "#f1f5f9" }}>Edit Details</span>
            </div>

            <form onSubmit={handleSave} className="space-y-5">

              {/* Full name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#475569" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#f1f5f9",
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.40)"}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"}
                />
                <p className="text-[10px] mt-1.5" style={{ color: "#334155" }}>
                  This is how your name appears on the dashboard and sidebar.
                </p>
              </div>

              {/* Education level */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#475569" }}>
                  Education Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LEVELS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLevel(l.value)}
                      className="text-left p-3 rounded-xl transition-all"
                      style={{
                        background: level === l.value ? "rgba(34,211,238,0.10)" : "rgba(255,255,255,0.03)",
                        border: level === l.value
                          ? "1px solid rgba(34,211,238,0.35)"
                          : "1px solid rgba(255,255,255,0.08)",
                      }}>
                      <div className="text-xs font-semibold" style={{ color: level === l.value ? "#22d3ee" : "#94a3b8" }}>
                        {l.label}
                      </div>
                      <div className="text-[10px]" style={{ color: "#334155" }}>{l.sub}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] mt-2" style={{ color: "#334155" }}>
                  AI responses and practice problems will be calibrated to this level.
                </p>
              </div>

              {/* Email — read-only */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#475569" }}>
                  Email Address <span style={{ color: "#334155" }}>(read-only)</span>
                </label>
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#334155",
                    cursor: "not-allowed",
                  }}
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "#f43f5e" }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: saved
                    ? "linear-gradient(135deg, #059669, #34d399)"
                    : "linear-gradient(135deg, #0e7490, #22d3ee)",
                  color: "#0f172a",
                  opacity: saving ? 0.75 : 1,
                }}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : saved ? (
                  <><Check className="w-4 h-4" /> Profile updated!</>
                ) : (
                  "Save changes"
                )}
              </button>
            </form>
          </div>

          {/* Account stats */}
          <div className="mt-4 rounded-xl p-5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#334155" }}>
              Account Stats
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Sessions", value: user?.sessions_count ?? "0" },
                { label: "Account ID",     value: user?.id ? user.id.slice(0, 8) + "…" : "—" },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-xs font-bold" style={{ color: "#f1f5f9" }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: "#334155" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
