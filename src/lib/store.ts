import { v4 as uuidv4 } from "uuid";
import type {
  DB,
  Ticket,
  TicketEvent,
  TicketEventType,
  TicketStatus,
  Priority,
  Session,
  Attachment,
} from "./types";

// ─── storage keys ─────────────────────────────────────────────────────────────

const DB_KEY = "lw-db-v2"; // v2: satisfaction ratings schema
const SESSION_KEY = "lw-session-v1";

export const uid = () => uuidv4();

// ─── time helpers for seeding ─────────────────────────────────────────────────

function ago(days: number, hours = 0): string {
  return new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();
}

/** Tiny inline-SVG document used as seeded "proof of resolution" imagery. */
function svgProof(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#f4f4f5"/><rect x="40" y="36" width="560" height="328" rx="8" fill="#ffffff" stroke="#e4e4e7"/><rect x="72" y="72" width="200" height="14" rx="3" fill="${accent}"/><rect x="72" y="110" width="496" height="8" rx="2" fill="#e4e4e7"/><rect x="72" y="130" width="440" height="8" rx="2" fill="#e4e4e7"/><rect x="72" y="150" width="470" height="8" rx="2" fill="#e4e4e7"/><rect x="72" y="190" width="240" height="120" rx="6" fill="${accent}" opacity="0.12"/><path d="M96 250 l40 -34 l28 22 l44 -40 l48 52 z" fill="${accent}" opacity="0.55"/><circle cx="120" cy="222" r="10" fill="${accent}" opacity="0.55"/><rect x="336" y="196" width="200" height="10" rx="2" fill="#d4d4d8"/><rect x="336" y="218" width="160" height="10" rx="2" fill="#d4d4d8"/><rect x="72" y="328" width="96" height="22" rx="4" fill="${accent}"/><text x="84" y="343" font-family="monospace" font-size="12" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─── seed ─────────────────────────────────────────────────────────────────────

type Ev = Partial<TicketEvent> & { type: TicketEventType; actor: string; at: string };
const ev = (e: Ev): TicketEvent => ({ id: uid(), ...e });

interface SeedTicket {
  title: string;
  description: string;
  categoryId: string;
  departmentId: string;
  status: TicketStatus;
  priority: Priority;
  anonymous?: boolean;
  submitterId?: string | null;
  submitterLabel: string;
  assigneeId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  events: TicketEvent[];
  proofs?: Attachment[];
  attachment?: Attachment | null;
}

function T(t: SeedTicket, n: number): Ticket {
  return {
    id: uid(),
    number: `LW-${1000 + n}`,
    title: t.title,
    description: t.description,
    categoryId: t.categoryId,
    departmentId: t.departmentId,
    status: t.status,
    priority: t.priority,
    anonymous: t.anonymous ?? false,
    submitterId: t.submitterId ?? null,
    submitterLabel: t.submitterLabel,
    assigneeId: t.assigneeId ?? null,
    createdAt: t.createdAt,
    updatedAt: t.events.length
      ? t.events[t.events.length - 1].at
      : t.createdAt,
    resolvedAt: t.resolvedAt ?? null,
    rating: t.rating ?? null,
    ratingComment: t.ratingComment ?? null,
    ratedAt: t.ratedAt ?? null,
    events: t.events,
    attachment: t.attachment ?? null,
    proofs: t.proofs ?? [],
  };
}

function seedDB(): DB {
  // users — every demo password is "demo1234"
  const pw = "demo1234";
  const users = [
    { id: "u-ava", name: "Ava Stone", email: "ava@wall.co", password: pw, role: "SUPER_ADMIN" as const, departmentId: null, title: "Platform Owner", active: true, createdAt: ago(120) },
    { id: "u-marcus", name: "Marcus Reed", email: "marcus@wall.co", password: pw, role: "MANAGEMENT" as const, departmentId: null, title: "Chief Operating Officer", active: true, createdAt: ago(118) },
    { id: "u-priya", name: "Priya Nair", email: "priya@wall.co", password: pw, role: "DEPT_HEAD" as const, departmentId: "d-it", title: "Head of IT", active: true, createdAt: ago(115) },
    { id: "u-tom", name: "Tom Okafor", email: "tom@wall.co", password: pw, role: "DEPT_HEAD" as const, departmentId: "d-hr", title: "Head of People", active: true, createdAt: ago(115) },
    { id: "u-elena", name: "Elena Cruz", email: "elena@wall.co", password: pw, role: "DEPT_HEAD" as const, departmentId: "d-mkt", title: "Head of Marketing", active: true, createdAt: ago(110) },
    { id: "u-ruth", name: "Ruth Diaz", email: "ruth@wall.co", password: pw, role: "DEPT_HEAD" as const, departmentId: "d-fac", title: "Facilities Manager", active: true, createdAt: ago(108) },
    { id: "u-jonas", name: "Jonas Weber", email: "jonas@wall.co", password: pw, role: "DEPT_MEMBER" as const, departmentId: "d-it", title: "IT Support Engineer", active: true, createdAt: ago(100) },
    { id: "u-mei", name: "Mei Lin", email: "mei@wall.co", password: pw, role: "DEPT_MEMBER" as const, departmentId: "d-it", title: "Systems Administrator", active: true, createdAt: ago(96) },
    { id: "u-sofia", name: "Sofia Rossi", email: "sofia@wall.co", password: pw, role: "DEPT_MEMBER" as const, departmentId: "d-hr", title: "HR Generalist", active: true, createdAt: ago(90) },
    { id: "u-noah", name: "Noah Kim", email: "noah@wall.co", password: pw, role: "EMPLOYEE" as const, departmentId: null, title: "Product Designer", active: true, createdAt: ago(80) },
    { id: "u-zoe", name: "Zoe Adams", email: "zoe@wall.co", password: pw, role: "EMPLOYEE" as const, departmentId: null, title: "Financial Accountant", active: true, createdAt: ago(75) },
  ];

  const departments = [
    { id: "d-it", name: "IT", slug: "it", description: "Hardware, software, access and network issues.", createdAt: ago(120) },
    { id: "d-hr", name: "Human Resources", slug: "hr", description: "Payroll, benefits, workplace concerns and policy.", createdAt: ago(120) },
    { id: "d-mkt", name: "Marketing", slug: "marketing", description: "Campaign ideas and brand feedback.", createdAt: ago(118) },
    { id: "d-fac", name: "Facilities", slug: "facilities", description: "Office maintenance and safety reports.", createdAt: ago(118) },
  ];

  const categories = [
    { id: "c-hw", name: "Hardware Issue", departmentId: "d-it", active: true, createdAt: ago(120) },
    { id: "c-sw", name: "Software & Access", departmentId: "d-it", active: true, createdAt: ago(120) },
    { id: "c-net", name: "Network & VPN", departmentId: "d-it", active: true, createdAt: ago(120) },
    { id: "c-pay", name: "Payroll & Benefits", departmentId: "d-hr", active: true, createdAt: ago(120) },
    { id: "c-wpc", name: "Workplace Concern", departmentId: "d-hr", active: true, createdAt: ago(120) },
    { id: "c-leave", name: "Leave Policy", departmentId: "d-hr", active: true, createdAt: ago(120) },
    { id: "c-camp", name: "Campaign Idea", departmentId: "d-mkt", active: true, createdAt: ago(118) },
    { id: "c-brand", name: "Brand Feedback", departmentId: "d-mkt", active: true, createdAt: ago(118) },
    { id: "c-maint", name: "Office Maintenance", departmentId: "d-fac", active: true, createdAt: ago(118) },
    { id: "c-safety", name: "Safety Report", departmentId: "d-fac", active: true, createdAt: ago(118) },
  ];

  const tickets: Ticket[] = [
    T(
      {
        title: "Laptop screen flickers on docked display",
        description:
          "Since Monday my ThinkPad flickers whenever it is connected to the dual-dock at desk 4-18. Re-seating the USB-C cable helps for a few minutes. I have updated drivers to no avail. This is blocking my design reviews.",
        categoryId: "c-hw", departmentId: "d-it", status: "IN_PROGRESS", priority: "HIGH",
        submitterId: "u-noah", submitterLabel: "Noah Kim", assigneeId: "u-jonas",
        createdAt: ago(2, 5),
        events: [
          ev({ type: "CREATED", actor: "Noah Kim", at: ago(2, 5) }),
          ev({ type: "ASSIGNED", actor: "Priya Nair", at: ago(2, 3), text: "Jonas Weber" }),
          ev({ type: "PRIORITY", actor: "Priya Nair", at: ago(2, 3), from: "MEDIUM", to: "HIGH" }),
          ev({ type: "STATUS", actor: "Jonas Weber", at: ago(2, 1), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_INTERNAL", actor: "Jonas Weber", at: ago(1, 6), text: "Dock firmware 1.4.2 is known-bad. Ordering replacement dock from stock; ETA tomorrow." }),
        ],
      },
      1
    ),
    T(
      {
        title: "VPN drops every ~20 minutes from home office",
        description:
          "The corporate VPN disconnects roughly every 20 minutes when connecting from my home network (fiber, 500 Mbps). Re-authenticating each time is painful during on-call rotations.",
        categoryId: "c-net", departmentId: "d-it", status: "OPEN", priority: "MEDIUM",
        submitterId: "u-mei", submitterLabel: "Mei Lin", assigneeId: null,
        createdAt: ago(1, 2),
        events: [ev({ type: "CREATED", actor: "Mei Lin", at: ago(1, 2) })],
      },
      2
    ),
    T(
      {
        title: "Cannot access the finance dashboard after role change",
        description:
          "After my transfer to the finance team my SSO account lost access to the BI dashboard. My manager approved the access request last week (ticket in the old system #8812).",
        categoryId: "c-sw", departmentId: "d-it", status: "RESOLVED", priority: "MEDIUM",
        submitterId: "u-zoe", submitterLabel: "Zoe Adams", assigneeId: "u-mei",
        createdAt: ago(6, 4), resolvedAt: ago(4, 2),
        rating: 5, ratingComment: "Fast turnaround — access restored within a day.", ratedAt: ago(4, 1),
        events: [
          ev({ type: "CREATED", actor: "Zoe Adams", at: ago(6, 4) }),
          ev({ type: "ASSIGNED", actor: "Priya Nair", at: ago(6, 2), text: "Mei Lin" }),
          ev({ type: "STATUS", actor: "Mei Lin", at: ago(5, 6), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Mei Lin", at: ago(4, 3), text: "Your group membership was out of sync with HRIS. Re-synced and granted BI-Reader. Please re-login." }),
          ev({ type: "STATUS", actor: "Mei Lin", at: ago(4, 2), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "PROOF", actor: "Mei Lin", at: ago(4, 2), text: "Access audit export", attachment: { id: uid(), name: "access-audit-zoe.svg", type: "image/svg+xml", size: 4820, dataUrl: svgProof("VERIFIED", "#059669") } }),
          ev({ type: "RATING", actor: "Zoe Adams", at: ago(4, 1), from: "5", text: "Fast turnaround — access restored within a day." }),
        ],
        proofs: [{ id: uid(), name: "access-audit-zoe.svg", type: "image/svg+xml", size: 4820, dataUrl: svgProof("VERIFIED", "#059669") }],
      },
      3
    ),
    T(
      {
        title: "Standing desk at 3-07 stuck at lowest height",
        description:
          "The height controller on desk 3-07 shows E-05 and the desk will not rise. Two of us share that desk and the other person needs it raised.",
        categoryId: "c-maint", departmentId: "d-fac", status: "IN_PROGRESS", priority: "LOW",
        submitterId: "u-zoe", submitterLabel: "Zoe Adams", assigneeId: "u-ruth",
        createdAt: ago(3, 7),
        events: [
          ev({ type: "CREATED", actor: "Zoe Adams", at: ago(3, 7) }),
          ev({ type: "STATUS", actor: "Ruth Diaz", at: ago(3, 2), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Ruth Diaz", at: ago(3, 1), text: "Vendor technician booked for Thursday 10:00. Until then desk 3-09 is free." }),
        ],
      },
      4
    ),
    T(
      {
        title: "Payroll missed my overtime hours for March",
        description:
          "My March payslip is missing 11.5 overtime hours approved by my manager in the timesheet system. I have attached the approval screenshot.",
        categoryId: "c-pay", departmentId: "d-hr", status: "RESOLVED", priority: "HIGH",
        submitterId: "u-noah", submitterLabel: "Noah Kim", assigneeId: "u-sofia",
        createdAt: ago(13, 5), resolvedAt: ago(11, 1),
        rating: 4, ratingComment: "Payout confirmed in the April run. A quicker heads-up would make it a five.", ratedAt: ago(10, 6),
        attachment: { id: uid(), name: "timesheet-approval.svg", type: "image/svg+xml", size: 5120, dataUrl: svgProof("APPROVED", "#2563eb") },
        events: [
          ev({ type: "CREATED", actor: "Noah Kim", at: ago(13, 5) }),
          ev({ type: "ASSIGNED", actor: "Tom Okafor", at: ago(13, 3), text: "Sofia Rossi" }),
          ev({ type: "STATUS", actor: "Sofia Rossi", at: ago(12, 6), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_INTERNAL", actor: "Sofia Rossi", at: ago(12, 2), text: "Payroll batch was locked before the approval synced. Correction scheduled in next run." }),
          ev({ type: "REMARK_PUBLIC", actor: "Sofia Rossi", at: ago(11, 2), text: "Confirmed — the 11.5h will be paid out with the April run, visible from the 28th." }),
          ev({ type: "STATUS", actor: "Sofia Rossi", at: ago(11, 1), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "RATING", actor: "Noah Kim", at: ago(10, 6), from: "4", text: "Payout confirmed in the April run. A quicker heads-up would make it a five." }),
        ],
      },
      5
    ),
    T(
      {
        title: "Anonymous: open-plan noise makes focus work impossible",
        description:
          "The sales pod next to engineering takes calls on speaker most afternoons. Several of us have stopped using the floor after lunch. I would rather not attach my name to this because my partner works in that team.",
        categoryId: "c-wpc", departmentId: "d-hr", status: "IN_PROGRESS", priority: "MEDIUM",
        anonymous: true, submitterId: null, submitterLabel: "anon_7c2e1", assigneeId: "u-tom",
        createdAt: ago(8, 6),
        events: [
          ev({ type: "CREATED", actor: "anon_7c2e1", at: ago(8, 6) }),
          ev({ type: "STATUS", actor: "Tom Okafor", at: ago(8, 1), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_INTERNAL", actor: "Tom Okafor", at: ago(7, 4), text: "Drafting a call-room etiquette note with Facilities; also evaluating two extra phone booths for Q3." }),
        ],
      },
      6
    ),
    T(
      {
        title: "Anonymous: onboarding buddy program quietly disappeared",
        description:
          "New hires in my team have not been assigned onboarding buddies since January, even though the handbook promises one in week 1. Worth checking whether the program is dead or just broken.",
        categoryId: "c-wpc", departmentId: "d-hr", status: "OPEN", priority: "LOW",
        anonymous: true, submitterId: null, submitterLabel: "anon_91bf4", assigneeId: null,
        createdAt: ago(0, 20),
        events: [ev({ type: "CREATED", actor: "anon_91bf4", at: ago(0, 20) })],
      },
      7
    ),
    T(
      {
        title: "Idea: short video series featuring real customer setups",
        description:
          "Instead of polished studio ads, a 60-second series shot on location with actual customers using our product. Cheap to produce, high authenticity. Happy to draft an episode list.",
        categoryId: "c-camp", departmentId: "d-mkt", status: "OPEN", priority: "LOW",
        submitterId: "u-noah", submitterLabel: "Noah Kim", assigneeId: null,
        createdAt: ago(4, 8),
        events: [ev({ type: "CREATED", actor: "Noah Kim", at: ago(4, 8) })],
      },
      8
    ),
    T(
      {
        title: "Website hero copy contradicts the new pricing page",
        description:
          "The homepage still advertises 'free forever for teams up to 5' while pricing says the free tier caps at 3 seats since February. Sales is getting asked about this weekly.",
        categoryId: "c-brand", departmentId: "d-mkt", status: "RESOLVED", priority: "HIGH",
        submitterId: "u-zoe", submitterLabel: "Zoe Adams", assigneeId: "u-elena",
        createdAt: ago(20, 3), resolvedAt: ago(18, 5),
        events: [
          ev({ type: "CREATED", actor: "Zoe Adams", at: ago(20, 3) }),
          ev({ type: "ASSIGNED", actor: "Elena Cruz", at: ago(20, 1), text: "Elena Cruz" }),
          ev({ type: "STATUS", actor: "Elena Cruz", at: ago(19, 4), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Elena Cruz", at: ago(18, 6), text: "Good catch. Copy updated across homepage, footer and the two landing pages. Legal reviewed." }),
          ev({ type: "STATUS", actor: "Elena Cruz", at: ago(18, 5), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "PROOF", actor: "Elena Cruz", at: ago(18, 5), text: "Before/after screenshots", attachment: { id: uid(), name: "copy-fix-proof.svg", type: "image/svg+xml", size: 4210, dataUrl: svgProof("SHIPPED", "#2563eb") } }),
        ],
        proofs: [{ id: uid(), name: "copy-fix-proof.svg", type: "image/svg+xml", size: 4210, dataUrl: svgProof("SHIPPED", "#2563eb") }],
      },
      9
    ),
    T(
      {
        title: "Kitchen extractor hood rattling on floor 2",
        description:
          "The extractor hood in the floor 2 kitchen makes a loud rattling noise whenever it is on stage 2 or 3. People avoid the kitchen during lunch.",
        categoryId: "c-maint", departmentId: "d-fac", status: "CLOSED", priority: "LOW",
        submitterId: "u-noah", submitterLabel: "Noah Kim", assigneeId: "u-ruth",
        createdAt: ago(34, 2), resolvedAt: ago(30, 4),
        rating: 5, ratingComment: "Silent now — thank you!", ratedAt: ago(29, 9),
        events: [
          ev({ type: "CREATED", actor: "Noah Kim", at: ago(34, 2) }),
          ev({ type: "STATUS", actor: "Ruth Diaz", at: ago(33, 5), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Ruth Diaz", at: ago(30, 5), text: "Fan bearing replaced and hood re-balanced. Should be silent now." }),
          ev({ type: "STATUS", actor: "Ruth Diaz", at: ago(30, 4), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "RATING", actor: "Noah Kim", at: ago(29, 9), from: "5", text: "Silent now — thank you!" }),
          ev({ type: "STATUS", actor: "Noah Kim", at: ago(29, 8), from: "RESOLVED", to: "CLOSED" }),
        ],
      },
      10
    ),
    T(
      {
        title: "Emergency exit sign on stairwell B is dark",
        description:
          "The exit sign above the stairwell B door on floor 3 has been unlit for at least a week. Safety-relevant, please prioritize.",
        categoryId: "c-safety", departmentId: "d-fac", status: "RESOLVED", priority: "URGENT",
        submitterId: "u-mei", submitterLabel: "Mei Lin", assigneeId: "u-ruth",
        createdAt: ago(9, 3), resolvedAt: ago(8, 6),
        events: [
          ev({ type: "CREATED", actor: "Mei Lin", at: ago(9, 3) }),
          ev({ type: "PRIORITY", actor: "Ruth Diaz", at: ago(9, 2), from: "HIGH", to: "URGENT" }),
          ev({ type: "STATUS", actor: "Ruth Diaz", at: ago(9, 1), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Ruth Diaz", at: ago(8, 6), text: "LED unit replaced and battery test passed. Logged in the fire-safety register." }),
          ev({ type: "STATUS", actor: "Ruth Diaz", at: ago(8, 6), from: "IN_PROGRESS", to: "RESOLVED" }),
        ],
      },
      11
    ),
    T(
      {
        title: "Parental leave policy page is outdated",
        description:
          "The intranet policy still says 12 weeks but the contract template from January says 16. Which one is correct? Several expecting parents are confused.",
        categoryId: "c-leave", departmentId: "d-hr", status: "CLOSED", priority: "MEDIUM",
        submitterId: "u-mei", submitterLabel: "Mei Lin", assigneeId: "u-sofia",
        createdAt: ago(41, 5), resolvedAt: ago(38, 2),
        rating: 3, ratingComment: "Answered the question, but the page had been outdated for weeks before anyone flagged it.", ratedAt: ago(37, 7),
        events: [
          ev({ type: "CREATED", actor: "Mei Lin", at: ago(41, 5) }),
          ev({ type: "STATUS", actor: "Sofia Rossi", at: ago(40, 3), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Sofia Rossi", at: ago(38, 3), text: "16 weeks is correct. Intranet page corrected and archived versions removed." }),
          ev({ type: "STATUS", actor: "Sofia Rossi", at: ago(38, 2), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "RATING", actor: "Mei Lin", at: ago(37, 7), from: "3", text: "Answered the question, but the page had been outdated for weeks before anyone flagged it." }),
          ev({ type: "STATUS", actor: "Mei Lin", at: ago(37, 6), from: "RESOLVED", to: "CLOSED" }),
        ],
      },
      12
    ),
    T(
      {
        title: "Anonymous: manager schedules 1:1s but cancels them weekly",
        description:
          "For the past two months my weekly 1:1 has been cancelled the same morning, every week, with no reschedule. Feedback never flows back to me. I am worried about raising this directly.",
        categoryId: "c-wpc", departmentId: "d-hr", status: "IN_PROGRESS", priority: "HIGH",
        anonymous: true, submitterId: null, submitterLabel: "anon_33d0a", assigneeId: "u-tom",
        createdAt: ago(5, 9),
        events: [
          ev({ type: "CREATED", actor: "anon_33d0a", at: ago(5, 9) }),
          ev({ type: "STATUS", actor: "Tom Okafor", at: ago(5, 4), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_INTERNAL", actor: "Tom Okafor", at: ago(5, 3), text: "Pattern matches two other signals this quarter. Will address in the leadership sync without revealing the source." }),
        ],
      },
      13
    ),
    T(
      {
        title: "SSO login fails on Safari 17",
        description:
          "Safari 17 users get a blank redirect after the IdP login. Chrome and Firefox work. Roughly a fifth of the design team is affected.",
        categoryId: "c-sw", departmentId: "d-it", status: "CLOSED", priority: "HIGH",
        submitterId: "u-noah", submitterLabel: "Noah Kim", assigneeId: "u-mei",
        createdAt: ago(48, 4), resolvedAt: ago(45, 1),
        rating: 5, ratingComment: "Verified on my machine — works again.", ratedAt: ago(44, 8),
        events: [
          ev({ type: "CREATED", actor: "Noah Kim", at: ago(48, 4) }),
          ev({ type: "ASSIGNED", actor: "Priya Nair", at: ago(48, 2), text: "Mei Lin" }),
          ev({ type: "STATUS", actor: "Mei Lin", at: ago(47, 5), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Mei Lin", at: ago(45, 2), text: "Root cause was a SameSite cookie attribute. Fixed at the IdP proxy; verified on Safari 17.2." }),
          ev({ type: "STATUS", actor: "Mei Lin", at: ago(45, 1), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "RATING", actor: "Noah Kim", at: ago(44, 8), from: "5", text: "Verified on my machine — works again." }),
          ev({ type: "STATUS", actor: "Noah Kim", at: ago(44, 7), from: "RESOLVED", to: "CLOSED" }),
        ],
      },
      14
    ),
    T(
      {
        title: "Idea: internal 'show & tell' newsletter for shipped work",
        description:
          "A bi-weekly, 5-minute-read newsletter where each team lists what shipped. Increases cross-team awareness and is cheap to run — happy to rotate editors.",
        categoryId: "c-camp", departmentId: "d-mkt", status: "IN_PROGRESS", priority: "LOW",
        anonymous: true, submitterId: null, submitterLabel: "anon_c44f9", assigneeId: "u-elena",
        createdAt: ago(15, 6),
        events: [
          ev({ type: "CREATED", actor: "anon_c44f9", at: ago(15, 6) }),
          ev({ type: "STATUS", actor: "Elena Cruz", at: ago(14, 4), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Elena Cruz", at: ago(14, 3), text: "Love it — piloting with the May issue. Will post the editor rota here." }),
        ],
      },
      15
    ),
    T(
      {
        title: "Visitor Wi-Fi password changed without notice",
        description:
          "The reception team prints the guest Wi-Fi password on cards. It changed silently last week and we handed out wrong cards for two days.",
        categoryId: "c-net", departmentId: "d-it", status: "CLOSED", priority: "MEDIUM",
        anonymous: true, submitterId: null, submitterLabel: "anon_58ab2", assigneeId: "u-jonas",
        createdAt: ago(27, 3), resolvedAt: ago(24, 6),
        rating: 4, ratingComment: "Advance cards solve it. Would still love an auto-expiry on old passwords.", ratedAt: ago(23, 10),
        events: [
          ev({ type: "CREATED", actor: "anon_58ab2", at: ago(27, 3) }),
          ev({ type: "ASSIGNED", actor: "Priya Nair", at: ago(27, 1), text: "Jonas Weber" }),
          ev({ type: "STATUS", actor: "Jonas Weber", at: ago(26, 4), from: "OPEN", to: "IN_PROGRESS" }),
          ev({ type: "REMARK_PUBLIC", actor: "Jonas Weber", at: ago(24, 7), text: "Rotation is now scheduled monthly and reception gets the new card PDF 48h in advance." }),
          ev({ type: "STATUS", actor: "Jonas Weber", at: ago(24, 6), from: "IN_PROGRESS", to: "RESOLVED" }),
          ev({ type: "RATING", actor: "anon_58ab2", at: ago(23, 10), from: "4", text: "Advance cards solve it. Would still love an auto-expiry on old passwords." }),
          ev({ type: "STATUS", actor: "anon_58ab2", at: ago(23, 9), from: "RESOLVED", to: "CLOSED" }),
        ],
      },
      16
    ),
  ];

  const keys = [
    { id: "k-1", key: "LW-DEMO-4821", type: "ONE_TIME" as const, note: "Town-hall feedback session", used: false, revoked: false, createdBy: "Ava Stone", createdAt: ago(6), lastUsedAt: null },
    { id: "k-2", key: "LW-SESSION-7710", type: "SESSION" as const, note: "Contractor kiosk — floor 1", used: false, revoked: false, createdBy: "Ava Stone", createdAt: ago(12), lastUsedAt: null },
    { id: "k-3", key: "LW-LEGACY-0099", type: "ONE_TIME" as const, note: "2024 survey (consumed)", used: true, revoked: false, createdBy: "Ava Stone", createdAt: ago(60), lastUsedAt: ago(58) },
    { id: "k-4", key: "LW-REVOKED-1337", type: "SESSION" as const, note: "Leaked in screenshot — revoked", used: false, revoked: true, createdBy: "Ava Stone", createdAt: ago(30), lastUsedAt: null },
  ];

  return {
    v: 1,
    seq: tickets.length,
    users,
    departments,
    categories,
    tickets,
    keys,
    flags: { portalOpen: true, anonymousSubmissions: true, attachments: true },
  };
}

// ─── persistence ──────────────────────────────────────────────────────────────

let cache: DB | null = null;

export function getDB(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.v === 1 && Array.isArray(parsed.tickets)) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* corrupted storage — reseed */
  }
  cache = seedDB();
  save();
  return cache;
}

function save() {
  if (cache) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(cache));
    } catch {
      /* quota exceeded — keep in-memory copy */
    }
  }
}

/** Run a mutation, persist, and return its result. */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = getDB();
  const result = fn(db);
  save();
  return result;
}

export function resetDB(): DB {
  localStorage.removeItem(DB_KEY);
  cache = seedDB();
  save();
  return cache;
}

// ─── session persistence ──────────────────────────────────────────────────────

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function persistSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function randomAlias(): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `anon_${s}`;
}
