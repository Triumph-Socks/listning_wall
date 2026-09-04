import { getDB, mutate, uid, loadSession, persistSession, randomAlias, resetDB } from "./store";
import type {
  AnonymousKey,
  Attachment,
  Category,
  Department,
  FeatureFlags,
  Priority,
  Role,
  Session,
  SessionUser,
  Ticket,
  TicketStatus,
  User,
} from "./types";
import { STAFF_TRANSITIONS, SUBMITTER_TRANSITIONS } from "./types";

export class ApiError extends Error {}

const wait = () =>
  new Promise<void>((r) => setTimeout(r, 200 + Math.random() * 320));

function now(): string {
  return new Date().toISOString();
}

function fail(msg: string): never {
  throw new ApiError(msg);
}

// ─── session & identity ───────────────────────────────────────────────────────

export function getSession(): Session | null {
  return loadSession();
}

export function getSessionUser(): SessionUser | null {
  const s = getSession();
  if (!s) return null;
  if (s.role === "ANONYMOUS") {
    return {
      id: null,
      name: s.alias ?? "anonymous",
      email: null,
      role: "ANONYMOUS",
      departmentId: null,
      alias: s.alias,
      demo: s.demo,
    };
  }
  const u = getDB().users.find((x) => x.id === s.userId);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    alias: null,
    demo: s.demo,
  };
}

function requireSession(): Session {
  const s = getSession();
  if (!s) fail("Your session has expired. Please sign in again.");
  return s!;
}

function requireRole(...roles: Role[]): Session {
  const s = requireSession();
  if (!roles.includes(s.role)) fail("You do not have permission to perform this action.");
  return s;
}

// ─── auth actions ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<SessionUser> {
  await wait();
  const db = getDB();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!user || user.password !== password) fail("Invalid email or password.");
  if (!user.active) fail("This account has been deactivated. Contact an administrator.");
  persistSession({ userId: user.id, role: user.role, alias: null, demo: false, keyId: null });
  return getSessionUser()!;
}

export async function loginWithKey(keyInput: string): Promise<SessionUser> {
  await wait();
  const db = getDB();
  if (!db.flags.anonymousSubmissions)
    fail("Anonymous access is currently disabled by an administrator.");
  const key = db.keys.find((k) => k.key.toLowerCase() === keyInput.trim().toLowerCase());
  if (!key) fail("Access key not recognized.");
  if (key.revoked) fail("This access key has been revoked.");
  if (key.type === "ONE_TIME" && key.used) fail("This one-time key has already been used.");
  mutate((d) => {
    const k = d.keys.find((x) => x.id === key.id)!;
    k.used = true;
    k.lastUsedAt = now();
  });
  const alias = randomAlias();
  persistSession({ userId: null, role: "ANONYMOUS", alias, demo: false, keyId: key.id });
  return getSessionUser()!;
}

const DEMO_USERS: Record<Role, string | null> = {
  SUPER_ADMIN: "u-ava",
  MANAGEMENT: "u-marcus",
  DEPT_HEAD: "u-priya",
  DEPT_MEMBER: "u-jonas",
  EMPLOYEE: "u-noah",
  ANONYMOUS: null,
};

export async function demoLogin(role: Role): Promise<SessionUser> {
  await wait();
  if (role === "ANONYMOUS") {
    persistSession({ userId: null, role: "ANONYMOUS", alias: randomAlias(), demo: true, keyId: null });
  } else {
    const id = DEMO_USERS[role];
    persistSession({ userId: id, role, alias: null, demo: true, keyId: null });
  }
  return getSessionUser()!;
}

export async function logout(): Promise<void> {
  await wait();
  persistSession(null);
}

// ─── permission helpers ───────────────────────────────────────────────────────

export function isDeptStaff(s: Session, departmentId: string): boolean {
  if (s.role === "SUPER_ADMIN") return true;
  return (
    (s.role === "DEPT_HEAD" || s.role === "DEPT_MEMBER") &&
    getSessionUser()?.departmentId === departmentId
  );
}

export function canAssign(s: Session, t: Ticket): boolean {
  return s.role === "SUPER_ADMIN" || (s.role === "DEPT_HEAD" && isDeptStaff(s, t.departmentId));
}

export function canWork(s: Session, t: Ticket): boolean {
  const su = getSessionUser();
  if (s.role === "SUPER_ADMIN") return true;
  if (s.role === "DEPT_HEAD" && su?.departmentId === t.departmentId) return true;
  if (s.role === "DEPT_MEMBER" && su?.departmentId === t.departmentId && t.assigneeId === su.id)
    return true;
  return false;
}

export function isSubmitter(s: Session, t: Ticket): boolean {
  if (s.userId && t.submitterId === s.userId) return true;
  if (s.alias && t.anonymous && t.submitterLabel === s.alias) return true;
  return false;
}

export function canView(s: Session, t: Ticket): boolean {
  if (["SUPER_ADMIN", "MANAGEMENT"].includes(s.role)) return true;
  if (isDeptStaff(s, t.departmentId)) return true;
  if (isSubmitter(s, t)) return true;
  return false;
}

// ─── ticket actions ───────────────────────────────────────────────────────────

export interface CreateTicketInput {
  title: string;
  description: string;
  categoryId: string;
  anonymous: boolean;
  attachment: Attachment | null;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const s = requireSession();
  await wait();
  const db = getDB();
  if (!db.flags.portalOpen) fail("The submission portal is temporarily closed.");
  const su = getSessionUser()!;
  const wantsAnonymous = input.anonymous || s.role === "ANONYMOUS";
  if (wantsAnonymous && !db.flags.anonymousSubmissions)
    fail("Anonymous submissions are currently disabled.");
  const category = db.categories.find((c) => c.id === input.categoryId && c.active);
  if (!category) fail("Please choose a valid category.");

  // Anonymous integrity: never persist the real identity on anonymous tickets.
  const submitterId = wantsAnonymous ? null : s.userId;
  const submitterLabel = wantsAnonymous
    ? s.role === "ANONYMOUS"
      ? s.alias ?? randomAlias()
      : randomAlias()
    : su.name;

  return mutate((d) => {
    d.seq += 1;
    const ticket: Ticket = {
      id: uid(),
      number: `LW-${1000 + d.seq}`,
      title: input.title.trim(),
      description: input.description.trim(),
      categoryId: category.id,
      departmentId: category.departmentId,
      status: "OPEN",
      priority: "MEDIUM",
      anonymous: wantsAnonymous,
      submitterId,
      submitterLabel,
      assigneeId: null,
      createdAt: now(),
      updatedAt: now(),
      resolvedAt: null,
      events: [
        {
          id: uid(),
          type: "CREATED",
          actor: submitterLabel,
          at: now(),
          ...(input.attachment
            ? { text: "Attached a file", attachment: input.attachment }
            : {}),
        },
      ],
      attachment: input.attachment,
      proofs: [],
    };
    d.tickets.unshift(ticket);
    return ticket;
  });
}

export async function listMyTickets(): Promise<Ticket[]> {
  const s = requireSession();
  await wait();
  return getDB()
    .tickets.filter((t) => isSubmitter(s, t))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listQueue(
  scope: "department" | "all",
  departmentId: string | null
): Promise<Ticket[]> {
  const s = requireSession();
  await wait();
  const su = getSessionUser()!;
  if (scope === "all") {
    requireRole("SUPER_ADMIN");
    return [...getDB().tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  if (s.role === "SUPER_ADMIN") {
    return getDB()
      .tickets.filter((t) => !departmentId || t.departmentId === departmentId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  if (s.role !== "DEPT_HEAD" && s.role !== "DEPT_MEMBER")
    fail("You do not have access to a department queue.");
  const dept = su.departmentId;
  if (!dept) fail("Your account is not attached to a department.");
  return getDB()
    .tickets.filter((t) => t.departmentId === dept)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTicket(id: string): Promise<Ticket> {
  const s = requireSession();
  await wait();
  const t = getDB().tickets.find((x) => x.id === id);
  if (!t) fail("Ticket not found.");
  if (!canView(s, t)) fail("You do not have permission to view this ticket.");
  return t;
}

export async function listUsersForDept(departmentId: string): Promise<User[]> {
  requireSession();
  await wait();
  return getDB().users.filter(
    (u) => u.departmentId === departmentId && u.active &&
      (u.role === "DEPT_HEAD" || u.role === "DEPT_MEMBER")
  );
}

function pushEvent(t: Ticket, e: Omit<Ticket["events"][number], "id" | "at">) {
  t.events.push({ id: uid(), at: now(), ...e });
  t.updatedAt = now();
}

export async function assignTicket(ticketId: string, userId: string | null): Promise<Ticket> {
  const s = requireSession();
  await wait();
  return mutate((db) => {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) fail("Ticket not found.");
    if (!canAssign(s, t)) fail("Only department heads or admins can assign tickets.");
    const actor = getSessionUser()!.name;
    if (userId) {
      const u = db.users.find((x) => x.id === userId);
      if (!u || u.departmentId !== t.departmentId) fail("Assignee must belong to this department.");
      t.assigneeId = userId;
      pushEvent(t, { type: "ASSIGNED", actor, text: u.name });
    } else {
      t.assigneeId = null;
      pushEvent(t, { type: "ASSIGNED", actor, text: "Unassigned" });
    }
    return t;
  });
}

export async function setPriority(ticketId: string, priority: Priority): Promise<Ticket> {
  const s = requireSession();
  await wait();
  return mutate((db) => {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) fail("Ticket not found.");
    if (!canAssign(s, t)) fail("Only department heads or admins can change priority.");
    if (t.priority === priority) return t;
    pushEvent(t, { type: "PRIORITY", actor: getSessionUser()!.name, from: t.priority, to: priority });
    t.priority = priority;
    return t;
  });
}

export async function changeStatus(ticketId: string, to: TicketStatus): Promise<Ticket> {
  const s = requireSession();
  await wait();
  return mutate((db) => {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) fail("Ticket not found.");
    const staff = canWork(s, t);
    const submitter = isSubmitter(s, t);
    const allowed = staff ? STAFF_TRANSITIONS[t.status] : submitter ? SUBMITTER_TRANSITIONS[t.status] : [];
    if (!allowed.includes(to))
      fail(`This ticket cannot move from ${t.status} to ${to} with your role.`);
    const actor = staff ? getSessionUser()!.name : t.submitterLabel;
    pushEvent(t, { type: "STATUS", actor, from: t.status, to });
    t.status = to;
    if (to === "RESOLVED") t.resolvedAt = now();
    if (to === "IN_PROGRESS") t.resolvedAt = null;
    return t;
  });
}

export async function addRemark(
  ticketId: string,
  text: string,
  internal: boolean
): Promise<Ticket> {
  const s = requireSession();
  await wait();
  return mutate((db) => {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) fail("Ticket not found.");
    const staff = canWork(s, t) || (s.role === "DEPT_HEAD" && isDeptStaff(s, t.departmentId));
    if (internal && !staff) fail("Internal remarks are limited to department staff.");
    if (!staff && !isSubmitter(s, t)) fail("You cannot comment on this ticket.");
    const actor = staff ? getSessionUser()!.name : t.submitterLabel;
    pushEvent(t, { type: internal ? "REMARK_INTERNAL" : "REMARK_PUBLIC", actor, text: text.trim() });
    return t;
  });
}

export async function addProof(ticketId: string, att: Attachment): Promise<Ticket> {
  const s = requireSession();
  await wait();
  const db = getDB();
  if (!db.flags.attachments) fail("File uploads are currently disabled.");
  return mutate((d) => {
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) fail("Ticket not found.");
    if (!canWork(s, t)) fail("Only assigned staff can attach proof of resolution.");
    t.proofs.push(att);
    pushEvent(t, {
      type: "PROOF",
      actor: getSessionUser()!.name,
      text: att.name,
      attachment: att,
    });
    return t;
  });
}

// ─── admin: users ─────────────────────────────────────────────────────────────

export async function adminListUsers(): Promise<User[]> {
  requireRole("SUPER_ADMIN");
  await wait();
  return [...getDB().users].sort((a, b) => a.name.localeCompare(b.name));
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  title: string;
  password: string;
}

export async function adminCreateUser(input: UserInput): Promise<User> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))
      fail("A user with this email already exists.");
    const user: User = {
      id: uid(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      departmentId: ["DEPT_HEAD", "DEPT_MEMBER"].includes(input.role) ? input.departmentId : null,
      title: input.title.trim() || "—",
      active: true,
      createdAt: now(),
    };
    db.users.push(user);
    return user;
  });
}

export async function adminUpdateUser(
  id: string,
  patch: { name: string; email: string; role: Role; departmentId: string | null; title: string }
): Promise<User> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) fail("User not found.");
    if (
      db.users.some(
        (x) => x.id !== id && x.email.toLowerCase() === patch.email.trim().toLowerCase()
      )
    )
      fail("A user with this email already exists.");
    u.name = patch.name.trim();
    u.email = patch.email.trim().toLowerCase();
    u.role = patch.role;
    u.departmentId = ["DEPT_HEAD", "DEPT_MEMBER"].includes(patch.role)
      ? patch.departmentId
      : null;
    u.title = patch.title.trim() || "—";
    return u;
  });
}

export async function adminSetActive(id: string, active: boolean): Promise<User> {
  const me = requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) fail("User not found.");
    if (u.id === me.userId) fail("You cannot deactivate your own account.");
    u.active = active;
    return u;
  });
}

export async function adminResetPassword(id: string, password: string): Promise<void> {
  requireRole("SUPER_ADMIN");
  await wait();
  mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) fail("User not found.");
    u.password = password;
  });
}

// ─── admin: departments & categories ─────────────────────────────────────────

export async function createDepartment(name: string, description: string): Promise<Department> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (db.departments.some((d) => d.slug === slug)) fail("A department with this name already exists.");
    const dept: Department = { id: uid(), name: name.trim(), slug: slug || uid().slice(0, 6), description: description.trim(), createdAt: now() };
    db.departments.push(dept);
    return dept;
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  requireRole("SUPER_ADMIN");
  await wait();
  mutate((db) => {
    if (db.tickets.some((t) => t.departmentId === id))
      fail("Cannot delete: this department still has tickets.");
    if (db.users.some((u) => u.departmentId === id))
      fail("Cannot delete: users are still assigned to this department.");
    if (db.categories.some((c) => c.departmentId === id))
      fail("Cannot delete: remove its categories first.");
    db.departments = db.departments.filter((d) => d.id !== id);
  });
}

export async function createCategory(name: string, departmentId: string): Promise<Category> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    if (!db.departments.some((d) => d.id === departmentId)) fail("Choose a valid department.");
    const cat: Category = { id: uid(), name: name.trim(), departmentId, active: true, createdAt: now() };
    db.categories.push(cat);
    return cat;
  });
}

export async function toggleCategory(id: string): Promise<Category> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (!c) fail("Category not found.");
    c.active = !c.active;
    return c;
  });
}

export async function deleteCategory(id: string): Promise<void> {
  requireRole("SUPER_ADMIN");
  await wait();
  mutate((db) => {
    if (db.tickets.some((t) => t.categoryId === id))
      fail("Cannot delete: tickets already use this category. Deactivate it instead.");
    db.categories = db.categories.filter((c) => c.id !== id);
  });
}

// ─── admin: anonymous keys ────────────────────────────────────────────────────

export async function listKeys(): Promise<AnonymousKey[]> {
  requireRole("SUPER_ADMIN");
  await wait();
  return [...getDB().keys].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function generateKey(type: AnonymousKey["type"], note: string): Promise<AnonymousKey> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    const rand = () => Math.floor(1000 + Math.random() * 9000);
    const key: AnonymousKey = {
      id: uid(),
      key: `LW-${type === "ONE_TIME" ? "KEY" : "SES"}-${rand()}`,
      type,
      note: note.trim() || "—",
      used: false,
      revoked: false,
      createdBy: getSessionUser()!.name,
      createdAt: now(),
      lastUsedAt: null,
    };
    db.keys.unshift(key);
    return key;
  });
}

export async function revokeKey(id: string): Promise<void> {
  requireRole("SUPER_ADMIN");
  await wait();
  mutate((db) => {
    const k = db.keys.find((x) => x.id === id);
    if (!k) fail("Key not found.");
    k.revoked = true;
  });
}

// ─── admin: flags & maintenance ───────────────────────────────────────────────

export async function getFlags(): Promise<FeatureFlags> {
  requireRole("SUPER_ADMIN");
  await wait();
  return { ...getDB().flags };
}

export async function setFlag(key: keyof FeatureFlags, value: boolean): Promise<FeatureFlags> {
  requireRole("SUPER_ADMIN");
  await wait();
  return mutate((db) => {
    db.flags[key] = value;
    return { ...db.flags };
  });
}

export async function resetDemoData(): Promise<void> {
  requireRole("SUPER_ADMIN");
  await wait();
  resetDB();
}

// ─── management analytics ─────────────────────────────────────────────────────

export interface ManagementStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResolutionMs: number;
  anonymous: number;
  identified: number;
  byDept: { name: string; total: number; resolved: number; open: number }[];
  weekly: { week: string; submissions: number; resolutions: number }[];
  recent: { id: string; ticketId: string; number: string; title: string; type: string; actor: string; at: string; status: TicketStatus }[];
}

export async function getStats(): Promise<ManagementStats> {
  requireRole("MANAGEMENT", "SUPER_ADMIN");
  await wait();
  const db = getDB();
  const tickets = db.tickets;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "Unknown";

  const resolvedTimes = tickets
    .filter((t) => t.resolvedAt)
    .map((t) => new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime());
  const avg =
    resolvedTimes.length > 0
      ? resolvedTimes.reduce((a, b) => a + b, 0) / resolvedTimes.length
      : 0;

  const byDept = db.departments.map((d) => {
    const ts = tickets.filter((t) => t.departmentId === d.id);
    return {
      name: d.name,
      total: ts.length,
      resolved: ts.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
      open: ts.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
    };
  });

  // last 8 weeks, Monday-start buckets
  const weeks: { start: Date; label: string }[] = [];
  const today = new Date();
  const day = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    weeks.push({
      start,
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
  }
  const weekly = weeks.map((w, i) => {
    const end = new Date(w.start);
    end.setDate(w.start.getDate() + 7);
    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= w.start.getTime() && t < end.getTime();
    };
    return {
      week: i === weeks.length - 1 ? "This wk" : w.label,
      submissions: tickets.filter((t) => inRange(t.createdAt)).length,
      resolutions: tickets.filter((t) => t.resolvedAt && inRange(t.resolvedAt)).length,
    };
  });

  const recent = tickets
    .flatMap((t) =>
      t.events.map((e) => ({
        id: e.id,
        ticketId: t.id,
        number: t.number,
        title: t.title,
        type: e.type,
        actor: e.actor,
        at: e.at,
        status: t.status,
      }))
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 9);

  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "OPEN").length,
    inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    resolved: tickets.filter((t) => t.status === "RESOLVED").length,
    closed: tickets.filter((t) => t.status === "CLOSED").length,
    avgResolutionMs: avg,
    anonymous: tickets.filter((t) => t.anonymous).length,
    identified: tickets.filter((t) => !t.anonymous).length,
    byDept,
    weekly,
    recent,
  };
}

// ─── shared lookups & utilities ───────────────────────────────────────────────

export async function listDepartments(): Promise<Department[]> {
  requireSession();
  await wait();
  return [...getDB().departments].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCategories(): Promise<Category[]> {
  requireSession();
  await wait();
  return [...getDB().categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function categoryName(db: { categories: Category[] }, id: string): string {
  return db.categories.find((c) => c.id === id)?.name ?? "—";
}

export const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

export function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(new ApiError("File is too large — the limit is 1.5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: uid(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result),
      });
    reader.onerror = () => reject(new ApiError("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
