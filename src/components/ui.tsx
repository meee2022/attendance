import type { ReactNode } from "react";
import { BRAND_GRADIENT } from "../lib/brand";

// ── Compact page heading ─────────────────────────────────────
export function PageHeader({ icon, title, subtitle, badges, children }: {
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    badges?: ReactNode;
    children?: ReactNode;  // right side actions (tabs, etc.)
}) {
    return (
        <div dir="rtl" className="page-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-1">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-qatar-ink flex items-center gap-3">
                        {icon && <span className="page-heading-icon">{icon}</span>}
                        {title}
                    </h1>
                    {subtitle && <p className="text-qatar-gray-text font-normal text-xs mt-1.5">{subtitle}</p>}
                    {badges && <div className="flex gap-2 mt-2 text-qatar-gray-text text-xs font-bold flex-wrap items-center">{badges}</div>}
                </div>
                {children && <div className="flex gap-2 flex-wrap items-start">{children}</div>}
            </div>
        </div>
    );
}

// ── Header tab button (used inside PageHeader) ────────────────────────────
export function HeaderTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
    return (
        <button onClick={onClick} aria-pressed={!!active}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all border ${
                active
                    ? "bg-white text-qatar-maroon border-white shadow"
                    : "bg-white/10 text-white border-white/20 hover:bg-white/20"
            }`}>
            {children}
        </button>
    );
}

export function PageTabs<T extends string>({ label, items, active, onChange }: {
    label: string;
    items: { id: T; label: string; icon?: ReactNode }[];
    active: T;
    onChange: (id: T) => void;
}) {
    return <div className="workspace-tabs" role="group" aria-label={label}>
        {items.map(item => <button key={item.id} type="button" aria-pressed={active === item.id}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 ${active === item.id ? "bg-qatar-maroon text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {item.icon}{item.label}
        </button>)}
    </div>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────
export function KPICard({ label, value, icon, color = "#5C1523", subValue }: {
    label: string;
    value: string | number;
    icon?: ReactNode;
    color?: string;
    subValue?: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            {icon && <div className="mb-2 inline-flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: `${color}15`, color }}>{icon}</div>}
            <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs font-medium text-slate-600 mt-1">{label}</p>
            {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
        </div>
    );
}

// ── Card container ────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

export function CardHeader({ icon, title, count, right }: { icon?: ReactNode; title: string; count?: number | string; right?: ReactNode }) {
    return (
        <div dir="rtl" className="px-5 py-3 flex items-center justify-between gap-2 border-b border-slate-100"
            style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
            <div className="flex items-center gap-2">
                {count !== undefined && (
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{count}</span>
                )}
                {right}
            </div>
            <span className="font-black text-white text-sm flex items-center gap-2">
                {icon && <span className="text-white/60">{icon}</span>}
                {title}
            </span>
        </div>
    );
}

// ── Branded Card Header (burgundy) ────────────────────────────────────────
export function BrandedCardHeader({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
    return (
        <div dir="rtl" className="px-5 py-3 flex items-center justify-between gap-2"
            style={{ background: BRAND_GRADIENT }}>
            <div className="flex items-center gap-2">{right}</div>
            <span className="font-black text-white text-sm flex items-center gap-2">
                {icon && <span className="text-white/70">{icon}</span>}
                {title}
            </span>
        </div>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 flex flex-col items-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300">
                {icon}
            </div>
            <p className="font-black text-slate-700 text-base">{title}</p>
            {description && <p className="text-sm text-slate-500 font-normal max-w-md">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

// ── Loading Spinner (consistent everywhere) ───────────────────────────────
export function LoadingSpinner({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/>
            {label && <p className="text-sm font-bold text-slate-500">{label}</p>}
        </div>
    );
}

// ── Status Chip ───────────────────────────────────────────────────────────
export function StatusChip({ status, label }: { status: "success" | "warning" | "danger" | "neutral" | "info"; label: string }) {
    const styles = {
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        danger:  "bg-rose-50 text-rose-700 border-rose-200",
        neutral: "bg-slate-50 text-slate-700 border-slate-200",
        info:    "bg-blue-50 text-blue-700 border-blue-200",
    };
    const dots = {
        success: "bg-emerald-500",
        warning: "bg-amber-400",
        danger:  "bg-rose-500",
        neutral: "bg-slate-400",
        info:    "bg-blue-500",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border whitespace-nowrap ${styles[status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`}/>
            {label}
        </span>
    );
}

// ── Section Sub-Header (used inside cards) ────────────────────────────────
export function SectionTitle({ icon, title, count }: { icon?: ReactNode; title: string; count?: number }) {
    return (
        <div dir="rtl" className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500">
                {count !== undefined && `${count} · `}
            </span>
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                {icon}{title}
            </span>
        </div>
    );
}
