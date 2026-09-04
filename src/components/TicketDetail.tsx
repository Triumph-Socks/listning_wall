import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Flag,
  Lock,
  MessageSquare,
  Paperclip,
  PlusCircle,
  Send,
  ShieldAlert,
  UserPlus,
  Eye,
} from "lucide-react";
import * as api from "../lib/api";
import { getDB } from "../lib/store";
import { useSession } from "../lib/session";
import type { Attachment, Priority, Ticket, TicketEvent, TicketStatus, User } from "../lib/types";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STAFF_TRANSITIONS, SUBMITTER_TRANSITIONS, TRANSITION_LABEL } from "../lib/types";
import { fmtBytes, fmtDateTime, timeAgo } from "../lib/format";
import { Badge, Button, Card, Label, PanelTitle, PriorityBadge, Select, Skeleton, StatusBadge, Textarea } from "./ui";
import { cn } from "../lib/cn";

const EVENT_ICON: Record<TicketEvent["type"], ReactNode> = {
  CREATED: <PlusCircle className="h-3.5 w-3.5" aria-hidden />,
  ASSIGNED: <UserPlus className="h-3.5 w-3.5" aria-hidden />,
  STATUS: <ArrowRight className="h-3.5 w-3.5" aria-hidden />,
  PRIORITY: <Flag className="h-3.5 w-3.5" aria-hidden />,
  REMARK_PUBLIC: <MessageSquare className="h-3.5 w-3.5" aria-hidden />,
  REMARK_INTERNAL: <Lock className="h-3.5 w-3.5" aria-hidden />,
  PROOF: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
};

export function AttachmentChip({ att, preview = false }: { att: Attachment; preview?: boolean }) {
  const isImage = att.type.startsWith("image/");
  if (preview && isImage) {
    return (
      <figure className="w-44 shrink-0">
        <img
          src={att.dataUrl}
          alt={att.name}
          className="h-28 w-44 rounded-md border border-gray-200 object-cover dark:border-zinc-800"
        />
        <figcaption className="mt-1 flex items-center justify-between gap-1">
          <span className="truncate text-[11px] text-gray-500 dark:text-zinc-500">{att.name}</span>
          <a
            href={att.dataUrl}
            download={att.name}
            className="rounded p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            aria-label={`Download ${att.name}`}
          >
            <Download className="h-3 w-3" aria-hidden />
          </a>
        </figcaption>
      </figure>
    );
  }
  return (
    <a
      href={att.dataUrl}
      download={att.name}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
    >
      {isImage ? <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{att.name}</span>
      <span className="shrink-0 text-[10px] font-normal text-gray-400 dark:text-zinc-600 tnum">{fmtBytes(att.size)}</span>
    </a>
  );
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-gray-50 px-4 py-2.5 dark:bg-zinc-900">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">{label}</p>
      <div className="mt-0.5 text-[13px] font-medium text-gray-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

export function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useSession();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkInternal, setRemarkInternal] = useState(false);
  const [remarkErr, setRemarkErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.getTicket(id);
      setTicket(t);
      const m = await api.listUsersForDept(t.departmentId);
      setMembers(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ticket");
      onBack();
    } finally {
      setLoading(false);
    }
  }, [id, onBack]);

  useEffect(() => {
    void load();
  }, [load]);

  const session = useMemo(() => api.getSession(), []);
  const flags = getDB().flags;
  const db = getDB();

  if (!session || !user) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!ticket) return null;

  const staff = api.canWork(session, ticket);
  const headOrAdmin = api.canAssign(session, ticket);
  const deptStaff = api.isDeptStaff(session, ticket.departmentId);
  const submitter = api.isSubmitter(session, ticket);
  const transitions = staff ? STAFF_TRANSITIONS[ticket.status] : submitter ? SUBMITTER_TRANSITIONS[ticket.status] : [];
  const canComment = staff || deptStaff || submitter;

  const dept = db.departments.find((d) => d.id === ticket.departmentId);
  const cat = db.categories.find((c) => c.id === ticket.categoryId);
  const assignee = db.users.find((u) => u.id === ticket.assigneeId);

  const visibleEvents = ticket.events.filter(
    (e) => e.type !== "REMARK_INTERNAL" || deptStaff
  );

  const run = async (key: string, fn: () => Promise<Ticket>) => {
    setBusy(key);
    try {
      const t = await fn();
      setTicket(t);
      return t;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const onStatus = async (to: TicketStatus) => {
    const t = await run(`status-${to}`, () => api.changeStatus(ticket.id, to));
    if (t) {
      if (to === "RESOLVED") toast.success(`${ticket.number} marked resolved`);
      else if (to === "CLOSED") toast.success(`${ticket.number} closed`);
      else toast.success(`${ticket.number} → ${STATUS_META[to].label}`);
    }
  };

  const onAssign = async (userId: string) => {
    const t = await run("assign", () => api.assignTicket(ticket.id, userId || null));
    if (t) toast.success(userId ? `Assigned to ${t.events[t.events.length - 1].text}` : "Ticket unassigned");
  };

  const onPriority = async (p: Priority) => {
    const t = await run("priority", () => api.setPriority(ticket.id, p));
    if (t) toast.success(`Priority set to ${PRIORITY_META[p].label}`);
  };

  const onRemark = async () => {
    if (remark.trim().length < 3) {
      setRemarkErr("Write at least 3 characters.");
      return;
    }
    setRemarkErr(null);
    const t = await run("remark", () => api.addRemark(ticket.id, remark, remarkInternal && (staff || deptStaff)));
    if (t) {
      setRemark("");
      toast.success(remarkInternal ? "Internal remark added" : "Remark posted");
    }
  };

  const onProof = async (file: File) => {
    try {
      const att = await api.fileToAttachment(file);
      const t = await run("proof", () => api.addProof(ticket.id, att));
      if (t) toast.success("Proof of resolution attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4 rise">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to list
      </button>

      {/* header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-bold text-gray-500 tnum dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {ticket.number}
          </span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.anonymous && (
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
              <Lock className="h-3 w-3" aria-hidden /> Anonymous
            </Badge>
          )}
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-zinc-50">
          {ticket.title}
        </h2>
      </div>

      {/* meta */}
      <Card>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-gray-200 sm:grid-cols-3 lg:grid-cols-6 dark:bg-zinc-800">
          <MetaCell label="Department">{dept?.name ?? "—"}</MetaCell>
          <MetaCell label="Category">{cat?.name ?? "—"}</MetaCell>
          <MetaCell label="Submitted by">
            <span className={cn(ticket.anonymous && "font-mono text-amber-700 dark:text-amber-300")}>{ticket.submitterLabel}</span>
          </MetaCell>
          <MetaCell label="Assignee">{assignee?.name ?? <span className="text-gray-400 dark:text-zinc-600">Unassigned</span>}</MetaCell>
          <MetaCell label="Created"><span className="tnum">{fmtDateTime(ticket.createdAt)}</span></MetaCell>
          <MetaCell label="Last activity"><span className="tnum">{timeAgo(ticket.updatedAt)}</span></MetaCell>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* main column */}
        <div className="space-y-4 min-w-0">
          <Card>
            <PanelTitle>Description</PanelTitle>
            <div className="px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-zinc-300">{ticket.description}</p>
              {ticket.attachment && (
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-zinc-800">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">Submitted attachment</p>
                  <div className="flex flex-wrap gap-2">
                    <AttachmentChip att={ticket.attachment} preview />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* activity timeline */}
          <Card>
            <PanelTitle
              right={
                <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-600 tnum">
                  {visibleEvents.length} events
                </span>
              }
            >
              Activity
            </PanelTitle>
            <ol className="px-4 py-4">
              {visibleEvents.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < visibleEvents.length - 1 && (
                    <span className="absolute left-[13px] top-7 h-[calc(100%-22px)] w-px bg-gray-200 dark:bg-zinc-800" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      e.type === "REMARK_INTERNAL"
                        ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                        : e.type === "STATUS" && e.to === "RESOLVED"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-gray-200 bg-white text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                    )}
                  >
                    {EVENT_ICON[e.type]}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] text-gray-700 dark:text-zinc-300">
                      <span className={cn("font-semibold text-gray-900 dark:text-zinc-100", e.actor.startsWith("anon_") && "font-mono text-amber-700 dark:text-amber-300")}>
                        {e.actor}
                      </span>{" "}
                      {e.type === "CREATED" && "submitted this ticket"}
                      {e.type === "ASSIGNED" && (<>assigned to <span className="font-semibold">{e.text}</span></>)}
                      {e.type === "PRIORITY" && (<>changed priority <span className="font-semibold">{e.from?.toLowerCase()}</span> → <span className="font-semibold">{e.to?.toLowerCase()}</span></>)}
                      {e.type === "STATUS" && (
                        <>
                          moved <span className="font-semibold">{e.from && STATUS_META[e.from as TicketStatus]?.label}</span>{" "}
                          → <span className="font-semibold">{e.to && STATUS_META[e.to as TicketStatus]?.label}</span>
                        </>
                      )}
                      {e.type === "REMARK_PUBLIC" && "posted a remark"}
                      {e.type === "REMARK_INTERNAL" && (
                        <span className="text-amber-700 dark:text-amber-300">added an internal note (hidden from submitter)</span>
                      )}
                      {e.type === "PROOF" && (<>attached proof of resolution</>)}
                    </p>
                    {e.text && (e.type === "REMARK_PUBLIC" || e.type === "REMARK_INTERNAL") && (
                      <p className={cn(
                        "mt-1.5 rounded-md border px-3 py-2 text-[13px] leading-relaxed",
                        e.type === "REMARK_INTERNAL"
                          ? "border-amber-200 bg-amber-50/60 text-gray-700 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-zinc-300"
                          : "border-gray-200 bg-white text-gray-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300"
                      )}>
                        {e.text}
                      </p>
                    )}
                    {e.attachment && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <AttachmentChip att={e.attachment} preview={e.type === "PROOF"} />
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600 tnum" title={fmtDateTime(e.at)}>
                      {timeAgo(e.at)} · {fmtDateTime(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* composer */}
          {canComment && ticket.status !== "CLOSED" && (
            <Card>
              <PanelTitle
                right={
                  deptStaff && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-zinc-500">
                      <input
                        type="checkbox"
                        checked={remarkInternal}
                        onChange={(e) => setRemarkInternal(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      Internal (staff only)
                    </label>
                  )
                }
              >
                Add remark
              </PanelTitle>
              <div className="p-4">
                <Textarea
                  rows={3}
                  value={remark}
                  invalid={!!remarkErr}
                  onChange={(e) => { setRemark(e.target.value); if (remarkErr) setRemarkErr(null); }}
                  placeholder={remarkInternal ? "Visible only to department staff…" : "Visible to the submitter…"}
                  aria-label="Remark text"
                />
                {remarkErr && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{remarkErr}</p>}
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-400 dark:text-zinc-600">
                    {remarkInternal ? (
                      <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden /> Hidden from the submitter and management</span>
                    ) : (
                      "Public remarks are visible to the submitter."
                    )}
                  </p>
                  <Button size="sm" loading={busy === "remark"} onClick={() => void onRemark()}>
                    <Send className="h-3.5 w-3.5" aria-hidden /> Post remark
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* side column */}
        <div className="space-y-4">
          {(headOrAdmin || staff) && (
            <Card>
              <PanelTitle>Workflow</PanelTitle>
              <div className="space-y-4 p-4">
                {headOrAdmin && (
                  <div>
                    <Label htmlFor="assignee">Assignee</Label>
                    <Select
                      id="assignee"
                      value={ticket.assigneeId ?? ""}
                      disabled={busy === "assign"}
                      onChange={(e) => void onAssign(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.title}</option>
                      ))}
                    </Select>
                  </div>
                )}
                {headOrAdmin && (
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      id="priority"
                      value={ticket.priority}
                      disabled={busy === "priority"}
                      onChange={(e) => void onPriority(e.target.value as Priority)}
                    >
                      {PRIORITY_ORDER.map((p) => (
                        <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                      ))}
                    </Select>
                  </div>
                )}
                {transitions.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-gray-700 dark:text-zinc-300">Advance status</p>
                    <div className="flex flex-wrap gap-2">
                      {transitions.map((to) => (
                        <Button
                          key={to}
                          size="sm"
                          variant={to === "RESOLVED" ? "success" : to === "CLOSED" ? "outline" : "subtle"}
                          loading={busy === `status-${to}`}
                          onClick={() => void onStatus(to)}
                        >
                          {TRANSITION_LABEL[to]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {transitions.length === 0 && !headOrAdmin && (
                  <p className="text-[12px] text-gray-500 dark:text-zinc-500">
                    No actions available for your role at the <span className="font-semibold">{STATUS_META[ticket.status].label}</span> stage.
                  </p>
                )}
                {staff && flags.attachments && ticket.status !== "CLOSED" && (
                  <div className="border-t border-gray-200 pt-3.5 dark:border-zinc-800">
                    <p className="mb-1.5 text-[13px] font-medium text-gray-700 dark:text-zinc-300">Proof of resolution</p>
                    <input
                      ref={fileRef}
                      type="file"
                      id="proof-upload"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onProof(f);
                      }}
                    />
                    <Button variant="outline" size="sm" loading={busy === "proof"} onClick={() => fileRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" aria-hidden /> Upload proof (≤ 1.5 MB)
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {ticket.proofs.length > 0 && (
            <Card>
              <PanelTitle>Proof ({ticket.proofs.length})</PanelTitle>
              <div className="flex flex-wrap gap-3 p-4">
                {ticket.proofs.map((p) => (
                  <AttachmentChip key={p.id} att={p} preview />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <PanelTitle>Routing</PanelTitle>
            <div className="p-4 text-[12px] leading-relaxed text-gray-500 dark:text-zinc-400">
              <p className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Routed to <span className="font-semibold text-gray-700 dark:text-zinc-200">{dept?.name}</span> via category “{cat?.name}”.
              </p>
              {ticket.anonymous && (
                <p className="mt-2 flex items-start gap-2 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Identity masked — no email, name or IP is stored with this ticket.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
