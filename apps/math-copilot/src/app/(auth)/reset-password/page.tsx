"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { Loader2, KeyRound, ArrowLeft, Eye, EyeOff, Check } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [token, setToken]       = useState(params?.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword(token.trim(), password);
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Reset failed — token may be expired. Request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#05060f" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl" style={{ background: "linear-gradient(135deg,#06b6d4,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>∑</span>
            <span className="text-lg font-bold" style={{ color: "#f1f5f9" }}>AI Mathematics Copilot™</span>
          </Link>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
                <Check className="w-6 h-6" style={{ color: "#34d399" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#f1f5f9" }}>Password updated!</h2>
              <p className="text-sm" style={{ color: "#475569" }}>Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(34,211,238,0.10)" }}>
                  <KeyRound className="w-5 h-5" style={{ color: "#22d3ee" }} />
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "#f1f5f9" }}>Set new password</h1>
                <p className="text-sm" style={{ color: "#475569" }}>
                  Paste your reset token, then choose a new password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Token */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#475569" }}>Reset token</label>
                  <textarea
                    required value={token} onChange={e => setToken(e.target.value)}
                    placeholder="Paste your reset token here…" rows={3}
                    className="w-full px-4 py-3 rounded-xl text-xs outline-none resize-none font-mono"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#94a3b8" }}
                  />
                </div>

                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#475569" }}>New password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
                      className="w-full pr-10 px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#334155" }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#475569" }}>Confirm password</label>
                  <input type="password" required value={confirm}
                    onChange={e => setConfirm(e.target.value)} placeholder="Repeat your new password"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}
                  />
                </div>

                {error && <p className="text-xs" style={{ color: "#f43f5e" }}>{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#0f172a" }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : "Update password"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#334155" }}>
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05060f" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#22d3ee" }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
