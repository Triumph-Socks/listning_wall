import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Star, X } from "lucide-react";
import { PRIORITY_META, ROLE_META, STATUS_META, type Priority, type Role, type TicketStatus } from "../lib/types";
import { cn } from "../lib/cn";

// ─── button ───────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "subtle" | "success";
type BtnSize = "xs" | "sm" | "md";

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:hover:bg-blue-600 shadow-none",
  outline:
    "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
  subtle:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
};

const btnSizes: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5",
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ─── form primitives ──────────────────────────────────────────────────────────

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-[13px] font-medium text-gray-700 dark:text-zinc-300 mb-1.5", className)}
    >
      {children}
    </label>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors",
        "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15",
        "dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500",
        invalid
          ? "border-rose-400 dark:border-rose-500/60"
          : "border-gray-200 dark:border-zinc-800",
        className
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 transition-colors resize-y",
        "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15",
        "dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500",
        invalid ? "border-rose-400 dark:border-rose-500/60" : "border-gray-200 dark:border-zinc-800",
        className
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-md border bg-white pl-3 pr-8 text-sm text-gray-900 transition-colors",
          "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15",
          "dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-blue-500",
          invalid ? "border-rose-400 dark:border-rose-500/60" : "border-gray-200 dark:border-zinc-800"
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-zinc-500" aria-hidden />
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{children}</p>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-500">{children}</p>;
}

// ─── badges ───────────────────────────────────────────────────────────────────

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4", className)}>
      {children}
    </span>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-px", className)}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-gray-300 dark:text-zinc-700"
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge className={m.badge}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return <Badge className={m.badge}>{m.label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return <Badge className={m.badge}>{m.label}</Badge>;
}

// ─── card & panels ────────────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-md border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900", className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-zinc-800">
      <h3 className="text-[13px] font-semibold text-gray-900 dark:text-zinc-50">{children}</h3>
      {right}
    </div>
  );
}

// ─── switch ───────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-blue-600" : "bg-gray-300 dark:bg-zinc-700",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[19px]" : "translate-x-[3px]"
        )}
        aria-hidden
      />
    </button>
  );
}

// ─── dialog ───────────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/40 p-4 pt-[8vh] backdrop-blur-[1px] dark:bg-black/60" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-md border border-gray-200 bg-white shadow-xl rise dark:border-zinc-800 dark:bg-zinc-900",
          wide ? "max-w-2xl" : "max-w-md"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors",
            active === t.id
              ? "text-gray-900 dark:text-zinc-50"
              : "text-gray-500 hover:text-gray-800 dark:text-zinc-500 dark:hover:text-zinc-200"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className={cn(
              "rounded px-1.5 py-px text-[10px] font-semibold tnum",
              active === t.id
                ? "bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500"
            )}>
              {t.count}
            </span>
          )}
          {active === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

// ─── skeleton & empty state ───────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded", className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-gray-500 dark:text-zinc-400">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── logo ─────────────────────────────────────────────────────────────────────

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md bg-blue-600"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="9" width="3.4" height="6" rx="1.2" fill="white" opacity="0.65" />
        <rect x="10.3" y="4.5" width="3.4" height="15" rx="1.2" fill="white" />
        <rect x="16.6" y="8" width="3.4" height="8" rx="1.2" fill="white" opacity="0.65" />
      </svg>
    </div>
  );
}
