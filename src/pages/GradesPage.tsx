import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    GraduationCap, BookOpen, Layers, Save, Upload, Download, Printer,
    BarChart3, FileText, Search, ChevronLeft, ChevronRight, AlertCircle,
    CheckCircle2, Filter, Users, X, MessageSquare, RotateCcw, Plus,
} from "lucide-react";
import { Link } from "react-router-dom";

type GradeValue = number | "absent" | "excused" | null;

const TRACK_COLORS: Record<string, string> = {
    "عام": "#5C1A1B",
    "علمي": "#1e40af",
    "أدبي": "#f59e0b",
    "تكنولوجي": "#7c3aed",
};

function formatGrade(v: any): string {
    if (v === undefined || v === null) return "";
    if (v === "absent") return "غ";
    if (v === "excused") return "م";
    return String(v);
}

function parseInput(s: string, max?: number): GradeValue | { error: string } {
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

// Helper: parse but treat error/null both as null (used for local summary preview)
function cleanParse(s: string, max?: number): GradeValue {
    const r = parseInput(s, max);
    if (r && typeof r === "object" && "error" in r) return null;
    return r as GradeValue;
}

function calcSummary(g: any, max = 20, finalOutOf = 5) {
    const vals = ["a1", "a2", "a3", "a4", "a5"].map(k => g[k]);
    let sum = 0, cnt = 0;
    for (const v of vals) {
        if (typeof v === "number") { sum += v; cnt++; }
    }
    const totalMax = vals.length * max;
    const finalScore = totalMax > 0 ? (sum / totalMax) * finalOutOf : 0;
    return { sum, cnt, total: sum, finalScore, percent: totalMax > 0 ? sum / totalMax : 0 };
}

export default function GradesPage() {
    const settings = useQuery(api.grades.getSettings) as any;
    const meta = useQuery(api.grades.getClassesAndSubjects) as any;
    const allGrades = useQuery(api.grades.getAllGrades) as any[] | undefined;
    const [view, setView] = useState<"entry" | "student" | "class" | "analytics">("entry");

    if (!settings || !meta) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/></div>;

    const isEmpty = !allGrades || allGrades.length === 0;

    return (
        <div dir="rtl" className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg,#5C1A1B 0%,#7A2425 50%,#5C1A1B 100%)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-7">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <GraduationCap className="w-7 h-7 text-white/80"/>رصد الدرجات
                        </h1>
                        <p className="text-white/80 font-bold text-sm mt-1">
                            {settings.assessmentLabels?.length ?? 5} تقييمات لكل مادة · من {settings.maxPerAssessment} درجة
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { key: "entry" as const, label: "إدخال الدرجات", icon: <BookOpen className="w-4 h-4"/> },
                            { key: "student" as const, label: "بطاقة الطالب", icon: <Users className="w-4 h-4"/> },
                            { key: "class" as const, label: "ملف الفصل", icon: <Layers className="w-4 h-4"/> },
                            { key: "analytics" as const, label: "التحليل", icon: <BarChart3 className="w-4 h-4"/> },
                        ]).map(({ key, label, icon }) => (
                            <button key={key} onClick={() => setView(key)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                    view === key
                                        ? "bg-white text-qatar-maroon border-white shadow"
                                        : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                }`}>
                                {icon}{label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isEmpty ? (
                <ImportPrompt/>
            ) : (
                <>
                    {view === "entry" && <EntryView meta={meta} settings={settings}/>}
                    {view === "student" && <StudentView allGrades={allGrades} settings={settings}/>}
                    {view === "class" && <ClassView allGrades={allGrades} settings={settings} meta={meta}/>}
                    {view === "analytics" && <GradesAnalyticsView allGrades={allGrades} settings={settings}/>}
                </>
            )}
        </div>
    );
}

// ── Import Prompt ─────────────────────────────────────────────────────────
function ImportPrompt() {
    return (
        <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-qatar-maroon/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-qatar-maroon"/>
            </div>
            <div className="text-center">
                <p className="font-black text-slate-700 text-lg">لم يتم استيراد الدرجات بعد</p>
                <p className="text-sm text-slate-400 mt-1 max-w-md">يمكن استيراد بيانات الدرجات من الإعدادات → "إدارة الدرجات"</p>
            </div>
            <Link to="/settings"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-sm hover:opacity-90 qatar-card-shadow"
                style={{ background: "linear-gradient(135deg,#5C1A1B,#7A2425)" }}>
                <Plus className="w-4 h-4"/>الذهاب للإعدادات
            </Link>
        </div>
    );
}

// ── Entry View — Spreadsheet-like grade input ─────────────────────────────
function EntryView({ meta, settings }: { meta: any; settings: any }) {
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const grades = useQuery(api.grades.getGradesByClassSubject,
        selectedClass && selectedSubject ? { className: selectedClass, subjectName: selectedSubject } : "skip" as any
    ) as any[] | undefined;
    const upsert = useMutation(api.grades.upsertGrade);

    const classes = meta.classes ?? [];
    const selectedClassMeta = classes.find((c: any) => c.className === selectedClass);
    const trackKey = selectedClassMeta ? `${selectedClassMeta.grade}-${selectedClassMeta.track}` : "";
    const subjectsForClass = trackKey ? (meta.trackSubjects?.find((t: any) => t.trackKey === trackKey)?.subjects ?? []) : [];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">الفصل</label>
                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(""); }}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="">— اختر الفصل —</option>
                        {classes.map((c: any) => (
                            <option key={c.className} value={c.className}>
                                {c.className} ({c.track})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">المادة</label>
                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedClass}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon disabled:opacity-50">
                        <option value="">— اختر المادة —</option>
                        {subjectsForClass.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {selectedClass && selectedSubject && (
                <GradesGrid
                    grades={grades ?? []}
                    settings={settings}
                    classMeta={selectedClassMeta}
                    subjectName={selectedSubject}
                    onUpdate={async (data: any) => {
                        await upsert({
                            studentName: data.studentName,
                            className: selectedClass,
                            grade: selectedClassMeta.grade,
                            track: selectedClassMeta.track,
                            subjectName: selectedSubject,
                            ...data.values,
                        });
                    }}
                />
            )}
        </div>
    );
}

function GradesGrid({ grades, settings, classMeta, subjectName, onUpdate }: any) {
    const [search, setSearch] = useState("");
    const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
    const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
    const max = settings.maxPerAssessment;
    const finalOutOf = settings.finalScoreOutOf;
    const labels = settings.assessmentLabels;

    // Local edit buffer for fast typing
    const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});
    const [errorMap, setErrorMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const init: Record<string, Record<string, string>> = {};
        for (const g of grades) {
            init[g.studentName] = {
                a1: formatGrade(g.a1),
                a2: formatGrade(g.a2),
                a3: formatGrade(g.a3),
                a4: formatGrade(g.a4),
                a5: formatGrade(g.a5),
            };
        }
        setLocalValues(init);
    }, [grades]);

    const filtered = useMemo(() => {
        if (!search.trim()) return grades;
        return grades.filter((g: any) => g.studentName.includes(search.trim()));
    }, [grades, search]);

    const saveCell = async (studentName: string, which: string, val: string) => {
        const key = `${studentName}|${which}`;
        // Validate locally first
        const parsed = parseInput(val, max);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
            setErrorMap(p => ({ ...p, [key]: parsed.error }));
            setTimeout(() => setErrorMap(p => { const n = { ...p }; delete n[key]; return n; }), 2500);
            return;
        }
        setErrorMap(p => { const n = { ...p }; delete n[key]; return n; });
        setSavingMap(p => ({ ...p, [key]: true }));
        try {
            await onUpdate({
                studentName,
                values: { [which]: parsed },
            });
            setSavedMap(p => ({ ...p, [key]: true }));
            setTimeout(() => setSavedMap(p => ({ ...p, [key]: false })), 1500);
        } catch (e: any) {
            setErrorMap(p => ({ ...p, [key]: e.message ?? "خطأ في الحفظ" }));
            setTimeout(() => setErrorMap(p => { const n = { ...p }; delete n[key]; return n; }), 2500);
        } finally {
            setSavingMap(p => ({ ...p, [key]: false }));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIdx: number, fieldIdx: number) => {
        if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const next = e.shiftKey ? fieldIdx - 1 : fieldIdx + 1;
            if (next >= 0 && next < 5) {
                const target = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${studentIdx}-${next}"]`);
                target?.focus();
                target?.select();
            } else if (next === 5 && studentIdx < filtered.length - 1) {
                const target = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${studentIdx + 1}-0"]`);
                target?.focus();
                target?.select();
            }
        } else if (e.key === "ArrowDown" && studentIdx < filtered.length - 1) {
            e.preventDefault();
            const target = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${studentIdx + 1}-${fieldIdx}"]`);
            target?.focus();
            target?.select();
        } else if (e.key === "ArrowUp" && studentIdx > 0) {
            e.preventDefault();
            const target = document.querySelector<HTMLInputElement>(`input[data-grade-cell="${studentIdx - 1}-${fieldIdx}"]`);
            target?.focus();
            target?.select();
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap"
                style={{ background: `linear-gradient(135deg,${TRACK_COLORS[classMeta.track] || "#5C1A1B"},${TRACK_COLORS[classMeta.track] || "#5C1A1B"}dd)` }}>
                <div className="text-white">
                    <p className="font-black text-base">{subjectName}</p>
                    <p className="text-xs font-bold text-white/80">{classMeta.className} · {classMeta.track}</p>
                </div>
                <div className="text-[10px] text-white/80 font-bold flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-3 h-3"/>
                    من 0 إلى {max} · "غ" غياب · "م" معذور · Enter للانتقال
                </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
                <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن طالب..."
                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr>
                            <th className="px-2 py-2 text-center font-black text-slate-500 border-l border-slate-200 w-12">#</th>
                            <th className="sticky right-0 bg-slate-50 px-3 py-2 text-right font-black text-slate-700 border-l border-slate-200 min-w-[200px]">الاسم</th>
                            {labels.map((label: string, i: number) => (
                                <th key={i} className="px-1 py-2 text-center font-black text-slate-600 border-l border-slate-100 min-w-[55px]">
                                    {label}
                                </th>
                            ))}
                            <th className="px-2 py-2 text-center font-black text-qatar-maroon border-l border-slate-200">المجموع</th>
                            <th className="px-2 py-2 text-center font-black text-qatar-maroon">من {finalOutOf}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={9} className="text-center py-8 text-slate-400 font-bold text-sm">لا توجد بيانات لهذا الفصل في هذه المادة. ابدأ بالاستيراد من الإعدادات.</td></tr>
                        )}
                        {filtered.map((g: any, idx: number) => {
                            const summary = calcSummary({
                                a1: cleanParse(localValues[g.studentName]?.a1 ?? "", max),
                                a2: cleanParse(localValues[g.studentName]?.a2 ?? "", max),
                                a3: cleanParse(localValues[g.studentName]?.a3 ?? "", max),
                                a4: cleanParse(localValues[g.studentName]?.a4 ?? "", max),
                                a5: cleanParse(localValues[g.studentName]?.a5 ?? "", max),
                            }, max, finalOutOf);
                            const isPass = summary.finalScore >= settings.passThreshold;
                            const isExcellent = summary.finalScore >= settings.excellenceThreshold;
                            return (
                                <tr key={g._id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-2 py-1 text-center font-bold text-slate-400 border-l border-slate-100">{idx + 1}</td>
                                    <td className="sticky right-0 bg-white px-3 py-1 text-right font-bold text-slate-700 border-l border-slate-200 truncate max-w-[200px]">
                                        {g.studentName}
                                    </td>
                                    {(["a1", "a2", "a3", "a4", "a5"] as const).map((field, fieldIdx) => {
                                        const cellKey = `${g.studentName}|${field}`;
                                        const isSaving = savingMap[cellKey];
                                        const isSaved = savedMap[cellKey];
                                        const errorMsg = errorMap[cellKey];
                                        const value = localValues[g.studentName]?.[field] ?? "";
                                        return (
                                            <td key={field} className="border-l border-slate-50 p-0.5">
                                                <div className="relative" title={errorMsg || ""}>
                                                    <input
                                                        data-grade-cell={`${idx}-${fieldIdx}`}
                                                        value={value}
                                                        onChange={e => setLocalValues(p => ({ ...p, [g.studentName]: { ...p[g.studentName], [field]: e.target.value } }))}
                                                        onBlur={e => {
                                                            const original = formatGrade(g[field]);
                                                            if (e.target.value !== original) {
                                                                saveCell(g.studentName, field, e.target.value);
                                                            }
                                                        }}
                                                        onKeyDown={e => handleKeyDown(e, idx, fieldIdx)}
                                                        className={`w-full px-1 py-1.5 text-center text-xs font-black bg-transparent focus:outline-none rounded transition-all ${
                                                            errorMsg ? "bg-rose-50 ring-2 ring-rose-400 text-rose-600" :
                                                            value === "غ" ? "text-rose-500" : value === "م" ? "text-amber-500" : "text-slate-700"
                                                        } ${!errorMsg ? "focus:bg-white focus:ring-2 focus:ring-qatar-maroon/30" : ""}`}
                                                    />
                                                    {errorMsg && <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-rose-500"/>}
                                                    {isSaving && !errorMsg && <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>}
                                                    {isSaved && !isSaving && !errorMsg && <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-emerald-500"/>}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-2 py-1 text-center font-black text-slate-700 border-l border-slate-200 text-[11px]">
                                        {summary.cnt > 0 ? summary.total : "—"}
                                    </td>
                                    <td className="px-2 py-1 text-center font-black border-l border-slate-100 text-[11px]"
                                        style={{ color: summary.cnt === 0 ? "#94a3b8" : isExcellent ? "#10b981" : isPass ? "#3b82f6" : "#ef4444" }}>
                                        {summary.cnt > 0 ? summary.finalScore.toFixed(2) : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Student Card View ─────────────────────────────────────────────────────
function StudentView({ allGrades, settings }: any) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string>("");
    const guardianPhone = useQuery(api.grades.getGuardianPhone, selected ? { studentName: selected } : "skip" as any);

    const students = useMemo(() => {
        const set = new Set<string>();
        for (const g of allGrades ?? []) set.add(g.studentName);
        return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
    }, [allGrades]);

    const filtered = students.filter(s => !search.trim() || s.includes(search.trim()));

    if (!selected) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن طالب..."
                            className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                    </div>
                </div>
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                    {filtered.map(s => {
                        const studentGrades = allGrades.filter((g: any) => g.studentName === s);
                        const subjects = studentGrades.length;
                        const avg = subjects > 0 ? studentGrades.reduce((a: number, g: any) => a + calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf).finalScore, 0) / subjects : 0;
                        const cls = studentGrades[0]?.className;
                        return (
                            <button key={s} onClick={() => setSelected(s)}
                                className="w-full text-right px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2">
                                <span className="text-base font-black flex-shrink-0" style={{ color: avg >= settings.excellenceThreshold ? "#10b981" : avg >= settings.passThreshold ? "#3b82f6" : "#ef4444" }}>
                                    {avg.toFixed(2)}
                                </span>
                                <div className="text-right flex-1 min-w-0">
                                    <p className="font-black text-slate-700 text-sm truncate">{s}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{cls} · {subjects} مادة</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    const studentGrades = allGrades.filter((g: any) => g.studentName === selected);
    const cls = studentGrades[0]?.className;
    const overallAvg = studentGrades.length > 0
        ? studentGrades.reduce((a: number, g: any) => a + calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf).finalScore, 0) / studentGrades.length
        : 0;

    const buildWhatsApp = () => {
        if (!guardianPhone) {
            alert("لا يوجد رقم ولي أمر مسجّل لهذا الطالب");
            return;
        }
        const lines = [
            `السلام عليكم، ولي أمر الطالب: *${selected}*`,
            `الفصل: ${cls}`,
            `المعدل العام: *${overallAvg.toFixed(2)} / ${settings.finalScoreOutOf}*`,
            `\nالدرجات حسب المواد:`,
            ...studentGrades.map((g: any) => {
                const s = calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf);
                return `▪️ ${g.subjectName}: ${s.finalScore.toFixed(2)} / ${settings.finalScoreOutOf}`;
            }),
            `\nمدرسة ابن تيمية الثانوية للبنين`,
        ].join("\n");
        const phone = guardianPhone.replace(/[^\d]/g, "");
        const url = `https://wa.me/${phone.startsWith("974") ? phone : "974" + phone}?text=${encodeURIComponent(lines)}`;
        window.open(url, "_blank");
    };

    return (
        <div className="space-y-4">
            <div className="bg-qatar-maroon rounded-2xl px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
                <button onClick={() => setSelected("")} className="text-white/80 hover:text-white text-sm font-black flex items-center gap-1">
                    <ChevronRight className="w-4 h-4"/>قائمة الطلاب
                </button>
                <div className="text-right flex-1">
                    <p className="font-black text-white text-base">{selected}</p>
                    <p className="text-white/70 text-xs font-bold">{cls} · {studentGrades.length} مادة</p>
                </div>
                <div className="flex gap-2">
                    {guardianPhone && (
                        <button onClick={buildWhatsApp}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600">
                            <MessageSquare className="w-3.5 h-3.5"/>WhatsApp
                        </button>
                    )}
                    <button onClick={() => window.open(`/grades/print/student/${encodeURIComponent(selected)}`, "_blank")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-black hover:bg-white/25">
                        <Printer className="w-3.5 h-3.5"/>طباعة
                    </button>
                </div>
            </div>

            {/* Overall card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-xs font-black text-slate-500 mb-1">المعدل العام</p>
                <p className="text-5xl font-black" style={{ color: overallAvg >= settings.excellenceThreshold ? "#10b981" : overallAvg >= settings.passThreshold ? "#3b82f6" : "#ef4444" }}>
                    {overallAvg.toFixed(2)}
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">من {settings.finalScoreOutOf}</p>
            </div>

            {/* Subjects table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="font-black text-slate-700 text-sm">الدرجات حسب المواد</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-right font-black text-slate-500">المادة</th>
                                {settings.assessmentLabels.map((l: string, i: number) => (
                                    <th key={i} className="px-2 py-2 text-center font-black text-slate-500">{l}</th>
                                ))}
                                <th className="px-2 py-2 text-center font-black text-qatar-maroon">المجموع</th>
                                <th className="px-2 py-2 text-center font-black text-qatar-maroon">من {settings.finalScoreOutOf}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentGrades.sort((a: any, b: any) => a.subjectName.localeCompare(b.subjectName, "ar")).map((g: any) => {
                                const s = calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf);
                                const isPass = s.finalScore >= settings.passThreshold;
                                const isExcellent = s.finalScore >= settings.excellenceThreshold;
                                return (
                                    <tr key={g._id} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-right font-black text-slate-700">{g.subjectName}</td>
                                        {(["a1", "a2", "a3", "a4", "a5"] as const).map(field => (
                                            <td key={field} className="px-2 py-2 text-center font-bold text-slate-600">
                                                {formatGrade(g[field]) || "—"}
                                            </td>
                                        ))}
                                        <td className="px-2 py-2 text-center font-black text-slate-700">{s.cnt > 0 ? s.total : "—"}</td>
                                        <td className="px-2 py-2 text-center font-black"
                                            style={{ color: s.cnt === 0 ? "#94a3b8" : isExcellent ? "#10b981" : isPass ? "#3b82f6" : "#ef4444" }}>
                                            {s.cnt > 0 ? s.finalScore.toFixed(2) : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Class View ────────────────────────────────────────────────────────────
function ClassView({ allGrades, settings, meta }: any) {
    const [selectedClass, setSelectedClass] = useState<string>("");
    const classes = meta.classes ?? [];

    if (!selectedClass) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-black text-slate-500 mb-3">اختر فصلاً</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {classes.map((c: any) => (
                        <button key={c.className} onClick={() => setSelectedClass(c.className)}
                            className="p-3 rounded-xl border-2 transition-all hover:border-qatar-maroon hover:bg-rose-50 text-center"
                            style={{ borderColor: TRACK_COLORS[c.track] + "40" }}>
                            <p className="font-black text-slate-700 text-sm">{c.className}</p>
                            <p className="text-[10px] font-bold mt-0.5" style={{ color: TRACK_COLORS[c.track] }}>{c.track}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const classGrades = allGrades.filter((g: any) => g.className === selectedClass);
    const students = Array.from(new Set(classGrades.map((g: any) => g.studentName))).sort((a, b) => (a as string).localeCompare(b as string, "ar"));
    const subjects = Array.from(new Set(classGrades.map((g: any) => g.subjectName))).sort();

    return (
        <div className="space-y-4">
            <div className="bg-qatar-maroon rounded-2xl px-5 py-3.5 flex items-center justify-between">
                <button onClick={() => setSelectedClass("")} className="text-white/80 hover:text-white text-sm font-black flex items-center gap-1">
                    <ChevronRight className="w-4 h-4"/>الفصول
                </button>
                <p className="font-black text-white text-base">فصل {selectedClass}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr>
                                <th className="sticky right-0 bg-slate-50 px-3 py-2 text-right font-black text-slate-700 border-l border-slate-200 min-w-[180px]">الطالب</th>
                                {subjects.map(s => (
                                    <th key={s as string} className="px-2 py-2 text-center font-black text-slate-600 border-l border-slate-100 min-w-[80px]">
                                        <span className="truncate block max-w-[80px]" title={s as string}>{(s as string).slice(0, 10)}</span>
                                    </th>
                                ))}
                                <th className="px-2 py-2 text-center font-black text-qatar-maroon">المعدل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((stud) => {
                                const sName = stud as string;
                                let sumF = 0, cntF = 0;
                                const cells = subjects.map(sub => {
                                    const g = classGrades.find((x: any) => x.studentName === sName && x.subjectName === sub);
                                    if (!g) return { f: null };
                                    const s = calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf);
                                    if (s.cnt > 0) { sumF += s.finalScore; cntF++; }
                                    return { f: s.cnt > 0 ? s.finalScore : null };
                                });
                                const avg = cntF > 0 ? sumF / cntF : 0;
                                return (
                                    <tr key={sName} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="sticky right-0 bg-white px-3 py-1.5 text-right font-bold text-slate-700 border-l border-slate-200 truncate max-w-[180px]">{sName}</td>
                                        {cells.map((cell, i) => (
                                            <td key={i} className="px-2 py-1.5 text-center font-black border-l border-slate-50"
                                                style={{ color: cell.f === null ? "#cbd5e1" : cell.f >= settings.excellenceThreshold ? "#10b981" : cell.f >= settings.passThreshold ? "#3b82f6" : "#ef4444" }}>
                                                {cell.f === null ? "—" : cell.f.toFixed(2)}
                                            </td>
                                        ))}
                                        <td className="px-2 py-1.5 text-center font-black border-l border-slate-100"
                                            style={{ color: cntF === 0 ? "#94a3b8" : avg >= settings.excellenceThreshold ? "#10b981" : avg >= settings.passThreshold ? "#3b82f6" : "#ef4444" }}>
                                            {cntF > 0 ? avg.toFixed(2) : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Analytics View ────────────────────────────────────────────────────────
function GradesAnalyticsView({ allGrades, settings }: any) {
    // Per-subject averages
    const bySubject: Record<string, { sum: number; cnt: number }> = {};
    const byClass: Record<string, { sum: number; cnt: number }> = {};
    let totalSum = 0, totalCnt = 0;
    let absentCount = 0, excusedCount = 0, gradedCount = 0;
    let excellent = 0, pass = 0, fail = 0;

    for (const g of allGrades) {
        for (const k of ["a1", "a2", "a3", "a4", "a5"] as const) {
            const v = g[k];
            if (typeof v === "number") gradedCount++;
            else if (v === "absent") absentCount++;
            else if (v === "excused") excusedCount++;
        }
        const s = calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf);
        if (s.cnt > 0) {
            if (!bySubject[g.subjectName]) bySubject[g.subjectName] = { sum: 0, cnt: 0 };
            bySubject[g.subjectName].sum += s.finalScore; bySubject[g.subjectName].cnt++;
            if (!byClass[g.className]) byClass[g.className] = { sum: 0, cnt: 0 };
            byClass[g.className].sum += s.finalScore; byClass[g.className].cnt++;
            totalSum += s.finalScore; totalCnt++;
            if (s.finalScore >= settings.excellenceThreshold) excellent++;
            else if (s.finalScore >= settings.passThreshold) pass++;
            else fail++;
        }
    }

    const subjectStats = Object.entries(bySubject).map(([k, v]) => ({ name: k, avg: v.sum / v.cnt, cnt: v.cnt })).sort((a, b) => b.avg - a.avg);
    const classStats = Object.entries(byClass).map(([k, v]) => ({ name: k, avg: v.sum / v.cnt, cnt: v.cnt })).sort((a, b) => b.avg - a.avg);
    const overallAvg = totalCnt > 0 ? totalSum / totalCnt : 0;

    const HBar = ({ label, value, max, color, total }: any) => (
        <div>
            <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] font-bold text-slate-700 truncate flex-1">{label}</span>
                <span className="text-[11px] font-black flex-shrink-0" style={{ color }}>
                    {value.toFixed(2)}{total && <span className="text-slate-400 mr-1 font-bold">{total}</span>}
                </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(value / max) * 100}%`, background: color }}/>
            </div>
        </div>
    );

    const pctColor = (avg: number) => avg >= settings.excellenceThreshold ? "#10b981" : avg >= settings.passThreshold ? "#3b82f6" : "#ef4444";

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] font-black text-slate-400">المعدل العام</p>
                    <p className="text-2xl font-black" style={{ color: pctColor(overallAvg) }}>{overallAvg.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-slate-400">من {settings.finalScoreOutOf}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] font-black text-slate-400">متميزون</p>
                    <p className="text-2xl font-black text-emerald-600">{excellent}</p>
                    <p className="text-[10px] font-bold text-slate-400">{totalCnt > 0 ? Math.round(excellent / totalCnt * 100) : 0}%</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] font-black text-slate-400">ناجحون</p>
                    <p className="text-2xl font-black text-blue-600">{pass}</p>
                    <p className="text-[10px] font-bold text-slate-400">{totalCnt > 0 ? Math.round(pass / totalCnt * 100) : 0}%</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <p className="text-[10px] font-black text-slate-400">دون النجاح</p>
                    <p className="text-2xl font-black text-rose-600">{fail}</p>
                    <p className="text-[10px] font-bold text-slate-400">{totalCnt > 0 ? Math.round(fail / totalCnt * 100) : 0}%</p>
                </div>
            </div>

            {/* Subjects ranking */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{subjectStats.length}</span>
                    <span className="font-black text-white text-sm">ترتيب المواد حسب المعدل</span>
                </div>
                <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
                    {subjectStats.map(s => <HBar key={s.name} label={s.name} value={s.avg} max={settings.finalScoreOutOf} color={pctColor(s.avg)} total={` · ${s.cnt} طالب`}/>)}
                </div>
            </div>

            {/* Classes ranking */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{classStats.length}</span>
                    <span className="font-black text-white text-sm">ترتيب الفصول</span>
                </div>
                <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
                    {classStats.map(c => <HBar key={c.name} label={`فصل ${c.name}`} value={c.avg} max={settings.finalScoreOutOf} color={pctColor(c.avg)} total={` · ${c.cnt} مادة`}/>)}
                </div>
            </div>

            {/* Activity stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-emerald-600">{gradedCount}</p>
                    <p className="text-[10px] font-bold text-emerald-700 mt-1">درجة مرصودة</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-rose-600">{absentCount}</p>
                    <p className="text-[10px] font-bold text-rose-700 mt-1">غياب</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-black text-amber-600">{excusedCount}</p>
                    <p className="text-[10px] font-bold text-amber-700 mt-1">معذور</p>
                </div>
            </div>
        </div>
    );
}
