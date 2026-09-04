import { type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider, areaAccess, useSession } from "./lib/session";
import { AppShell } from "./components/layout";
import { TicketDetail } from "./components/TicketDetail";
import { Logo } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { PortalPage } from "./pages/PortalPage";
import { DepartmentPage } from "./pages/DepartmentPage";
import { ManagementPage } from "./pages/ManagementPage";
import { AdminPage } from "./pages/AdminPage";
import type { Role } from "./lib/types";

function homeFor(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN": return "/admin";
    case "MANAGEMENT": return "/management";
    case "DEPT_HEAD":
    case "DEPT_MEMBER": return "/departments";
    default: return "/portal";
  }
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <Logo size={34} />
        <div>
          <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-zinc-50">Listening Wall</p>
          <p className="pulse-dot text-[11px] font-medium text-gray-400 dark:text-zinc-600">Restoring session…</p>
        </div>
      </div>
    </div>
  );
}

/** Route guard: enforces RBAC areas and authentication. */
function Guard({ area, children }: { area: "portal" | "departments" | "management" | "admin"; children: ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!areaAccess(user.role, area)) return <Navigate to={homeFor(user.role)} replace />;
  return <AppShell>{children}</AppShell>;
}

function RootRedirect() {
  const { user, ready } = useSession();
  if (!ready) return <Splash />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

function LoginRoute() {
  const { user, ready } = useSession();
  if (!ready) return <Splash />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <LoginPage />;
}

function TicketRoute() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const from = params.get("from");
  const back =
    from === "departments" ? "/departments" : from === "management" ? "/management" : "/portal";
  return (
    <TicketDetail id={id ?? ""} onBack={() => navigate(back)} />
  );
}

function Shell() {
  const { resolvedTheme } = useTheme();
  return (
    <>
      <Toaster
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: "13px",
            borderRadius: "6px",
          },
        }}
        closeButton
      />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/portal"
          element={
            <Guard area="portal">
              <PortalPage />
            </Guard>
          }
        />
        <Route
          path="/departments"
          element={
            <Guard area="departments">
              <DepartmentPage />
            </Guard>
          }
        />
        <Route
          path="/management"
          element={
            <Guard area="management">
              <ManagementPage />
            </Guard>
          }
        />
        <Route
          path="/admin"
          element={
            <Guard area="admin">
              <AdminPage />
            </Guard>
          }
        />
        <Route
          path="/ticket/:id"
          element={
            <Guard area="portal">
              <TicketRoute />
            </Guard>
          }
        />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="lw-theme">
      <SessionProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </SessionProvider>
    </ThemeProvider>
  );
}
