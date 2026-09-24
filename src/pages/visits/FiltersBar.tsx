import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { ROLE_LABELS, type VisitorRole } from "../../../convex/visitMath";
import type { Filters } from "../../lib/visitStats";

// The same filters on every view, kept to one line: the period as three
// choices (a custom range only when asked for), the department when the
// visitor has more than one, the visitor type, and — where it makes sense — a
// single teacher.

export function periodPresets(setup: any) {
    const today: string = setup.today;
    const s = setup.settings;
    return [
        { key: "year", label: "العام الحالي", from: s.yearStart ?? "", to: s.yearEnd ?? "" },
        { key: "month", label: "هذا الشهر", from: `${today.slice(0, 7)}-01`, to: today },
        { key: "all", label: "الكل", from: "", to: "" },
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
    const [custom, setCustom] = useState(activePreset === "custom");
    const teachers = setup.teachers.filter((t: any) => !value.department || t.department === value.department);
    const manyDepartments = setup.departments.length > 1;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1 p-1 rounded-xl bg-slate-100" role="group" aria-label="الفترة">
                    {presets.map(p => (
                        <button key={p.key} aria-pressed={!custom && activePreset === p.key}
                            onClick={() => { setCustom(false); onChange({ ...value, from: p.from, to: p.to }); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                !custom && activePreset === p.key ? "bg-white text-qatar-maroon shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                            {p.label}
                        </button>
                    ))}
                    <button aria-pressed={custom} onClick={() => setCustom(c => !c)} title="فترة مخصصة"
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold ${custom ? "bg-white text-qatar-maroon shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        <CalendarRange className="w-4 h-4"/>
                    </button>
                </div>

                {manyDepartments && (
                    <select value={value.department} aria-label="القسم"
                        onChange={e => onChange({ ...value, department: e.target.value, teacherId: "" })}
                        className="px-3 text-sm min-w-[170px]">
                        <option value="">كل الأقسام</option>
                        {setup.departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
                    </select>
                )}
                <select value={value.role} aria-label="نوع الزائر"
                    onChange={e => onChange({ ...value, role: e.target.value as VisitorRole | "" })}
                    className="px-3 text-sm">
                    <option value="">كل الزائرين</option>
                    {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                {showTeacher && (
                    <select value={value.teacherId} aria-label="المعلم"
                        onChange={e => onChange({ ...value, teacherId: e.target.value })}
                        className="px-3 text-sm min-w-[200px]">
                        <option value="">كل المعلمين</option>
                        {teachers.map((t: any) => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                    </select>
                )}
            </div>

            {custom && (
                <div className="flex flex-wrap gap-3 items-center text-xs font-bold text-slate-500">
                    <label className="flex items-center gap-2">من
                        <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"/>
                    </label>
                    <label className="flex items-center gap-2">إلى
                        <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"/>
                    </label>
                </div>
            )}
        </div>
    );
}
