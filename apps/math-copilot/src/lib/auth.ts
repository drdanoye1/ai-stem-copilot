/**
 * NextAuth configuration — Google OAuth + backend JWT sync.
 *
 * Required env vars (add to .env.local or Vercel project settings):
 *   NEXTAUTH_SECRET=<random 32-char string>
 *   NEXTAUTH_URL=http://localhost:3001   (or your production URL)
 *   GOOGLE_CLIENT_ID=<from Google Cloud Console>
 *   GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
 */
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    /**
     * Called after successful Google sign-in.
     * Syncs the Google user with our FastAPI backend — creates account on
     * first visit, returns an existing one on subsequent logins.
     */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      if (!user.email) return false;

      try {
        const res = await fetch(`${API_BASE}/auth/oauth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:     user.email,
            full_name: user.name  ?? "",
            google_id: account.providerAccountId,
            id_token:  account.id_token ?? "",
          }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        // Attach backend data so we can forward it in the JWT callback
        (user as any).backendToken = data.access_token;
        (user as any).backendRole  = data.role;
        (user as any).backendLevel = data.level;
      } catch {
        return false;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.backendToken = (user as any).backendToken;
        token.backendRole  = (user as any).backendRole;
        token.backendLevel = (user as any).backendLevel;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).backendToken = token.backendToken;
      (session as any).backendRole  = token.backendRole;
      (session as any).backendLevel = token.backendLevel;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
