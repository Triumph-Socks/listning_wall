import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Copy,
  KeyRound,
  Plus,
  Power,
  RotateCcw,
  Settings2,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import * as api from "../lib/api";
import { getDB } from "../lib/store";
import { useSession } from "../lib/session";
import type { AnonymousKey, Category, Department, Role, User } from "../lib/types";
import { ROLE_META } from "../lib/types";
import { fmtDate, timeAgo } from "../lib/format";
import { Badge, Button, Card, Dialog, EmptyState, FieldError, Hint, Input, Label, RoleBadge, Select, Skeleton, Switch, Tabs, Textarea } from "../components/ui";
import { cn } from "../lib/cn";

// ─── user form ────────────────────────────────────────────────────────────────

const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["SUPER_ADMIN", "MANAGEMENT", "DEPT_HEAD", "DEPT_MEMBER", "EMPLOYEE"]),
  departmentId: z.string(),
  title: z.string(),
  password: z.string().min(8, "Minimum 8 characters"),
});
type UserFormVals = z.infer<typeof userSchema>;

function UserDialog({
  open,
  onClose,
  editing,
  departments,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: User | null;
  departments: Department[];
  onSaved: () => void;
}) {
  const form = useForm<UserFormVals>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", role: "EMPLOYEE", departmentId: "", title: "", password: "" },
  });
  const watchRole = form.watch("role");
  const needsDept = watchRole === "DEPT_HEAD" || watchRole === "DEPT_MEMBER";
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? "",
      email: editing?.email ?? "",
      role: (editing?.role === "ANONYMOUS" ? "EMPLOYEE" : editing?.role ?? "EMPLOYEE") as UserFormVals["role"],
      departmentId: editing?.departmentId ?? "",
      title: editing?.title ?? "",
      password: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const submit = form.handleSubmit(async (vals) => {
    if (needsDept && !vals.departmentId) {
      form.setError("departmentId", { message: "Department staff need a department" });
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.adminUpdateUser(editing.id, {
          name: vals.name,
          email: vals.email,
          role: vals.role,
          departmentId: needsDept ? vals.departmentId : null,
          title: vals.title,
        });
        toast.success(`${vals.name} updated`);
      } else {
        await api.adminCreateUser({
          name: vals.name,
          email: vals.email,
          role: vals.role,
          departmentId: needsDept ? vals.departmentId : null,
          title: vals.title,
          password: vals.password,
        });
        toast.success(`${vals.name} created`);
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save user");
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : "New user"}>
      <form onSubmit={submit} noValidate className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" invalid={!!form.formState.errors.name} {...form.register("name")} />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" invalid={!!form.formState.errors.email} {...form.register("email")} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </div>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="u-role">Role</Label>
            <Select id="u-role" {...form.register("role")}>
              {(["EMPLOYEE", "DEPT_MEMBER", "DEPT_HEAD", "MANAGEMENT", "SUPER_ADMIN"] as const).map((r) => (
                <option key={r} value={r}>{ROLE_META[r].label}</option>
              ))}
            </Select>
          </div>
          {needsDept ? (
            <div>
              <Label htmlFor="u-dept">Department</Label>
              <Select id="u-dept" invalid={!!form.formState.errors.departmentId} {...form.register("departmentId")}>
                <option value="">Choose…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <FieldError>{form.formState.errors.departmentId?.message}</FieldError>
            </div>
          ) : (
            <div>
              <Label htmlFor="u-title">Job title</Label>
              <Input id="u-title" placeholder="e.g. Product Designer" {...form.register("title")} />
            </div>
          )}
        </div>
        {needsDept && (
          <div>
            <Label htmlFor="u-title2">Job title</Label>
            <Input id="u-title2" placeholder="e.g. IT Support Engineer" {...form.register("title")} />
          </div>
        )}
        {!editing && (
          <div>
            <Label htmlFor="u-pass">Initial password</Label>
            <Input id="u-pass" type="text" invalid={!!form.formState.errors.password} {...form.register("password")} />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
            <Hint>Shared out-of-band in this sandbox. Users cannot self-reset passwords.</Hint>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={busy}>{editing ? "Save changes" : "Create user"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPw("");
    setErr(null);
  }, [user]);

  const submit = async () => {
    if (pw.length < 8) {
      setErr("Minimum 8 characters");
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      await api.adminResetPassword(user.id, pw);
      toast.success(`Password reset for ${user.name}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onClose={onClose} title={`Reset password — ${user?.name ?? ""}`}>
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="reset-pw">New password</Label>
          <Input id="reset-pw" value={pw} invalid={!!err} onChange={(e) => { setPw(e.target.value); setErr(null); }} />
          {err && <FieldError>{err}</FieldError>}
          <Hint>The user signs in with this password immediately.</Hint>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={busy} onClick={() => void submit()}>Reset password</Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user: me } = useSession();
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState<User[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [keys, setKeys] = useState<AnonymousKey[] | null>(null);
  const [flags, setFlags] = useState(getDB().flags);
  const [userDialog, setUserDialog] = useState<{ open: boolean; editing: User | null }>({ open: false, editing: null });
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [flagBusy, setFlagBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [newDept, setNewDept] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [deptBusy, setDeptBusy] = useState(false);
  const [newCat, setNewCat] = useState<Record<string, string>>({});
  const [keyType, setKeyType] = useState<AnonymousKey["type"]>("ONE_TIME");
  const [keyNote, setKeyNote] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.adminListUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    }
  }, []);
  const loadKeys = useCallback(async () => {
    try {
      setKeys(await api.listKeys());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load keys");
    }
  }, []);
  const loadStructure = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.listDepartments(), api.listCategories()]);
      setDepartments(d);
      setCategories(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load structure");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadKeys();
    void loadStructure();
  }, [loadUsers, loadKeys, loadStructure]);

  const toggleFlag = async (key: keyof typeof flags, value: boolean) => {
    setFlagBusy(key);
    try {
      setFlags(await api.setFlag(key, value));
      toast.success(`${FLAG_META[key].label} ${value ? "enabled" : "disabled"}`);
      if (key === "portalOpen") toast.info(value ? "Employees can submit again." : "The submission form is now locked for everyone.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update flag");
    } finally {
      setFlagBusy(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const addDept = async () => {
    if (newDept.trim().length < 2) {
      toast.error("Department name needs at least 2 characters");
      return;
    }
    setDeptBusy(true);
    try {
      await api.createDepartment(newDept, newDeptDesc);
      toast.success(`Department “${newDept.trim()}” created`);
      setNewDept("");
      setNewDeptDesc("");
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setDeptBusy(false);
    }
  };

  const removeDept = async (d: Department) => {
    try {
      await api.deleteDepartment(d.id);
      toast.success(`Department “${d.name}” deleted`);
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete");
    }
  };

  const addCat = async (deptId: string) => {
    const name = (newCat[deptId] ?? "").trim();
    if (name.length < 2) {
      toast.error("Category name needs at least 2 characters");
      return;
    }
    try {
      await api.createCategory(name, deptId);
      toast.success(`Category “${name}” added`);
      setNewCat((p) => ({ ...p, [deptId]: "" }));
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const genKey = async () => {
    setKeyBusy(true);
    try {
      const k = await api.generateKey(keyType, keyNote);
      toast.success(`Key ${k.key} generated`);
      setKeyNote("");
      await loadKeys();
      void copy(k.key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setKeyBusy(false);
    }
  };

  const db = getDB();

  return (
    <div className="space-y-4 rise">
      <Card className="bg-white dark:bg-zinc-900">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users", count: users?.length },
            { id: "structure", label: "Departments" },
            { id: "keys", label: "Access keys", count: keys?.filter((k) => !k.revoked && !k.used).length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* ── overview ── */}
        {tab === "overview" && (
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_320px]">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold"><Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden /> Global feature flags</h3>
              <p className="mt-1 text-[12.5px] text-gray-500 dark:text-zinc-400">Changes apply instantly for every session.</p>
              <ul className="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-zinc-800 dark:border-zinc-800">
                {(Object.keys(FLAG_META) as (keyof typeof FLAG_META)[]).map((k) => (
                  <li key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-zinc-100">{FLAG_META[k].label}</p>
                      <p className="mt-0.5 text-[12px] text-gray-500 dark:text-zinc-500">{FLAG_META[k].desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-bold uppercase", flags[k] ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-600")}>
                        {flagBusy === k ? "…" : flags[k] ? "On" : "Off"}
                      </span>
                      <Switch checked={flags[k]} onCheckedChange={(v) => void toggleFlag(k, v)} label={FLAG_META[k].label} disabled={flagBusy === k} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600">Platform snapshot</p>
                <dl className="mt-2.5 space-y-1.5 text-[13px]">
                  {[
                    ["Users", users?.length ?? "—"],
                    ["Departments", departments.length],
                    ["Categories", categories.length],
                    ["Tickets", db.tickets.length],
                    ["Active keys", keys?.filter((k) => !k.revoked && !(k.type === "ONE_TIME" && k.used)).length ?? "—"],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between">
                      <dt className="text-gray-500 dark:text-zinc-500">{k}</dt>
                      <dd className="font-bold tnum">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                <p className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Danger zone</p>
                <p className="mt-1 text-[12px] leading-relaxed text-rose-600/80 dark:text-rose-300/70">
                  Wipe all changes and restore the original demo dataset.
                </p>
                <Button variant="danger" size="sm" className="mt-3" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset demo data
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── users ── */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[13px] text-gray-500 dark:text-zinc-400">
                Signed in as <span className="font-semibold text-gray-800 dark:text-zinc-200">{me?.email}</span>
              </p>
              <Button size="sm" onClick={() => setUserDialog({ open: true, editing: null })}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> New user
              </Button>
            </div>
            {!users ? (
              <div className="space-y-2 p-4 pt-0">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : users.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" aria-hidden />} title="No users" body="Create the first account to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-y border-gray-200 text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:border-zinc-800 dark:text-zinc-600">
                      <th className="px-4 py-2.5">User</th>
                      <th className="px-3 py-2.5">Role</th>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5">Joined</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {users.map((u) => (
                      <tr key={u.id} className={cn("transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50", !u.active && "opacity-55")}>
                        <td className="px-4 py-2.5">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-zinc-100">{u.name}{u.id === me?.id && <span className="ml-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">YOU</span>}</p>
                          <p className="text-[11.5px] text-gray-500 dark:text-zinc-500">{u.email} · {u.title}</p>
                        </td>
                        <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                        <td className="px-3 py-2.5 text-[12.5px] text-gray-600 dark:text-zinc-400">
                          {departments.find((d) => d.id === u.departmentId)?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-500 tnum dark:text-zinc-500">{fmtDate(u.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          {u.active ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700">Deactivated</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="xs" onClick={() => setUserDialog({ open: true, editing: u })}>Edit</Button>
                            <Button variant="ghost" size="xs" onClick={() => setPwTarget(u)}><KeyRound className="h-3 w-3" aria-hidden /> Password</Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={u.id === me?.id}
                              className={u.active ? "hover:!text-rose-600 dark:hover:!text-rose-400" : "hover:!text-emerald-600"}
                              onClick={async () => {
                                try {
                                  await api.adminSetActive(u.id, !u.active);
                                  toast.success(`${u.name} ${u.active ? "deactivated" : "reactivated"}`);
                                  await loadUsers();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed");
                                }
                              }}
                            >
                              <Power className="h-3 w-3" aria-hidden /> {u.active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── structure ── */}
        {tab === "structure" && (
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[320px_1fr]">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold"><Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden /> Departments</h3>
              <ul className="mt-3 space-y-2">
                {departments.map((d) => {
                  const count = db.tickets.filter((t) => t.departmentId === d.id).length;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{d.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-500 tnum">{count} tickets · {categories.filter((c) => c.departmentId === d.id).length} categories</p>
                      </div>
                      <button
                        onClick={() => void removeDept(d)}
                        aria-label={`Delete department ${d.name}`}
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 space-y-2 rounded-md border border-dashed border-gray-300 p-3 dark:border-zinc-700">
                <Input placeholder="Department name" value={newDept} onChange={(e) => setNewDept(e.target.value)} aria-label="New department name" />
                <Input placeholder="Short description" value={newDeptDesc} onChange={(e) => setNewDeptDesc(e.target.value)} aria-label="New department description" />
                <Button size="sm" variant="outline" className="w-full" loading={deptBusy} onClick={() => void addDept()}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add department
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold">Categories & routing</h3>
              <p className="mt-1 text-[12.5px] text-gray-500 dark:text-zinc-400">Each category routes submissions to its department automatically.</p>
              <div className="mt-3 space-y-3">
                {departments.map((d) => (
                  <div key={d.id} className="rounded-md border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50">
                    <p className="border-b border-gray-200 px-3.5 py-2 text-[12px] font-bold uppercase tracking-wider text-gray-400 dark:border-zinc-800 dark:text-zinc-600">{d.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 px-3.5 py-2.5">
                      {categories.filter((c) => c.departmentId === d.id).map((c) => (
                        <span
                          key={c.id}
                          className={cn(
                            "group inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium",
                            c.active
                              ? "border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                              : "border-gray-200 bg-white text-gray-400 line-through dark:border-zinc-800 dark:text-zinc-600"
                          )}
                        >
                          {c.name}
                          <button
                            onClick={async () => {
                              try {
                                await api.toggleCategory(c.id);
                                toast.success(`“${c.name}” ${c.active ? "deactivated" : "activated"}`);
                                await loadStructure();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed");
                              }
                            }}
                            aria-label={`${c.active ? "Deactivate" : "Activate"} ${c.name}`}
                            title={c.active ? "Deactivate" : "Activate"}
                            className="text-gray-400 hover:text-amber-600"
                          >
                            <Power className="h-3 w-3" aria-hidden />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await api.deleteCategory(c.id);
                                toast.success(`“${c.name}” deleted`);
                                await loadStructure();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed");
                              }
                            }}
                            aria-label={`Delete ${c.name}`}
                            title="Delete"
                            className="text-gray-400 hover:text-rose-600"
                          >
                            <XCircle className="h-3 w-3" aria-hidden />
                          </button>
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1">
                        <input
                          value={newCat[d.id] ?? ""}
                          onChange={(e) => setNewCat((p) => ({ ...p, [d.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && void addCat(d.id)}
                          placeholder="New category…"
                          aria-label={`New category for ${d.name}`}
                          className="h-7 w-32 rounded-md border border-gray-200 bg-white px-2 text-[12px] focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          onClick={() => void addCat(d.id)}
                          aria-label={`Add category to ${d.name}`}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400"
                        >
                          <Plus className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── keys ── */}
        {tab === "keys" && (
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <h3 className="flex items-center gap-2 text-sm font-bold"><KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden /> Generate access key</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500 dark:text-zinc-400">
                Hand a key to anyone who needs anonymous access. The session gets a masked identity; no account is created.
              </p>
              <div className="mt-3 space-y-2.5">
                <div>
                  <Label htmlFor="key-type">Key type</Label>
                  <Select id="key-type" value={keyType} onChange={(e) => setKeyType(e.target.value as AnonymousKey["type"])}>
                    <option value="ONE_TIME">One-time — consumed on first login</option>
                    <option value="SESSION">Session — reusable until revoked</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="key-note">Note</Label>
                  <Textarea id="key-note" rows={2} placeholder="e.g. Town-hall feedback session" value={keyNote} onChange={(e) => setKeyNote(e.target.value)} />
                </div>
                <Button className="w-full" size="sm" loading={keyBusy} onClick={() => void genKey()}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Generate key
                </Button>
              </div>
            </div>

            <div>
              {!keys ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : keys.length === 0 ? (
                <EmptyState icon={<KeyRound className="h-5 w-5" aria-hidden />} title="No keys issued" body="Generate the first anonymous access key on the left." />
              ) : (
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
                  {keys.map((k) => (
                    <li key={k.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", k.revoked && "opacity-55")}>
                      <button
                        onClick={() => void copy(k.key)}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-[12.5px] font-bold text-gray-800 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-300"
                        title="Copy key"
                      >
                        {k.key}
                        <Copy className="h-3 w-3 text-gray-400" aria-hidden />
                      </button>
                      <Badge className="bg-gray-100 text-gray-600 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                        {k.type === "ONE_TIME" ? "One-time" : "Session"}
                      </Badge>
                      {k.revoked ? (
                        <Badge className="bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30">Revoked</Badge>
                      ) : k.used && k.type === "ONE_TIME" ? (
                        <Badge className="bg-gray-100 text-gray-500 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700">Used {k.lastUsedAt ? timeAgo(k.lastUsedAt) : ""}</Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">
                          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Active
                        </Badge>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-gray-500 dark:text-zinc-500">{k.note}</span>
                      <span className="text-[11px] text-gray-400 tnum dark:text-zinc-600">by {k.createdBy} · {fmtDate(k.createdAt)}</span>
                      {!k.revoked && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="hover:!text-rose-600 dark:hover:!text-rose-400"
                          onClick={async () => {
                            try {
                              await api.revokeKey(k.id);
                              toast.success(`${k.key} revoked`);
                              await loadKeys();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            }
                          }}
                        >
                          <XCircle className="h-3 w-3" aria-hidden /> Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <UserDialog
        open={userDialog.open}
        editing={userDialog.editing}
        departments={departments}
        onClose={() => setUserDialog({ open: false, editing: null })}
        onSaved={() => void loadUsers()}
      />
      <PasswordDialog user={pwTarget} onClose={() => setPwTarget(null)} onSaved={() => void loadUsers()} />

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?">
        <p className="text-[13px] leading-relaxed text-gray-600 dark:text-zinc-400">
          All tickets, users, keys and settings return to the original seeded state. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            loading={resetBusy}
            onClick={async () => {
              setResetBusy(true);
              try {
                await api.resetDemoData();
                setFlags(getDB().flags);
                await Promise.all([loadUsers(), loadKeys(), loadStructure()]);
                toast.success("Demo data restored");
                setResetOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Reset failed");
              } finally {
                setResetBusy(false);
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Yes, reset everything
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const FLAG_META = {
  portalOpen: { label: "Submission portal", desc: "Master switch for new employee submissions." },
  anonymousSubmissions: { label: "Anonymous submissions", desc: "Allow the anonymous toggle and access-key logins." },
  attachments: { label: "File attachments", desc: "Allow uploads on submissions and proof of resolution." },
} as const;
