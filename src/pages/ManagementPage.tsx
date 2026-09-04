import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import {
  Activity,
  ArrowRight,
  Building2,
  Clock3,
  Inbox,
  Layers,
  RefreshCw,
  Star,
  Timer,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import * as api from "../lib/api";
import type { ManagementStats } from "../lib/api";
import { fmtDuration, timeAgo } from "../lib/format";
import { Button, Card, PanelTitle, Skeleton, Stars, StatusBadge } from "../components/ui";
import { cn } from "../lib/cn";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "submitted",
  ASSIGNED: "assigned",
  STATUS: "changed status",
  PRIORITY: "changed priority",
  REMARK_PUBLIC: "remarked",
  REMARK_INTERNAL: "noted internally",
  PROOF: "attached proof",
  RATING: "rated",
};

function SectionHead({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5 pt-5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {icon}
      </span>
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-0.5 text-[12px] text-gray-500 dark:text-zinc-400">{sub}</p>
      </div>
    </div>
  );
}

function HBars({
  items,
  color = "#2563EB",
}: {
  items: { label: string; sub?: string; value: number; tail?: string; color?: string }[];
  color?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[12.5px] font-medium text-gray-700 dark:text-zinc-300" title={it.label}>
              {it.label}
            </p>
            <p className="shrink-0 text-[12px] font-bold text-gray-900 tnum dark:text-zinc-100">
              {it.value}
              {it.tail && <span className="ml-1.5 font-medium text-gray-400 dark:text-zinc-600">{it.tail}</span>}
            </p>
          </div>
          {it.sub && <p className="mt-px text-[10.5px] text-gray-400 dark:text-zinc-600">{it.sub}</p>}
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: on ? `${Math.max((it.value / max) * 100, 2)}%` : "0%", background: it.color ?? color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ManagementPage() {
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [barsOn, setBarsOn] = useState(false);
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    const r = requestAnimationFrame(() => setBarsOn(true));
    return () => cancelAnimationFrame(r);
  }, []);

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
    { label: "Satisfaction", value: stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—", sub: `${stats.ratedCount} rated · ${stats.unratedDone} awaiting verdict`, icon: <Star className="h-4 w-4" aria-hidden />, accent: "text-amber-500 dark:text-amber-400" },
  ];

  // ── derived decision data ───────────────────────────────────────────────────
  const fastestDept = stats.deptPerf.find((d) => d.avgResolutionMs !== null);
  const topCat = stats.byCategory[0];
  const heavyDept = [...stats.deptPerf].sort((a, b) => b.backlog - a.backlog)[0];
  const lowDept = stats.deptPerf
    .filter((d) => d.avgRating !== null)
    .sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0))[0];
  const resolvedTotal = stats.resolved + stats.closed;
  const slowShare =
    resolvedTotal > 0 ? Math.round(((stats.resolveBands[3]?.count ?? 0) / resolvedTotal) * 100) : 0;
  const funnelMax = Math.max(stats.funnel[0]?.count ?? 1, 1);
  const ratedPct = stats.total > 0 ? Math.round(((stats.funnel[4]?.count ?? 0) / stats.total) * 100) : 0;
  const maxFa = Math.max(...stats.deptPerf.map((d) => d.avgFirstActionMs ?? 0));
  const maxRes = Math.max(...stats.deptPerf.map((d) => d.avgResolutionMs ?? 0));

  const insights: { icon: ReactNode; chip: string; text: ReactNode }[] = [];
  if (fastestDept)
    insights.push({
      icon: <Zap className="h-3.5 w-3.5" aria-hidden />,
      chip: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
      text: (
        <>
          <span className="font-semibold">{fastestDept.name}</span> resolves fastest —{" "}
          <span className="tnum font-semibold">{fmtDuration(fastestDept.avgResolutionMs ?? 0)}</span> on average.
        </>
      ),
    });
  if (heavyDept && heavyDept.backlog > 0)
    insights.push({
      icon: <Activity className="h-3.5 w-3.5" aria-hidden />,
      chip: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
      text: (
        <>
          <span className="font-semibold">{heavyDept.name}</span> carries the heaviest backlog —{" "}
          <span className="tnum font-semibold">{heavyDept.backlog}</span> active ticket
          {heavyDept.backlog === 1 ? "" : "s"}.
        </>
      ),
    });
  if (topCat)
    insights.push({
      icon: <Layers className="h-3.5 w-3.5" aria-hidden />,
      chip: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
      text: (
        <>
          Most raised topic: <span className="font-semibold">{topCat.name}</span> with{" "}
          <span className="tnum font-semibold">{topCat.total}</span> tickets ·{" "}
          <span className="tnum font-semibold">
            {topCat.total > 0 ? Math.round((topCat.anonymous / topCat.total) * 100) : 0}%
          </span>{" "}
          anonymous.
        </>
      ),
    });
  if (lowDept && (lowDept.avgRating ?? 5) < 4)
    insights.push({
      icon: <Star className="h-3.5 w-3.5" aria-hidden />,
      chip: "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
      text: (
        <>
          <span className="font-semibold">{lowDept.name}</span> has the lowest raiser satisfaction at{" "}
          <span className="tnum font-semibold">{(lowDept.avgRating ?? 0).toFixed(1)}/5</span>.
        </>
      ),
    });
  if (slowShare > 0)
    insights.push({
      icon: <Timer className="h-3.5 w-3.5" aria-hidden />,
      chip: "border-gray-200 bg-gray-100 text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
      text: (
        <>
          <span className="tnum font-semibold">{slowShare}%</span> of resolutions take over a week to complete.
        </>
      ),
    });

  const bandTotal = (b: { count: number }[]) => Math.max(b.reduce((a, x) => a + x.count, 0), 1);

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

      {/* anonymity ratio, satisfaction distribution + activity */}
      <div className="grid items-start gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
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
            right={
              stats.avgRating !== null ? (
                <span className="flex items-center gap-1 text-[12px] font-bold text-amber-500 tnum dark:text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  {stats.avgRating.toFixed(1)}/5
                </span>
              ) : undefined
            }
          >
            Satisfaction distribution
          </PanelTitle>
          <div className="p-4">
            {stats.ratedCount === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-gray-400 dark:text-zinc-600">
                No ratings yet — verdicts appear once submitters rate resolved work.
              </p>
            ) : (
              <ul className="space-y-2.5" aria-label="Rating distribution">
                {stats.ratingDist.map((r) => {
                  const max = Math.max(...stats.ratingDist.map((x) => x.count), 1);
                  const pct = Math.round((r.count / stats.ratedCount) * 100);
                  return (
                    <li key={r.stars} className="flex items-center gap-2.5">
                      <span className="flex w-8 shrink-0 items-center gap-0.5 text-[12px] font-semibold text-gray-600 tnum dark:text-zinc-400">
                        {r.stars}
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-all duration-700",
                            r.stars >= 4 ? "bg-emerald-500" : r.stars === 3 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${(r.count / max) * 100}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right text-[11.5px] text-gray-500 tnum dark:text-zinc-500">
                        {r.count} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 flex items-start gap-2 border-t border-gray-200 pt-3 text-[11.5px] leading-relaxed text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Ratings are submitted by ticket raisers after resolution. {stats.unratedDone} completed ticket{stats.unratedDone === 1 ? "" : "s"} still await a verdict.
            </p>
          </div>
        </Card>
        </div>

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

      {/* ── where demand comes from ── */}
      <SectionHead
        icon={<Layers className="h-3.5 w-3.5" aria-hidden />}
        title="Where demand comes from"
        sub="What employees raise — ideas, concerns, tickets — broken down by category and by who raises it."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-white dark:bg-zinc-900 lg:col-span-2">
          <PanelTitle
            right={
              <span className="text-[11px] font-medium text-gray-400 tnum dark:text-zinc-600">
                {stats.byCategory.length} categories in use
              </span>
            }
          >
            Category demand
          </PanelTitle>
          <div className="p-4">
            <HBars
              items={stats.byCategory.map((c) => ({
                label: c.name,
                sub: `Routed to ${c.department} · ${c.anonymous} anonymous · ${c.open} still active`,
                value: c.total,
                tail: "tickets",
              }))}
            />
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="text-[11px] font-medium text-gray-400 tnum dark:text-zinc-600">top {stats.topRaisers.length}</span>
            }
          >
            Top raisers
          </PanelTitle>
          <div className="p-4">
            <HBars
              items={stats.topRaisers.map((r) => ({
                label: r.label,
                sub: r.anonymous ? "Anonymous — identity masked" : "Identified employee",
                value: r.count,
                color: r.anonymous ? "#F59E0B" : undefined,
              }))}
            />
          </div>
        </Card>
      </div>

      {/* ── people & lifecycle ── */}
      <SectionHead
        icon={<Users className="h-3.5 w-3.5" aria-hidden />}
        title="People & lifecycle"
        sub="Which teams raise the most, and how many tickets make it all the way to a rated resolution."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-zinc-600">
                <Building2 className="h-3 w-3" aria-hidden /> by submitter's department
              </span>
            }
          >
            Origin of demand
          </PanelTitle>
          <div className="p-4">
            <HBars
              color="#71717A"
              items={stats.originDepts.map((o) => ({
                label: o.name,
                value: o.count,
                tail: o.name === "Anonymous / masked" ? "untraceable" : "tickets",
              }))}
            />
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="text-[11px] font-bold text-blue-600 tnum dark:text-blue-400">{ratedPct}% reach a rating</span>
            }
          >
            Lifecycle funnel
          </PanelTitle>
          <ul className="space-y-3 p-4">
            {stats.funnel.map((f, i) => {
              const pct = Math.round((f.count / funnelMax) * 100);
              return (
                <li key={f.stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12px] font-medium text-gray-600 dark:text-zinc-400">{f.stage}</span>
                  <span className="h-6 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-zinc-800">
                    <span
                      className="block h-full rounded bg-blue-600 transition-all duration-700 ease-out"
                      style={{ width: barsOn ? `${Math.max(pct, 4)}%` : "0%", opacity: 1 - i * 0.16 }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11.5px] text-gray-500 tnum dark:text-zinc-500">
                    <span className="font-bold text-gray-900 dark:text-zinc-100">{f.count}</span> · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-gray-200 px-4 py-2.5 text-[11px] text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
            Drop-off between “Resolved / closed” and “Rated” is feedback you are not hearing yet.
          </p>
        </Card>
      </div>

      {/* ── department speed ── */}
      <SectionHead
        icon={<Zap className="h-3.5 w-3.5" aria-hidden />}
        title="Department speed"
        sub="How quickly each team takes first action and resolves — sorted fastest resolver first. Shorter bars are better."
      />
      <Card className="bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-gray-200 text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
                <th className="px-4 py-2.5 font-bold">Department</th>
                <th className="px-3 py-2.5 text-right font-bold">Backlog</th>
                <th className="px-3 py-2.5 text-right font-bold">Resolved</th>
                <th className="px-3 py-2.5 text-right font-bold">Reopens</th>
                <th className="px-3 py-2.5 font-bold">Avg first action</th>
                <th className="px-3 py-2.5 font-bold">Avg resolution</th>
                <th className="px-4 py-2.5 font-bold">Raiser rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/70">
              {stats.deptPerf.map((d) => {
                const faPct = maxFa > 0 && d.avgFirstActionMs !== null ? (d.avgFirstActionMs / maxFa) * 100 : 0;
                const resPct = maxRes > 0 && d.avgResolutionMs !== null ? (d.avgResolutionMs / maxRes) * 100 : 0;
                return (
                  <tr key={d.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-900 dark:text-zinc-100">
                        {d.name}
                        {fastestDept && d.id === fastestDept.id && (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Fastest
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={cn("px-3 py-3 text-right text-[13px] tnum", d.backlog > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-zinc-600")}>
                      {d.backlog}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] font-semibold text-gray-700 tnum dark:text-zinc-300">{d.resolved}</td>
                    <td className={cn("px-3 py-3 text-right text-[13px] tnum", d.reopens > 0 ? "font-bold text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-zinc-600")}>
                      {d.reopens}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block text-[12.5px] font-semibold text-gray-800 tnum dark:text-zinc-200">
                        {d.avgFirstActionMs !== null ? fmtDuration(d.avgFirstActionMs) : "—"}
                      </span>
                      <span className="mt-1 block h-1 w-24 rounded-full bg-gray-100 dark:bg-zinc-800">
                        <span
                          className="block h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
                          style={{ width: barsOn ? `${faPct}%` : "0%" }}
                        />
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block text-[12.5px] font-semibold text-gray-800 tnum dark:text-zinc-200">
                        {d.avgResolutionMs !== null ? fmtDuration(d.avgResolutionMs) : "—"}
                      </span>
                      <span className="mt-1 block h-1 w-24 rounded-full bg-gray-100 dark:bg-zinc-800">
                        <span
                          className="block h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                          style={{ width: barsOn ? `${resPct}%` : "0%" }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.avgRating !== null ? (
                        <span className="flex items-center gap-1.5">
                          <Stars value={d.avgRating} size={11} />
                          <span className="text-[12px] font-bold text-gray-700 tnum dark:text-zinc-300">{d.avgRating.toFixed(1)}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-200 px-4 py-2.5 text-[11px] text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
          First action = first assignment, priority change, remark or proof by staff. Reopens count submitter-driven “not resolved” returns.
        </p>
      </Card>

      {/* ── timeliness & signals ── */}
      <SectionHead
        icon={<Timer className="h-3.5 w-3.5" aria-hidden />}
        title="Timeliness & signals"
        sub="How long tickets normally wait for action and for resolution, and what the numbers suggest right now."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="text-[11px] font-bold text-blue-600 tnum dark:text-blue-400">
                median {stats.medianFirstActionMs !== null ? fmtDuration(stats.medianFirstActionMs) : "—"}
              </span>
            }
          >
            Time to first action
          </PanelTitle>
          <div className="p-4">
            <HBars
              items={stats.actionBands.map((b) => ({
                label: b.label,
                value: b.count,
                tail: `${Math.round((b.count / bandTotal(stats.actionBands)) * 100)}%`,
              }))}
            />
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="text-[11px] font-bold text-emerald-600 tnum dark:text-emerald-400">
                median {stats.medianResolutionMs !== null ? fmtDuration(stats.medianResolutionMs) : "—"}
              </span>
            }
          >
            Time to resolution
          </PanelTitle>
          <div className="p-4">
            <HBars
              color="#059669"
              items={stats.resolveBands.map((b) => ({
                label: b.label,
                value: b.count,
                tail: `${Math.round((b.count / bandTotal(stats.resolveBands)) * 100)}%`,
              }))}
            />
          </div>
        </Card>

        <Card className="bg-white dark:bg-zinc-900">
          <PanelTitle
            right={
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden /> auto-generated
              </span>
            }
          >
            Signals to act on
          </PanelTitle>
          <ul className="space-y-3 p-4">
            {insights.length === 0 && (
              <li className="py-4 text-center text-[12.5px] text-gray-400 dark:text-zinc-600">
                Not enough data for signals yet.
              </li>
            )}
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", ins.chip)}>
                  {ins.icon}
                </span>
                <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-zinc-400">{ins.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
