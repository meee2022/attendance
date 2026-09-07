// ── Unified design tokens & helpers used across all pages ─────────────────

// Primary brand colors (must match index.css :root vars)
export const BRAND = {
    maroon: "#5C1523",
    maroonDark: "#4A0F1B",
    maroonLight: "#7A1E30",
    gold: "#C9A96E",
    cream: "#FCF9F2",
    ink: "#2A1418",
} as const;

export const BRAND_GRADIENT = "linear-gradient(135deg,#5C1523,#7A1E30)";

// ── Track colors (academic specialization) ────────────────────────────────
export const TRACK_COLORS: Record<string, string> = {
    "عام":       "#5C1523",
    "علمي":      "#1e40af",
    "أدبي":      "#f59e0b",
    "تكنولوجي":  "#7c3aed",
};

// ── Visitor role colors (supervision) ─────────────────────────────────────
export const ROLE_COLORS = {
    coordinator: "#5C1523",
    supervisor:  "#1e40af",
    deputy:      "#065f46",
} as const;

export const ROLE_LABELS = {
    coordinator: "المنسق",
    supervisor:  "الموجه",
    deputy:      "النائب الأكاديمي",
} as const;

// ── Domain colors (supervision criteria) ──────────────────────────────────
export const DOMAIN_COLORS = {
    planning:   "#3b82f6",
    execution:  "#10b981",
    evaluation: "#f59e0b",
    management: "#8b5cf6",
} as const;

export const DOMAIN_LABELS = {
    planning:   "التخطيط",
    execution:  "تنفيذ الدرس",
    evaluation: "التقويم",
    management: "الإدارة الصفية",
} as const;

// ── Status / score color logic ────────────────────────────────────────────
export function pctColor(p: number): string {
    if (p >= 0.8) return "#10b981";  // green - excellent
    if (p >= 0.6) return "#3b82f6";  // blue - good
    if (p >= 0.4) return "#f59e0b";  // amber - average
    return "#ef4444";                // red - needs work
}

// ── Grade formatting & parsing ────────────────────────────────────────────
export function formatGrade(v: any): string {
    if (v === undefined || v === null) return "";
    if (v === "absent") return "غ";
    if (v === "excused") return "م";
    return String(v);
}

export type GradeValue = number | "absent" | "excused" | null;

export function parseGradeInput(s: string, max?: number): GradeValue | { error: string } {
    const t = s.trim();
    if (!t) return null;
    if (t === "غ" || t === "غياب" || t.toLowerCase() === "a") return "absent";
    if (t === "م" || t === "معذور" || t.toLowerCase() === "e") return "excused";
    const n = Number(t);
    if (isNaN(n)) return { error: "قيمة غير صالحة" };
    if (n < 0) return { error: "لا يمكن أن تكون أقل من 0" };
    if (max !== undefined && n > max) return { error: `لا يمكن أن تتجاوز ${max}` };
    return n;
}

// ── Arabic-aware sort helper ──────────────────────────────────────────────
export function arSort(a: string, b: string): number {
    return a.localeCompare(b, "ar", { numeric: true });
}

// ── Class name comparison (natural numeric, e.g., 11-1 < 11-2 < 11-10) ────
export function classNameSort(a: { name: string; grade: number }, b: { name: string; grade: number }): number {
    return (a.grade - b.grade) || arSort(a.name, b.name);
}

// ── Format Arabic date ────────────────────────────────────────────────────
export function formatArDate(d: string | number | Date): string {
    const date = new Date(d);
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Initial letter for avatar ─────────────────────────────────────────────
export function getInitial(name: string | undefined): string {
    return (name ?? "?").trim().charAt(0) || "?";
}

// ── Status colors for absences ────────────────────────────────────────────
export const STATUS_STYLES = {
    absent:  { bg: "#fee2e2", border: "#fecaca", text: "#b91c1c", dot: "#ef4444" },
    excused: { bg: "#fef3c7", border: "#fde68a", text: "#b45309", dot: "#f59e0b" },
    present: { bg: "#d1fae5", border: "#a7f3d0", text: "#047857", dot: "#10b981" },
} as const;
