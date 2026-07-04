"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

const LEVELS = [
  { value: "middle_school", label: "Middle School (ages 11–14)" },
  { value: "high_school",   label: "High School (ages 14–18)" },
  { value: "ap_ib",         label: "AP / IB Advanced" },
  { value: "university",    label: "University / College" },
  { value: "graduate",      label: "Graduate / Postgraduate" },
  { value: "professional",  label: "Professional / Researcher" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", level: "high_school" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.register(form);
      setAuth(data.access_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        level: data.level,
        sessions_count: "0",
        created_at: "",
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-violet-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-brand-700 font-bold text-xl">
            <span className="text-3xl">∑</span>
            AI Mathematics Copilot™
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Create your free account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input type="text" value={form.full_name} onChange={(e) => set("full_name", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={form.password} onChange={(e) => set("password", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your education level</label>
              <select value={form.level} onChange={(e) => set("level", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-60 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: "var(--brand-gradient)" }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create free account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
