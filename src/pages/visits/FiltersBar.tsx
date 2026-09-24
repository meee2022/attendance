import { ROLE_LABELS, type VisitorRole } from "../../../convex/visitMath";
import type { Filters } from "../../lib/visitStats";

// The same filters on every view: period, department, visitor type, and — where
// it makes sense — a single teacher.

export function periodPresets(setup: any) {
    const today: string = setup.today;
    const monthStart = `${today.slice(0, 7)}-01`;
    const s = setup.settings;
    return [
        { key: "year", label: `العام ${s.academicYear}`, from: s.yearStart ?? "", to: s.yearEnd ?? "" },
        { key: "month", label: "هذا الشهر", from: monthStart, to: today },
        { key: "all", label: "كل الفترات", from: "", to: "" },
    ];
}

export default function FiltersBar({ setup, value, onChange, showTeacher = false }: {
    setup: any;
    value: Filters;
    onChange: (f: Filters) => void;
    showTeacher?: boolean;
}) {
    const presets = periodPresets(setup);
    const activePreset = presets.find(p => p.from === value.from && p.to === value.to)?.key ?? "custom";
    const teachers = setup.teachers.filter((t: any) => !value.department || t.department === value.department);

    const sel = "border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon";

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 flex-wrap">
                {presets.map(p => (
                    <button key={p.key} onClick={() => onChange({ ...value, from: p.from, to: p.to })}
                        aria-pressed={activePreset === p.key}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                            activePreset === p.key ? "bg-qatar-maroon text-white border-transparent"
                                                   : "bg-white text-slate-500 border-slate-200 hover:border-qatar-maroon"}`}>
                        {p.label}
                    </button>
                ))}
            </div>
            <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
                من <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })} className={sel}/>
            </label>
            <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
                إلى <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })} className={sel}/>
            </label>
            <select value={value.department} aria-label="القسم"
                onChange={e => onChange({ ...value, department: e.target.value, teacherId: "" })} className={sel}>
                <option value="">كل الأقسام</option>
                {setup.departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={value.role} aria-label="نوع الزائر"
                onChange={e => onChange({ ...value, role: e.target.value as VisitorRole | "" })} className={sel}>
                <option value="">كل الزائرين</option>
                {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {showTeacher && (
                <select value={value.teacherId} aria-label="المعلم"
                    onChange={e => onChange({ ...value, teacherId: e.target.value })} className={sel}>
                    <option value="">كل المعلمين</option>
                    {teachers.map((t: any) => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                </select>
            )}
        </div>
    );
}
