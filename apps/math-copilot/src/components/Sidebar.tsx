"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Calculator, BookOpen, PenLine,
  TrendingUp, LogOut, GraduationCap, BarChart3, FlaskConical, Globe, Camera,
  Microscope, Compass, Layers, Scan, Lock, BrainCircuit, Database, Zap, Settings, Bookmark, Users,
  Menu,
} from "lucide-react";
import { useState } from "react";

const LEVEL_LABELS: Record<string, string> = {
  pre_k:         "Pre-K",
  middle_school: "Middle School",
  high_school:   "High School",
  ap_ib:         "AP / IB",
  university:    "University",
  graduate:      "Graduate",
  professional:  "Professional",
};

const NAV_CORE = [
  { href: "/dashboard", label: "Dashboard",         icon: LayoutDashboard },
  { href: "/solve",     label: "AI Math Solver",    icon: Calculator      },
  { href: "/explore",   label: "Topic Explorer",    icon: BookOpen        },
  { href: "/practice",  label: "Practice Problems", icon: PenLine         },
  { href: "/progress",  label: "My Progress",       icon: TrendingUp      },
  { href: "/saved",     label: "Saved Outputs",     icon: Bookmark        },
  { href: "/parent",    label: "Parent / Teacher",  icon: Users           },
];

const NAV_INTELLIGENCE = [
  { href: "/theory",        label: "Theory Lesson",    icon: GraduationCap, color: "#fbbf24" },
  { href: "/visualization", label: "Visualization",    icon: BarChart3,     color: "#22d3ee" },
  { href: "/simulation",    label: "Simulation",       icon: FlaskConical,  color: "#34d399" },
  { href: "/applications",  label: "Real-World Apps",  icon: Globe,         color: "#818cf8" },
  { href: "/scenario",      label: "Scenario",         icon: Camera,        color: "#f97316" },
  { href: "/mentor",         label: "AI Mentor",        icon: BrainCircuit,  color: "#a855f7" },
  { href: "/data-explorer",  label: "Data Explorer",    icon: Database,      color: "#06b6d4" },
];

const NAV_EXPERIENTIAL = [
  { href: "/lab",          label: "Virtual Math Lab",  icon: Microscope, color: "#10b981", locked: false },
  { href: "/projects",     label: "Discovery Projects",icon: Compass,    color: "#8b5cf6", locked: false },
  { href: "/digital-twin", label: "Digital Twin",      icon: Layers,     color: "#f59e0b", locked: false },
  { href: "/ar-lab",       label: "AR / VR Lab",       icon: Scan,       color: "#f43f5e", locked: false },
];

// ── Mobile bottom nav (shown only on small screens) ──────────────────────────

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/solve",     label: "Solve",    icon: Calculator      },
  { href: "/explore",   label: "Explore",  icon: BookOpen        },
  { href: "/practice",  label: "Practice", icon: PenLine         },
  { href: "/progress",  label: "Progress", icon: TrendingUp      },
];

export function MobileNav() {

  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors"
            style={{ color: active ? "var(--brand-cyan)" : "var(--text-muted)" }}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); router.push("/login"); };

  const NavLink = ({ href, label, icon: Icon, color, locked }: {
    href: string; label: string; icon: React.ElementType;
    color?: string; locked?: boolean;
  }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={locked ? "#" : href}
        className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative"
        style={{
          color:      active ? "var(--brand-cyan)" : "var(--text-muted)",
          background: active ? "rgba(34,211,238,0.08)" : "transparent",
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? "var(--brand-cyan)" : (color ?? "var(--text-muted)") }} />
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && locked && <Lock className="w-3 h-3 ml-auto opacity-50" />}
      </Link>
    );
  };

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 border-r transition-all duration-300"
      style={{
        width:       collapsed ? 64 : 240,
        background:  "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-light flex-shrink-0"
          style={{ background: "var(--brand-gradient)", boxShadow: "0 0 16px rgba(34,211,238,0.25)" }}
        >
          ∑
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>AI Math Copilot™</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto p-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {/* Core */}
        {NAV_CORE.map(item => <NavLink key={item.href} {...item} />)}

        {/* Intelligence */}
        {!collapsed && (
          <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Intelligence
          </p>
        )}
        {NAV_INTELLIGENCE.map(item => <NavLink key={item.href} {...item} />)}

        {/* Experiential */}
        {!collapsed && (
          <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Experiential
          </p>
        )}
        {NAV_EXPERIENTIAL.map(item => <NavLink key={item.href} {...item} />)}
      </div>

      {/* User profile + logout */}
      <div className="border-t p-3 space-y-1" style={{ borderColor: "var(--border)" }}>
        {user && !collapsed && (
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.full_name || user.email}</p>
              <p className="truncate">{LEVEL_LABELS[user.level ?? ""] ?? user.level} · {user.role}</p>
            </div>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
