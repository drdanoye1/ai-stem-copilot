"use client";
/**
 * Google Sign-In button using NextAuth.
 *
 * On success, NextAuth calls /api/auth/callback/google → our backend
 * /auth/oauth/google, which returns a JWT.  After sign-in we store that
 * JWT in localStorage so the rest of the app (Zustand authStore) picks it up.
 *
 * Setup: add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET,
 * and NEXTAUTH_URL to your .env.local / Vercel environment.
 */
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

export function GoogleSignInButton({ label = "Sign in with Google" }: { label?: string }) {
  const router    = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await signIn("google", { redirect: false, callbackUrl: "/dashboard" });
      if (result?.error) {
        setLoading(false);
        return;
      }
      // After OAuth, the session contains the backend token.
      // Poll the session briefly then redirect.
      // The OAuth callback already stored the token via NextAuth callbacks.
      router.push("/dashboard");
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 border hover:bg-gray-50 active:bg-gray-100"
      style={{ borderColor: "#e5e7eb", color: "#374151", background: "#fff" }}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
      )}
      {loading ? "Connecting…" : label}
    </button>
  );
}
