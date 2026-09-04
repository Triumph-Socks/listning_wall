import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import * as api from "../lib/api";
import { useSession } from "../lib/session";
import type { Role, SessionUser } from "../lib/types";
import { Button, FieldError, Input, Label, Logo, Select, Switch, Tabs } from "../components/ui";
import { cn } from "../lib/cn";

const emailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid company email"),
  password: z.string().min(1, "Password is required"),
});
type EmailForm = z.infer<typeof emailSchema>;

const keySchema = z.object({
  key: z.string().min(6, "Access keys look like LW-XXXX-0000"),
});
type KeyForm = z.infer<typeof keySchema>;

const DEMO_ROLES: { role: Role; label: string; desc: string }[] = [
  { role: "SUPER_ADMIN", label: "Super Admin", desc: "Full control · users, keys, flags" },
  { role: "MANAGEMENT", label: "Management", desc: "Analytics dashboard, read-only" },
  { role: "DEPT_HEAD", label: "Dept Head (IT)", desc: "Assign, prioritize, resolve" },
  { role: "DEPT_MEMBER", label: "Dept Member (IT)", desc: "Work assigned tickets" },
  { role: "EMPLOYEE", label: "Employee", desc: "Submit & track feedback" },
  { role: "ANONYMOUS", label: "Anonymous", desc: "Masked session via access key" },
];

const QUICK_ACCOUNTS = [
  { label: "Super Admin", email: "ava@wall.co" },
  { label: "Management", email: "marcus@wall.co" },
  { label: "IT Head", email: "priya@wall.co" },
  { label: "IT Member", email: "jonas@wall.co" },
  { label: "Employee", email: "noah@wall.co" },
];

function homeFor(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN": return "/admin";
    case "MANAGEMENT": return "/management";
    case "DEPT_HEAD":
    case "DEPT_MEMBER": return "/departments";
    default: return "/portal";
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [tab, setTab] = useState("email");
  const [showPw, setShowPw] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoRole, setDemoRole] = useState<Role>("EMPLOYEE");
  const [demoBusy, setDemoBusy] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });
  const keyForm = useForm<KeyForm>({
    resolver: zodResolver(keySchema),
    defaultValues: { key: "" },
  });

  const finish = (u: SessionUser, demo = false) => {
    setUser(u);
    toast.success(`Signed in as ${u.name}${demo ? " (demo)" : ""}`);
    navigate(homeFor(u.role), { replace: true });
  };

  const onEmail = emailForm.handleSubmit(async (vals) => {
    try {
      const u = await api.login(vals.email, vals.password);
      finish(u);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  });

  const onKey = keyForm.handleSubmit(async (vals) => {
    setKeyBusy(true);
    try {
      const u = await api.loginWithKey(vals.key);
      finish(u);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Key rejected");
    } finally {
      setKeyBusy(false);
    }
  });

  const onDemo = async () => {
    setDemoBusy(true);
    try {
      const u = await api.demoLogin(demoRole);
      finish(u, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Demo sign-in failed");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr] dark:bg-zinc-950">
      {/* brand / context panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-gray-200 bg-gray-50 p-10 lg:flex dark:border-zinc-800 dark:bg-zinc-900/50">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(229 231 235) 1px, transparent 1px), linear-gradient(to bottom, rgb(229 231 235) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 90% 80% at 30% 20%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 30% 20%, black 30%, transparent 75%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-50">Listening Wall</p>
              <p className="text-[12px] font-medium text-gray-500 dark:text-zinc-500">Internal feedback & ticketing</p>
            </div>
          </div>

          <h1 className="mt-12 max-w-md text-3xl font-extrabold leading-[1.15] tracking-tight text-gray-900 dark:text-zinc-50">
            Every concern gets a ticket.
            <br />
            Every ticket gets an owner.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-gray-500 dark:text-zinc-400">
            Ideas, HR issues, IT tickets and complaints — routed to the right department, tracked to resolution, and reported to management. Fully anonymous if you need it to be.
          </p>

          <ol className="mt-10 max-w-md space-y-0">
            {[
              { t: "Submit", d: "Employees raise feedback by email or anonymous access key." },
              { t: "Route & assign", d: "Tickets land in the right department queue with priority and owner." },
              { t: "Resolve with proof", d: "Staff close the loop with remarks and proof of resolution." },
              { t: "Report", d: "Management sees throughput, resolution time and anonymity ratios." },
            ].map((s, i) => (
              <li key={s.t} className={cn("relative flex gap-4 pb-7", i === 3 && "pb-0")}>
                {i < 3 && <span className="absolute left-[13px] top-8 h-[calc(100%-24px)] w-px bg-gray-200 dark:bg-zinc-800" aria-hidden />}
                <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-[12px] font-bold text-blue-600 tnum dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{s.t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500 dark:text-zinc-400">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-[11px] text-gray-400 dark:text-zinc-600">
          SOC2-minded by design · anonymous records store no identity · sandbox build
        </p>
      </div>

      {/* auth panel */}
      <div className="flex items-start justify-center px-4 py-10 sm:items-center sm:px-8">
        <div className="w-full max-w-md rise">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-zinc-50">Listening Wall</p>
            </div>
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 dark:border-zinc-800 dark:text-zinc-400"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-50">Sign in</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">
              Use your company account, or an anonymous access key issued by an administrator.
            </p>

            <div className="mt-4">
              <Tabs
                tabs={[
                  { id: "email", label: "Company email" },
                  { id: "key", label: "Access key" },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>

            {tab === "email" ? (
              <form onSubmit={onEmail} noValidate className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
                    <Input id="email" type="email" autoComplete="email" placeholder="you@wall.co" className="pl-8" invalid={!!emailForm.formState.errors.email} {...emailForm.register("email")} />
                  </div>
                  <FieldError>{emailForm.formState.errors.email?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="pr-9" invalid={!!emailForm.formState.errors.password} {...emailForm.register("password")} />
                    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                      {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                  <FieldError>{emailForm.formState.errors.password?.message}</FieldError>
                </div>
                <Button type="submit" className="w-full" loading={emailForm.formState.isSubmitting}>
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>

                <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">Demo accounts · password “demo1234”</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_ACCOUNTS.map((a) => (
                      <button
                        key={a.email}
                        type="button"
                        onClick={() => {
                          emailForm.setValue("email", a.email);
                          emailForm.setValue("password", "demo1234");
                          emailForm.clearErrors();
                        }}
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={onKey} noValidate className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="access-key">Anonymous access key</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
                    <Input id="access-key" placeholder="LW-KEY-0000" autoComplete="off" className="pl-8 font-mono" invalid={!!keyForm.formState.errors.key} {...keyForm.register("key")} />
                  </div>
                  <FieldError>{keyForm.formState.errors.key?.message}</FieldError>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500 dark:text-zinc-500">
                    You will receive a masked identity like <code className="rounded bg-gray-100 px-1 font-mono text-[11px] text-amber-700 dark:bg-zinc-800 dark:text-amber-300">anon_8f7d9</code>. No email or IP is stored.
                  </p>
                </div>
                <Button type="submit" className="w-full" loading={keyBusy}>
                  <Lock className="h-4 w-4" aria-hidden /> Enter anonymously
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-gray-400 dark:text-zinc-600">
                  Seeded keys:{" "}
                  <button type="button" className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400" onClick={() => { keyForm.setValue("key", "LW-DEMO-4821"); keyForm.clearErrors(); }}>LW-DEMO-4821</button>{" "}
                  (one-time) ·{" "}
                  <button type="button" className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400" onClick={() => { keyForm.setValue("key", "LW-SESSION-7710"); keyForm.clearErrors(); }}>LW-SESSION-7710</button>{" "}
                  (reusable)
                </p>
              </form>
            )}
          </div>

          {/* demo mode */}
          <div className="mt-4 rounded-md border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              aria-expanded={demoOpen}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2.5">
                <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
                <span className="text-left">
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-zinc-100">Enter Demo Mode</span>
                  <span className="block text-[11px] text-gray-500 dark:text-zinc-500">Bypass auth and explore any role instantly</span>
                </span>
              </span>
              <Switch checked={demoOpen} onCheckedChange={setDemoOpen} label="Toggle demo mode" id="demo-toggle" />
            </button>
            {demoOpen && (
              <div className="space-y-3 border-t border-gray-200 p-4 rise dark:border-zinc-800">
                <div>
                  <Label htmlFor="demo-role">Role to simulate</Label>
                  <Select id="demo-role" value={demoRole} onChange={(e) => setDemoRole(e.target.value as Role)}>
                    {DEMO_ROLES.map((r) => (
                      <option key={r.role} value={r.role}>{r.label} — {r.desc}</option>
                    ))}
                  </Select>
                </div>
                <Button className="w-full" variant="subtle" loading={demoBusy} onClick={() => void onDemo()}>
                  <UserRound className="h-4 w-4" aria-hidden /> Launch {DEMO_ROLES.find((r) => r.role === demoRole)?.label} session
                </Button>
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-zinc-600">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Demo sessions are flagged in the top bar and inject mock session data only — nothing is sent anywhere.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
