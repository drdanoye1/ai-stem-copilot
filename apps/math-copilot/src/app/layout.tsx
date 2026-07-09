import type { Metadata } from "next";
import "./globals.css";
import { NextAuthProvider } from "@/components/NextAuthProvider";

export const metadata: Metadata = {
  title: "AI Mathematics Copilot™ — Your AI Math Tutor",
  description: "Solve any math problem step-by-step, explore concepts, and practice with AI-generated problems.",
  keywords: ["math tutor", "AI mathematics", "calculus", "algebra", "step by step math"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  );
}
