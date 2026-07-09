"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Loader2, Mail, ArrowLeft, Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await authApi.forgotPassword(email);
      setSent(true);
      if (data.dev_token) setDevToken(data.dev_token);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (devToken) {
      navigator.clipboard.writeText(devToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#05060f" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl" style={{ background: "linear-gradient(135deg,#06b6d4,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ∑
            </span>
            <span className="text-lg font-bold" style={{ color: "#f1f5f9" }}>AI Mathematics Copilot™</span>
          </Link>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {!sent ? (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold mb-1" style={{ color: "#f1f5f9" }}>Reset your password</h1>
                <p className="text-sm" style={{ color: "#475569" }}>
                  Enter your account email and we'll generate a reset token.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#475569" }}>
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#334155" }} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "#f1f5f9",
                      }}
                    />
                  </div>
                </div>

                {error && <p className="text-xs" style={{ color: "#f43f5e" }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#0f172a" }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send reset token"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)" }}>
                <Mail className="w-6 h-6" style={{ color: "#22d3ee" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#f1f5f9" }}>Check your inbox</h2>
              <p className="text-sm mb-6" style={{ color: "#475569" }}>
                If <strong style={{ color: "#94a3b8" }}>{email}</strong> is registered, a reset token has been sent.
              </p>

              {/* Dev mode token display */}
              {devToken && (
                <div className="text-left mb-6 rounded-xl p-4"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.20)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#fbbf24" }}>
                    Dev mode — your reset token
                  </p>
                  <p className="text-[10px] mb-3" style={{ color: "#78716c" }}>
                    In production this would be emailed. Copy and use on the reset page.
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-[10px] break-all leading-relaxed" style={{ color: "#94a3b8" }}>
                      {devToken}
                    </code>
                    <button onClick={copyToken} className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                      style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                      title="Copy token">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <Link
                href="/reset-password"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#0f172a" }}>
                Enter reset token →
              </Link>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs transition-all"
              style={{ color: "#334155" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#94a3b8"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#334155"}>
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
