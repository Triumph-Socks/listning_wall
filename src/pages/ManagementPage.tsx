import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ArrowRight, Clock3, Inbox, Lock, RefreshCw, UserRound } from "lucide-react";
import * as api from "../lib/api";
import type { ManagementStats } from "../lib/api";
import { fmtDuration, timeAgo } from "../lib/format";
import { Button, Card, PanelTitle, Skeleton, StatusBadge } from "../components/ui";
import { cn } from "../lib/cn";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "submitted",
  ASSIGNED: "assigned",
  STATUS: "changed status",
  PRIORITY: "changed priority",
  REMARK_PUBLIC: "remarked",
  REMARK_INTERNAL: "noted internally",
  PROOF: "attached proof",
};

export function ManagementPage() {
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const dark = resolvedTheme === "dark";

  const grid = dark ? "#27272A" : "#E5E7EB";
  const tick = dark ? "#A1A1AA" : "#6B7280";
  const tooltipStyle = {
    background: dark ? "#18181B" : "#FFFFFF",
    border: `1px solid ${grid}`,
    borderRadius: 6,
    fontSize: 12,
    color: dark ? "#FAFAFA" : "#111827",
    boxShadow: "none",
  } as const;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.getStats());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const active = stats.open + stats.inProgress;
  const anonPct = stats.total > 0 ? Math.round((stats.anonymous / stats.total) * 100) : 0;

  const kpis = [
    { label: "Total tickets", value: String(stats.total), sub: `${stats.closed} closed · ${stats.resolved} resolved`, icon: <Inbox className="h-4 w-4" aria-hidden />, accent: "text-gray-900 dark:text-zinc-50" },
    { label: "Active workload", value: String(active), sub: `${stats.open} open · ${stats.inProgress} in progress`, icon: <Activity className="h-4 w-4" aria-hidden />, accent: "text-amber-600 dark:text-amber-400" },
    { label: "Avg resolution time", value: fmtDuration(stats.avgResolutionMs), sub: "created → resolved, all time", icon: <Clock3 className="h-4 w-4" aria-hidden />, accent: "text-blue-600 dark:text-blue-400" },
    { label: "Anonymous share", value: `${anonPct}%`, sub: `${stats.anonymous} anonymous · ${stats.identified} identified`, icon: <Lock className="h-4 w-4" aria-hidden />, accent: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="space-y-4 rise">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Organizational pulse</h2>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">
            Throughput, resolution speed and anonymity across every department. Read-only oversight.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={k.label} className={cn("bg-white p-4 dark:bg-zinc-900", `rise rise-${i + 1}`)}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">{k.label}</p>
              <span className="text-gray-300 dark:text-zinc-700">{k.icon}</span>
            </div>
            <p className={cn("mt-2 text-3xl font-extrabold tracking-tight tnum", k.accent)}>{k.value}</p>
            <p className="mt-1 text-[11.5px] text-gray-500 dark:text-zinc-500">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle>Tickets by department</PanelTitle>
          <div className="h-64 px-3 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDept} barGap={3} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: tick }} axisLine={{ stroke: grid }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={9} />
                <Bar dataKey="total" name="Total" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={34} />
                <Bar dataKey="resolved" name="Resolved+" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle>8-week trend</PanelTitle>
          <div className="h-64 px-3 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10.5, fill: tick }} axisLine={{ stroke: grid }} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: grid }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" iconSize={12} />
                <Line type="monotone" dataKey="submissions" name="Submissions" stroke="#2563EB" strokeWidth={2} dot={{ r: 2.5, fill: "#2563EB", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolutions" name="Resolutions" stroke="#059669" strokeWidth={2} dot={{ r: 2.5, fill: "#059669", strokeWidth: 0 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* anonymity ratio + activity */}
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle>Anonymity ratio</PanelTitle>
          <div className="p-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-gray-200 dark:border-zinc-800" role="img" aria-label={`${anonPct}% anonymous submissions`}>
              <span className="bg-amber-500 transition-all duration-500" style={{ width: `${anonPct}%` }} />
              <span className="flex-1 bg-blue-600" />
            </div>
            <div className="mt-3 space-y-2 text-[12.5px]">
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
                  <span className="h-2 w-2 rounded-sm bg-amber-500" aria-hidden /> Anonymous
                </span>
                <span className="font-bold tnum">{stats.anonymous} · {anonPct}%</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
                  <span className="h-2 w-2 rounded-sm bg-blue-600" aria-hidden /> Identified
                </span>
                <span className="font-bold tnum">{stats.identified} · {100 - anonPct}%</span>
              </p>
            </div>
            <p className="mt-4 flex items-start gap-2 border-t border-gray-200 pt-3 text-[11.5px] leading-relaxed text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              A healthy anonymous share indicates psychological safety. Records carry no email, name or IP.
            </p>
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={<span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> latest activity</span>}
          >
            Recent events
          </PanelTitle>
          <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
            {stats.recent.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => navigate(`/ticket/${r.ticketId}?from=management`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                >
                  <span className="w-16 shrink-0 font-mono text-[11px] font-bold text-gray-400 tnum dark:text-zinc-600">{r.number}</span>
                  <p className="min-w-0 flex-1 truncate text-[12.5px] text-gray-600 dark:text-zinc-400">
                    <span className={cn("font-semibold", r.actor.startsWith("anon_") ? "font-mono text-amber-600 dark:text-amber-300" : "text-gray-900 dark:text-zinc-100")}>{r.actor}</span>{" "}
                    {EVENT_LABEL[r.type] ?? r.type} on “{r.title}”
                  </p>
                  <span className="hidden sm:block"><StatusBadge status={r.status} /></span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-gray-400 tnum dark:text-zinc-600">{timeAgo(r.at)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-zinc-700" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
