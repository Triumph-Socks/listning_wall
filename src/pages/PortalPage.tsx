import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FileText,
  Inbox,
  Lock,
  Paperclip,
  PenLine,
  Send,
  X,
} from "lucide-react";
import * as api from "../lib/api";
import { getDB } from "../lib/store";
import { useSession } from "../lib/session";
import type { Attachment, Category, Department, Ticket } from "../lib/types";
import { STATUS_META } from "../lib/types";
import { timeAgo } from "../lib/format";
import { AttachmentChip } from "../components/TicketDetail";
import { Button, Card, EmptyState, FieldError, Hint, Input, Label, PanelTitle, PriorityBadge, Select, Skeleton, StatusBadge, Switch, Tabs, Textarea } from "../components/ui";
import { cn } from "../lib/cn";

const schema = z.object({
  categoryId: z.string().min(1, "Choose a category so we can route it"),
  title: z.string().min(8, "At least 8 characters").max(120, "Keep it under 120 characters"),
  description: z.string().min(20, "Give the team at least 20 characters of context").max(2000, "Maximum 2000 characters"),
  anonymous: z.boolean(),
});
type FormVals = z.infer<typeof schema>;

export function PortalPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("new");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mine, setMine] = useState<Ticket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  const flags = getDB().flags;
  const forcedAnonymous = user?.role === "ANONYMOUS";

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: "", title: "", description: "", anonymous: forcedAnonymous },
  });
  const watchCategory = form.watch("categoryId");
  const watchAnonymous = form.watch("anonymous");
  const descLen = form.watch("description")?.length ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, m] = await Promise.all([api.listDepartments(), api.listCategories(), api.listMyTickets()]);
      setDepartments(d);
      setCategories(c.filter((x) => x.active));
      setMine(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load the portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const routedDept = useMemo(
    () => departments.find((d) => d.id === categories.find((c) => c.id === watchCategory)?.departmentId),
    [departments, categories, watchCategory]
  );

  const counts = useMemo(() => {
    const list = mine ?? [];
    return {
      open: list.filter((t) => t.status === "OPEN").length,
      progress: list.filter((t) => t.status === "IN_PROGRESS").length,
      done: list.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
    };
  }, [mine]);

  const onSubmit = form.handleSubmit(async (vals) => {
    try {
      const t = await api.createTicket({
        title: vals.title,
        description: vals.description,
        categoryId: vals.categoryId,
        anonymous: (vals.anonymous && flags.anonymousSubmissions) || forcedAnonymous,
        attachment,
      });
      toast.success(`${t.number} submitted${t.anonymous ? " anonymously" : ""} — routed to ${routedDept?.name ?? "the team"}`);
      if (t.anonymous && !forcedAnonymous) {
        toast.info("Anonymous submissions are untraceable — even to you. It will not appear in “My submissions”.");
      }
      form.reset({ categoryId: "", title: "", description: "", anonymous: forcedAnonymous });
      setAttachment(null);
      navigate(`/ticket/${t.id}?from=portal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    }
  });

  const pickFile = async (file: File) => {
    setFileBusy(true);
    try {
      setAttachment(await api.fileToAttachment(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach file");
    } finally {
      setFileBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 rise">
      {/* summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Awaiting triage", value: counts.open, cls: "text-gray-900 dark:text-zinc-50", dot: "bg-gray-400 dark:bg-zinc-500" },
          { label: "In progress", value: counts.progress, cls: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
          { label: "Resolved / closed", value: counts.done, cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-600" },
        ].map((s) => (
          <Card key={s.label} className="bg-white px-4 py-3 dark:bg-zinc-900">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
              {s.label}
            </p>
            <p className={cn("mt-1 text-2xl font-extrabold tnum", s.cls)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {!flags.portalOpen && (
        <div className="flex items-center gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          The submission portal is temporarily closed by an administrator. Tracking existing tickets still works.
        </div>
      )}

      <Card className="bg-white dark:bg-zinc-900">
        <Tabs
          tabs={[
            { id: "new", label: "New submission" },
            { id: "mine", label: "My submissions", count: mine?.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "new" ? (
          <form onSubmit={onSubmit} noValidate className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4 min-w-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="categoryId">Category</Label>
                  <Select id="categoryId" invalid={!!form.formState.errors.categoryId} {...form.register("categoryId")}>
                    <option value="">Select a category…</option>
                    {departments.map((d) => {
                      const cats = categories.filter((c) => c.departmentId === d.id);
                      if (cats.length === 0) return null;
                      return (
                        <optgroup key={d.id} label={d.name}>
                          {cats.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </Select>
                  <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="One-line summary" invalid={!!form.formState.errors.title} {...form.register("title")} />
                  <FieldError>{form.formState.errors.title?.message}</FieldError>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="description">What is on your mind?</Label>
                  <span className={cn("text-[11px] tnum", descLen > 2000 ? "text-rose-600" : "text-gray-400 dark:text-zinc-600")}>{descLen} / 2000</span>
                </div>
                <Textarea
                  id="description"
                  rows={6}
                  placeholder="Describe the issue or idea. Include what happened, where, and what a good outcome looks like…"
                  invalid={!!form.formState.errors.description}
                  {...form.register("description")}
                />
                <FieldError>{form.formState.errors.description?.message}</FieldError>
              </div>

              {flags.attachments ? (
                <div>
                  <Label>Attachment (optional)</Label>
                  {attachment ? (
                    <div className="flex items-center gap-2">
                      <AttachmentChip att={attachment} />
                      <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-[13px] font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500 dark:hover:border-blue-500/50 dark:hover:text-blue-300">
                      <Paperclip className="h-4 w-4" aria-hidden />
                      {fileBusy ? "Reading file…" : "Attach a screenshot or document (≤ 1.5 MB)"}
                      <input
                        type="file"
                        className="sr-only"
                        aria-label="Attachment file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void pickFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-gray-400 dark:text-zinc-600">File attachments are currently disabled by an administrator.</p>
              )}

              <Button type="submit" loading={form.formState.isSubmitting} disabled={!flags.portalOpen}>
                <Send className="h-4 w-4" aria-hidden /> Submit {watchAnonymous || forcedAnonymous ? "anonymously" : "feedback"}
              </Button>
            </div>

            {/* routing / anonymity rail */}
            <div className="space-y-3 lg:border-l lg:border-gray-200 lg:pl-6 dark:lg:border-zinc-800">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">Routing</p>
                {routedDept ? (
                  <p className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-zinc-200">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
                    {routedDept.name} queue
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-gray-500 dark:text-zinc-500">Pick a category to see where this lands.</p>
                )}
                <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-zinc-500">
                  The department head triages, assigns an owner and sets priority. You will see every status change here.
                </p>
              </div>

              <div className={cn("rounded-md border p-3.5", watchAnonymous || forcedAnonymous ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950/50")}>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="anon-switch" className="cursor-pointer">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-800 dark:text-zinc-200">
                      <Lock className={cn("h-3.5 w-3.5", (watchAnonymous || forcedAnonymous) && "text-amber-600 dark:text-amber-300")} aria-hidden />
                      Submit anonymously
                    </span>
                  </label>
                  <Switch
                    id="anon-switch"
                    checked={watchAnonymous || forcedAnonymous}
                    disabled={forcedAnonymous || !flags.anonymousSubmissions}
                    onCheckedChange={(v) => form.setValue("anonymous", v)}
                    label="Submit anonymously"
                  />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-zinc-500">
                  {forcedAnonymous
                    ? "You signed in with an access key — this session is anonymous by design. No identity is recorded."
                    : !flags.anonymousSubmissions
                      ? "Anonymous submissions are currently disabled by an administrator."
                      : "Your name and email are stripped from the record. Anonymous submissions cannot be traced — not even by you in “My submissions”."}
                </p>
              </div>
            </div>
          </form>
        ) : (
          <div>
            {!mine || mine.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" aria-hidden />}
                title={user?.role === "ANONYMOUS" ? "Nothing from this masked session yet" : "No submissions yet"}
                body={
                  user?.role === "ANONYMOUS"
                    ? "Tickets you submit with this access key will appear here, tracked by your masked alias."
                    : "Raise an idea, a concern or a ticket — it will show up here with its live status. Anonymous submissions stay untraceable by design."
                }
                action={
                  <Button size="sm" variant="outline" onClick={() => setTab("new")}>
                    <PenLine className="h-3.5 w-3.5" aria-hidden /> Write your first submission
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                {mine.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/ticket/${t.id}?from=portal`)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="hidden w-16 shrink-0 font-mono text-[11px] font-bold text-gray-400 tnum sm:block dark:text-zinc-600">{t.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-gray-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-300">{t.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-gray-500 dark:text-zinc-500">
                          {t.anonymous && <span className="font-mono text-amber-600 dark:text-amber-300">{t.submitterLabel}</span>}
                          <span>{categories.find((c) => c.id === t.categoryId)?.name ?? "—"}</span>
                          <span aria-hidden>·</span>
                          <span className="tnum">{timeAgo(t.updatedAt)}</span>
                        </span>
                      </span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-zinc-700" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mine && mine.length > 0 && (
              <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-2.5 text-[11px] text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
                <FileText className="h-3 w-3" aria-hidden />
                Legend: {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} aria-hidden />
                    {STATUS_META[s].label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
