import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  BarChart3,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useSession, areaAccess } from "../lib/session";
import { initials } from "../lib/format";
import { Logo, RoleBadge } from "./ui";
import { cn } from "../lib/cn";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  area: "portal" | "departments" | "management" | "admin";
  section: string;
}

const NAV: NavItem[] = [
  { to: "/portal", label: "Employee Portal", icon: <Inbox className="h-4 w-4" aria-hidden />, area: "portal", section: "Workspace" },
  { to: "/departments", label: "Department Queue", icon: <Layers className="h-4 w-4" aria-hidden />, area: "departments", section: "Workspace" },
  { to: "/management", label: "Insights", icon: <BarChart3 className="h-4 w-4" aria-hidden />, area: "management", section: "Oversight" },
  { to: "/admin", label: "Administration", icon: <ShieldCheck className="h-4 w-4" aria-hidden />, area: "admin", section: "Oversight" },
];

const TITLES: Record<string, string> = {
  "/portal": "Employee Portal",
  "/departments": "Department Queue",
  "/management": "Management Insights",
  "/admin": "Administration",
};

function pageTitle(path: string): string {
  if (path.startsWith("/ticket/")) return "Ticket";
  for (const key of Object.keys(TITLES)) if (path.startsWith(key)) return TITLES[key];
  return "Listening Wall";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useSession();
  const items = NAV.filter((n) => areaAccess(user?.role, n.area));
  const sections = Array.from(new Set(items.map((i) => i.section)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
        <Logo size={30} />
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-zinc-50">Listening Wall</p>
          <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-500">Internal feedback OS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-2.5" aria-label="Primary">
        {sections.map((section) => (
          <div key={section}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">
              {section}
            </p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.section === section)
                .map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-150",
                          isActive
                            ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-zinc-800">
        <div className="rounded-md bg-white px-3 py-2.5 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            <p className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">All systems operational</p>
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400 dark:text-zinc-600">v1.4.2 · sandbox data · resets on demand</p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setDrawer(false), [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-gray-200 bg-gray-50 lg:block dark:border-zinc-800 dark:bg-zinc-900/60">
        <SidebarContent />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-950/40 dark:bg-black/60" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-gray-200 bg-gray-50 rise dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* topbar */}
        <header className="sticky top-0 z-20 flex h-13 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/95">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Menu className="h-4.5 w-4.5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">{pageTitle(location.pathname)}</h1>
          </div>

          {user?.demo && (
            <span className="hidden rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 sm:inline dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              Demo session
            </span>
          )}

          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>

          {user && (
            <div className="flex items-center gap-2.5 border-l border-gray-200 pl-3 dark:border-zinc-800">
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-semibold leading-tight">{user.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                  {user.role === "ANONYMOUS" ? "masked identity" : user.email}
                </p>
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
                aria-hidden
              >
                {initials(user.name)}
              </div>
              <RoleBadge role={user.role} />
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
