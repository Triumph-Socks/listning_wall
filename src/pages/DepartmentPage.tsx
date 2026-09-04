import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertOctagon,
  ChevronRight,
  Layers,
  Lock,
  Search,
  UserRound,
} from "lucide-react";
import * as api from "../lib/api";
import { getDB } from "../lib/store";
import { useSession } from "../lib/session";
import type { Department, Priority, Ticket, TicketStatus } from "../lib/types";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from "../lib/types";
import { timeAgo } from "../lib/format";
import { Card, EmptyState, PriorityBadge, Select, Skeleton, StatusBadge, Tabs } from "../components/ui";
import { cn } from "../lib/cn";

export function DepartmentPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [statusTab, setStatusTab] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(user?.role === "DEPT_MEMBER");

  const isAdmin = user?.role === "SUPER_ADMIN";
  const deptName = user?.role === "DEPT_HEAD" || user?.role === "DEPT_MEMBER"
    ? getDB().departments.find((d) => d.id === user?.departmentId)?.name
    : null;

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([
        api.listQueue("department", null),
        api.listDepartments(),
      ]);
      setTickets(t);
      setDepartments(d);
      if (isAdmin && !deptFilter) setDeptFilter(d[0]?.id ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load the queue");
      setTickets([]);
    }
  }, [isAdmin, deptFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(() => {
    let list = tickets ?? [];
    if (isAdmin && deptFilter) list = list.filter((t) => t.departmentId === deptFilter);
    if (mineOnly && user?.id) list = list.filter((t) => t.assigneeId === user.id);
    if (statusTab !== "ALL") list = list.filter((t) => t.status === statusTab);
    if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.number.toLowerCase().includes(q) ||
          t.submitterLabel.toLowerCase().includes(q)
      );
    return list;
  }, [tickets, isAdmin, deptFilter, mineOnly, user?.id, statusTab, priorityFilter, query]);

  const statusCounts = useMemo(() => {
    let base = tickets ?? [];
    if (isAdmin && deptFilter) base = base.filter((t) => t.departmentId === deptFilter);
    if (mineOnly && user?.id) base = base.filter((t) => t.assigneeId === user.id);
    const counts: Record<string, number> = { ALL: base.length };
    for (const s of STATUS_ORDER) counts[s] = base.filter((t) => t.status === s).length;
    return counts;
  }, [tickets, isAdmin, deptFilter, mineOnly, user?.id]);

  const unassigned = useMemo(
    () => (tickets ?? []).filter((t) => !t.assigneeId && (t.status === "OPEN" || t.status === "IN_PROGRESS")).length,
    [tickets]
  );
  const urgentOpen = useMemo(
    () => (tickets ?? []).filter((t) => t.priority === "URGENT" && t.status !== "CLOSED" && t.status !== "RESOLVED").length,
    [tickets]
  );

  const users = getDB().users;
  const cats = getDB().categories;

  return (
    <div className="space-y-4 rise">
      {/* queue header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {isAdmin ? "All queues" : `${deptName ?? "Department"} queue`}
            </h2>
            <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-600">live</span>
          </div>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">
            {user?.role === "DEPT_HEAD" && "Triage incoming tickets, assign owners and set priorities."}
            {user?.role === "DEPT_MEMBER" && "Work your assigned tickets and close them with proof."}
            {isAdmin && "Global view across every department queue."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold tnum",
            unassigned > 0 ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" : "border-gray-200 bg-white text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500")}>
            <UserRound className="h-3.5 w-3.5" aria-hidden /> {unassigned} unassigned
          </span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold tnum",
            urgentOpen > 0 ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-gray-200 bg-white text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500")}>
            <AlertOctagon className="h-3.5 w-3.5" aria-hidden /> {urgentOpen} urgent
          </span>
        </div>
      </div>

      {/* filters */}
      <Card className="bg-white p-3 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-44" aria-label="Filter by department">
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          )}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number, title or submitter…"
              aria-label="Search tickets"
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | "")} className="w-36" aria-label="Filter by priority">
            <option value="">All priorities</option>
            {[...PRIORITY_ORDER].reverse().map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </Select>
          {(user?.role === "DEPT_MEMBER" || user?.role === "DEPT_HEAD" || isAdmin) && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 select-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
              Assigned to me
            </label>
          )}
        </div>
      </Card>

      {/* queue table */}
      <Card className="bg-white dark:bg-zinc-900">
        <Tabs
          tabs={[{ id: "ALL", label: "All" }, ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_META[s].label }))].map((t) => ({
            ...t,
            count: statusCounts[t.id],
          }))}
          active={statusTab}
          onChange={setStatusTab}
        />

        {tickets === null ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : scoped.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" aria-hidden />}
            title="Queue is clear"
            body="No tickets match the current filters. New submissions are routed here automatically by category."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-gray-200 text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
                  <th className="px-4 py-2.5">Ticket</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Assignee</th>
                  <th className="px-3 py-2.5 text-right">Updated</th>
                  <th className="w-8 px-2 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                {scoped.map((t) => {
                  const assignee = users.find((u) => u.id === t.assigneeId);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/ticket/${t.id}?from=departments`)}
                      className="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-8 w-0.5 shrink-0 rounded-full", !t.assigneeId && (t.status === "OPEN" || t.status === "IN_PROGRESS") ? "bg-amber-400" : "bg-transparent")} aria-hidden />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-300">
                              <span className="truncate">{t.title}</span>
                              {t.anonymous && <Lock className="h-3 w-3 shrink-0 text-amber-500" aria-label="Anonymous submission" />}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-zinc-500">
                              <span className="font-mono font-bold text-gray-400 tnum dark:text-zinc-600">{t.number}</span>
                              <span aria-hidden>·</span>
                              <span className={cn(t.anonymous && "font-mono text-amber-600 dark:text-amber-300")}>{t.submitterLabel}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-gray-600 dark:text-zinc-400">
                        {cats.find((c) => c.id === t.categoryId)?.name ?? "—"}
                        <span className="block text-[11px] text-gray-400 dark:text-zinc-600">
                          {departments.find((d) => d.id === t.departmentId)?.name}
                        </span>
                      </td>
                      <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3 text-[12.5px]">
                        {assignee ? (
                          <span className="font-medium text-gray-700 dark:text-zinc-300">{assignee.name}</span>
                        ) : (
                          <span className="font-medium text-amber-600 dark:text-amber-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-[12px] text-gray-500 tnum dark:text-zinc-500">{timeAgo(t.updatedAt)}</td>
                      <td className="px-2 py-3">
                        <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-zinc-700" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
