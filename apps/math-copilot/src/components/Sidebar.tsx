"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Calculator, BookOpen, PenLine,
  TrendingUp, LogOut, ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard",         icon: LayoutDashboard },
  { href: "/solve",     label: "AI Math Solver",    icon: Calculator      },
  { href: "/explore",   label: "Topic Explorer",    icon: BookOpen        },
  { href: "/practice",  label: "Practice Problems", icon: PenLine         },
  { href: "/progress",  label: "My Progress",       icon: TrendingUp      },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push("/login"); };

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: "var(--sidebar-bg)" }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b border-indigo-900/60">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="text-white text-2xl font-light">∑</span>
          <div>
            <div className="text-white text-sm font-bold leading-tight">AI Mathematics</div>
            <div className="text-indigo-300 text-[10px] font-medium">Copilot™</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={`sidebar-link ${active ? "active" : ""}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-indigo-900/60">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-medium truncate">{user?.full_name || user?.email}</div>
            <div className="text-indigo-300 text-[10px] capitalize">{user?.level?.replace(/_/g, " ")}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full sidebar-link text-red-300 hover:text-red-200 hover:bg-red-900/30">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
