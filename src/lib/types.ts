// ─── Listening Wall · domain model ────────────────────────────────────────────

export type Role =
  | "SUPER_ADMIN"
  | "MANAGEMENT"
  | "DEPT_HEAD"
  | "DEPT_MEMBER"
  | "EMPLOYEE"
  | "ANONYMOUS";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type KeyType = "ONE_TIME" | "SESSION";

export type TicketEventType =
  | "CREATED"
  | "ASSIGNED"
  | "PRIORITY"
  | "STATUS"
  | "REMARK_PUBLIC"
  | "REMARK_INTERNAL"
  | "PROOF";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface TicketEvent {
  id: string;
  type: TicketEventType;
  actor: string; // display-safe actor label (masked for anonymous actors)
  at: string;
  text?: string;
  from?: string;
  to?: string;
  attachment?: Attachment;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  departmentId: string;
  active: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // demo credentials store (plaintext by design in this sandbox)
  role: Role;
  departmentId: string | null;
  title: string;
  active: boolean;
  createdAt: string;
}

export interface AnonymousKey {
  id: string;
  key: string;
  type: KeyType;
  note: string;
  used: boolean;
  revoked: boolean;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string;
  categoryId: string;
  departmentId: string;
  status: TicketStatus;
  priority: Priority;
  anonymous: boolean;
  submitterId: string | null; // null for anonymous submissions — integrity guarantee
  submitterLabel: string; // real name OR masked alias (anon_xxxx)
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  events: TicketEvent[];
  attachment: Attachment | null;
  proofs: Attachment[];
}

export interface FeatureFlags {
  portalOpen: boolean;
  anonymousSubmissions: boolean;
  attachments: boolean;
}

export interface DB {
  v: number;
  seq: number;
  users: User[];
  departments: Department[];
  categories: Category[];
  tickets: Ticket[];
  keys: AnonymousKey[];
  flags: FeatureFlags;
}

export interface Session {
  userId: string | null;
  role: Role;
  alias: string | null; // anonymous identity, e.g. anon_8f7d9
  demo: boolean;
  keyId: string | null;
}

/** Materialized identity presented to the UI. */
export interface SessionUser {
  id: string | null;
  name: string;
  email: string | null;
  role: Role;
  departmentId: string | null;
  alias: string | null;
  demo: boolean;
}

// ─── presentation metadata ────────────────────────────────────────────────────

export const ROLE_META: Record<Role, { label: string; badge: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    badge: "bg-gray-900 text-white dark:bg-zinc-50 dark:text-zinc-950",
  },
  MANAGEMENT: {
    label: "Management",
    badge: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
  },
  DEPT_HEAD: {
    label: "Dept Head",
    badge: "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30",
  },
  DEPT_MEMBER: {
    label: "Dept Member",
    badge: "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  EMPLOYEE: {
    label: "Employee",
    badge: "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
  ANONYMOUS: {
    label: "Anonymous",
    badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  },
};

export const STATUS_META: Record<
  TicketStatus,
  { label: string; badge: string; dot: string }
> = {
  OPEN: {
    label: "Open",
    badge:
      "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    dot: "bg-gray-500 dark:bg-zinc-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge:
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
    dot: "bg-amber-500",
  },
  RESOLVED: {
    label: "Resolved",
    badge:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-emerald-600",
  },
  CLOSED: {
    label: "Closed",
    badge:
      "bg-gray-50 text-gray-500 border border-gray-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
    dot: "bg-gray-400 dark:bg-zinc-600",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; rank: number }
> = {
  LOW: {
    label: "Low",
    badge:
      "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    rank: 0,
  },
  MEDIUM: {
    label: "Medium",
    badge:
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
    rank: 1,
  },
  HIGH: {
    label: "High",
    badge:
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
    rank: 2,
  },
  URGENT: {
    label: "Urgent",
    badge:
      "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
    rank: 3,
  },
};

export const STATUS_ORDER: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export const PRIORITY_ORDER: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** Staff-side forward transitions. */
export const STAFF_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
};

/** Submitter-side transitions (own tickets only). */
export const SUBMITTER_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [],
  IN_PROGRESS: [],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export const TRANSITION_LABEL: Record<TicketStatus, string> = {
  OPEN: "Reopen",
  IN_PROGRESS: "Reopen",
  RESOLVED: "Mark Resolved",
  CLOSED: "Close Ticket",
};
