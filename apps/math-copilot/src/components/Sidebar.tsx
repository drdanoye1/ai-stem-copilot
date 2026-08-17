"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Calculator, BookOpen, PenLine,
  TrendingUp, LogOut, GraduationCap, BarChart3, FlaskConical, Globe, Camera,
  Microscope, Compass, Layers, Scan, Lock, BrainCircuit, Database, Zap, Settings, Bookmark, Users,
  Menu, Target, Award, ClipboardCheck, Briefcase, FileSearch, CreditCard, HelpCircle,
  ShieldCheck, SlidersHorizontal, GitBranch, Server, Activity, Tag, Repeat, Building2,
  Receipt, Plug, History,
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  color?: string;
  locked?: boolean;
};

type NavGroup = {
  title: string | null;
  items: NavItem[];
};

// ── Learner tree (roles: student, teacher, parent) ───────────────────────────
// Reorganized per the Workspace, Sidebar Navigation & Role-Based Dashboard
// Architecture brief. Phase 1: static grouping + locked placeholders only —
// no interactive workspace switcher (Phase 3) and no collapsible groups
// (Phase 2) yet. Existing labels "Dashboard", "Practice Problems", and
// "Saved Outputs" are kept exactly as-is per explicit user instruction.

const LEARNER_NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Learn",
    items: [
      { href: "/solve",         label: "AI Math Solver",    icon: Calculator                     },
      { href: "/explore",       label: "Topic Explorer",    icon: BookOpen                       },
      { href: "/practice",      label: "Practice Problems", icon: PenLine                        },
      { href: "/assessments",   label: "Assessments",       icon: ClipboardCheck, locked: true   },
      { href: "/mentor",        label: "AI Mentor",         icon: BrainCircuit                   },
    ],
  },
  {
    title: "Explore",
    items: [
      { href: "/theory",        label: "Theory Lesson",     icon: GraduationCap, color: "#fbbf24" },
      { href: "/visualization", label: "Visualization",     icon: BarChart3,     color: "#22d3ee" },
      { href: "/simulation",    label: "Simulation",        icon: FlaskConical,  color: "#34d399" },
      { href: "/applications",  label: "Real-World Apps",   icon: Globe,         color: "#818cf8" },
      { href: "/scenario",      label: "Scenario",          icon: Camera,        color: "#f97316" },
      { href: "/data-explorer", label: "Data Explorer",     icon: Database,      color: "#06b6d4" },
      { href: "/lab",           label: "Virtual Math Lab",  icon: Microscope,    color: "#10b981" },
      { href: "/ar-lab",        label: "AR / VR Lab",       icon: Scan,          color: "#f43f5e" },
      { href: "/digital-twin",  label: "Digital Twin",      icon: Layers,        color: "#f59e0b" },
      { href: "/projects",      label: "Discovery Projects",icon: Compass,       color: "#8b5cf6" },
    ],
  },
  {
    title: "My Learning",
    items: [
      { href: "/goals",              label: "My Goals",             icon: Target                          },
      { href: "/progress",           label: "My Progress",          icon: TrendingUp                      },
      { href: "/outcomes",           label: "Academic Outcomes",    icon: Award                           },
      { href: "/career-readiness",   label: "Career Readiness",     icon: Briefcase,   locked: true       },
      { href: "/evidence-portfolio", label: "Evidence Portfolio",   icon: FileSearch,  locked: true       },
      { href: "/saved",              label: "Saved Outputs",        icon: Bookmark                        },
    ],
  },
  {
    title: "Teacher / Parent",
    items: [
      { href: "/parent", label: "Parent / Teacher", icon: Users },
    ],
  },
];

// ── Administrator tree (role: admin) ──────────────────────────────────────────
// A separate tree from the Learner tree, per the brief. Only two links are
// real today (Academic Outcomes, Plans & Pricing) — everything else is a
// locked placeholder for the Phase 3 Administration workspace build-out.
//
// IMPORTANT: an admin account still needs full access to every learner tool
// (Solve, Explore, Practice, AR/VR Lab, Mentor, etc.) to actually use/test the
// platform day to day — the old flat sidebar gave every role access to all of
// it. Rather than build the full Phase-3 "Workspace ▼" switcher now, the
// Sidebar component below adds a minimal two-way toggle (Learner Tools /
// Administration) so admin never loses that access while this tree is
// otherwise mostly placeholders.

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: "Administration",
    items: [
      { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck, locked: true },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users",          label: "Users & Access",          icon: Users,              locked: true },
      { href: "/admin/academic-config",label: "Academic Configuration",  icon: SlidersHorizontal,  locked: true },
      { href: "/admin/content",        label: "Content & Experiences",   icon: Layers,             locked: true },
    ],
  },
  {
    title: "AI Systems",
    items: [
      { href: "/admin/ai-models",      label: "AI Models",      icon: BrainCircuit, locked: true },
      { href: "/admin/ai-routing",     label: "Model Routing",  icon: GitBranch,    locked: true },
      { href: "/admin/ai-providers",   label: "Providers",      icon: Server,       locked: true },
      { href: "/admin/ai-performance", label: "AI Performance", icon: Activity,     locked: true },
    ],
  },
  {
    title: "Outcomes",
    items: [
      { href: "/admin/analytics",           label: "Learning Analytics",     icon: BarChart3,      locked: true  },
      { href: "/outcomes",                  label: "Academic Outcomes",      icon: Award                          },
      { href: "/admin/career-readiness",    label: "Career Readiness",       icon: Briefcase,       locked: true  },
      { href: "/admin/assessment-analytics",label: "Assessment Analytics",   icon: ClipboardCheck,  locked: true  },
    ],
  },
  {
    title: "Billing & Commercial",
    items: [
      { href: "/admin/billing",        label: "Billing Dashboard",        icon: CreditCard, locked: true },
      { href: "/pricing",              label: "Plans & Pricing",          icon: Tag                     },
      { href: "/admin/subscriptions",  label: "Subscriptions",            icon: Repeat,      locked: true },
      { href: "/admin/licenses",       label: "Institutional Licenses",   icon: Building2,   locked: true },
      { href: "/admin/usage",          label: "Usage & Credits",          icon: Zap,         locked: true },
      { href: "/admin/invoices",       label: "Invoices",                 icon: Receipt,     locked: true },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/settings",     label: "Platform Settings", icon: Settings, locked: true },
      { href: "/admin/integrations", label: "Integrations",      icon: Plug,     locked: true },
      { href: "/admin/audit",        label: "Audit / Activity",  icon: History,  locked: true },
    ],
  },
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
  // Admin-only view toggle (temporary stand-in for the Phase 3 Workspace ▼
  // switcher). Defaults to "learner" so an admin account never lands on a
  // tree with no way to reach Solve/Explore/AR-VR/Mentor/etc. — those tools
  // only live in the Learner tree until Phase 3 links them into Admin too.
  const [adminView, setAdminView] = useState<"learner" | "admin">("learner");

  const handleLogout = () => { logout(); router.push("/login"); };

  const isAdmin = user?.role === "admin";
  const showingLearnerTree = !isAdmin || adminView === "learner";
  const groups: NavGroup[] = showingLearnerTree ? LEARNER_NAV_GROUPS : ADMIN_NAV_GROUPS;

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
        {isAdmin && !collapsed && (
          <div className="flex gap-1 p-1 mb-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => setAdminView("learner")}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color:      adminView === "learner" ? "var(--brand-cyan)" : "var(--text-muted)",
                background: adminView === "learner" ? "rgba(34,211,238,0.10)" : "transparent",
              }}
            >
              Learner Tools
            </button>
            <button
              onClick={() => setAdminView("admin")}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color:      adminView === "admin" ? "var(--brand-cyan)" : "var(--text-muted)",
                background: adminView === "admin" ? "rgba(34,211,238,0.10)" : "transparent",
              }}
            >
              Administration
            </button>
          </div>
        )}
        {groups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`}>
            {group.title && !collapsed && (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {group.title}
              </p>
            )}
            {group.items.map(item => <NavLink key={item.href} {...item} />)}
          </div>
        ))}
      </div>

      {/* User profile + logout */}
      <div className="border-t p-3 space-y-1" style={{ borderColor: "var(--border)" }}>
        {showingLearnerTree && (
          <>
            <NavLink href="/billing" label="Billing" icon={CreditCard} locked />
            <NavLink href="/help"    label="Help"    icon={HelpCircle} locked />
          </>
        )}
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
