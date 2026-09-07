import { PageTabs } from "../components/ui";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    FlaskConical, Mic, Headphones, Search, Users, MessageSquare, Phone,
    Filter, FileText, Layers, ChevronRight, UserX, UserCheck, Sparkles,
    AlertCircle, Trash2, Activity, BookOpen, CheckCircle2, Printer, Download,
} from "lucide-react";

// Category style mapping (icon + color)
function categoryStyle(cat: string): { icon: any; color: string; light: string } {
    const c = cat.trim();
    if (c.includes("عمل") || c.toLowerCase().includes("practical")) return { icon: FlaskConical, color: "#5C1523", light: "#FBE9EC" };
    if (c.includes("شفو") || c.toLowerCase().includes("oral")) return { icon: Mic, color: "#1e40af", light: "#DBEAFE" };
    if (c.includes("بدني") || c.toLowerCase().includes("physical") || c.toLowerCase().includes("pe")) return { icon: Activity, color: "#ea580c", light: "#FED7AA" };
    if (c.includes("استماع") || c.toLowerCase().includes("listen")) return { icon: Headphones, color: "#065f46", light: "#D1FAE5" };
    if (c.includes("مهارات") || c.toLowerCase().includes("skill")) return { icon: Sparkles, color: "#7c3aed", light: "#EDE9FE" };
    return { icon: BookOpen, color: "#64748b", light: "#E2E8F0" };
}

const TRACK_COLORS: Record<string, string> = {
    "عام": "#5C1523",
    "علمي": "#1e40af",
    "أدبي": "#f59e0b",
    "تكنولوجي": "#7c3aed",
};

// ── Print / Export helpers ────────────────────────────────────────────────
function printAbsences(rows: any[], filters: { category: string; subject: string; className: string }) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-EG", { dateStyle: "long" });
    const timeStr = now.toLocaleTimeString("ar-EG", { timeStyle: "short" });

    const filterChips: string[] = [];
    if (filters.category !== "all") filterChips.push(`الفئة: ${filters.category}`);
    if (filters.subject !== "all") filterChips.push(`المادة: ${filters.subject}`);
    if (filters.className !== "all") filterChips.push(`الفصل: ${filters.className}`);

    const total = rows.length;
    const noExcuse = rows.filter(r => r.status === "absent").length;
    const excused = rows.filter(r => r.status === "excused").length;
    const uniqueStudents = new Set(rows.map(r => r.studentName)).size;

    // Group by class for clearer printout
    const byClass: Record<string, any[]> = {};
    for (const r of rows) {
        const k = r.className ?? "—";
        if (!byClass[k]) byClass[k] = [];
        byClass[k].push(r);
    }

    const escape = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>قائمة الغائبين - ${dateStr}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400..900&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 12mm; }
@media print { .no-print { display: none !important; } }
* { box-sizing: border-box; }
body { font-family: 'Cairo', 'Tahoma', sans-serif; background: white; color: #1e293b; max-width: 210mm; margin: 0 auto; padding: 8mm; font-size: 11px; direction: rtl; }
h1 { font-size: 20px; margin: 0; font-weight: 900; color: #5C1523; }
h2 { font-size: 13px; margin: 12px 0 6px; font-weight: 900; padding: 6px 10px; border-radius: 6px; background: #5C1523; color: white; }
.header { text-align: center; border-bottom: 2px solid #5C1523; padding-bottom: 8px; margin-bottom: 10px; }
.sub { margin: 2px 0 0; font-size: 10px; color: #64748b; font-weight: 700; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
.kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; }
.kpi b { display: block; font-size: 22px; font-weight: 900; }
.kpi span { font-size: 9px; color: #64748b; }
.filters { background: #f1f5f9; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 10px; font-weight: 700; color: #475569; }
.filters .chip { display: inline-block; background: white; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; margin-left: 4px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
th { background: #f1f5f9; font-weight: 900; font-size: 10px; }
.cls-header td { background: #5C1523; color: white; font-weight: 900; font-size: 11px; text-align: center; }
.status-excused { color: #f59e0b; font-weight: 900; }
.status-absent { color: #dc2626; font-weight: 900; }
.cat-badge { display: inline-block; background: #5C1523; color: white; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 900; }
.footer { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sig { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; min-height: 60px; }
.print-btn { background: #5C1523; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 900; cursor: pointer; font-family: inherit; font-size: 12px; }
</style>
</head>
<body>

<div class="header">
    <h1>قائمة الغائبين عن الاختبارات العملية والشفوية</h1>
    <p class="sub">مدرسة ابن تيمية الثانوية للبنين · ${dateStr} · ${timeStr}</p>
</div>

<div class="kpis">
    <div class="kpi"><b style="color:#5C1523">${total}</b><span>إجمالي الغياب</span></div>
    <div class="kpi"><b style="color:#dc2626">${noExcuse}</b><span>بدون عذر</span></div>
    <div class="kpi"><b style="color:#f59e0b">${excused}</b><span>بعذر</span></div>
    <div class="kpi"><b style="color:#1e40af">${uniqueStudents}</b><span>عدد الطلاب</span></div>
</div>

${filterChips.length > 0 ? `<div class="filters">التصفية: ${filterChips.map(c => `<span class="chip">${escape(c)}</span>`).join("")}</div>` : ""}

${Object.keys(byClass).length === 0 ? `<p style="text-align:center;padding:20px;color:#94a3b8">لا توجد بيانات</p>` :
    Object.entries(byClass).map(([cls, list]) => {
        // Group by student within class
        const byStudent: Record<string, any[]> = {};
        for (const r of list) {
            if (!byStudent[r.studentName]) byStudent[r.studentName] = [];
            byStudent[r.studentName].push(r);
        }
        return `
    <h2>الفصل: ${escape(cls)} — ${Object.keys(byStudent).length} طالب · ${list.length} غياب</h2>
    <table>
        <thead>
            <tr>
                <th style="width:5%">#</th>
                <th style="width:35%">اسم الطالب</th>
                <th style="width:45%">المواد الغائب عنها</th>
                <th style="width:15%">رقم ولي الأمر</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(byStudent).map(([name, recs], i) => `
                <tr>
                    <td style="text-align:center;font-weight:900">${i + 1}</td>
                    <td style="font-weight:700">${escape(name)}</td>
                    <td>
                        ${recs.map(r => `<span style="display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;padding:2px 6px;border-radius:4px;margin:1px;font-size:10px;font-weight:700;${r.status === "excused" ? "color:#d97706" : "color:#dc2626"}">${escape(r.subject ?? r.category ?? "—")}${r.status === "excused" ? " (عذر)" : ""}</span>`).join("")}
                    </td>
                    <td style="text-align:center;font-size:10px" dir="ltr">${escape(recs[0].guardianPhone ?? "—")}</td>
                </tr>
            `).join("")}
        </tbody>
    </table>
    `;
    }).join("")
}

<div class="footer">
    <div class="sig">
        <p style="margin:0;font-weight:900">توقيع المعلم/المنسق</p>
    </div>
    <div class="sig">
        <p style="margin:0;font-weight:900">توقيع الإدارة</p>
    </div>
</div>

<div class="no-print" style="margin-top:20px;text-align:center">
    <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
</div>

<script>setTimeout(() => window.print(), 600);</script>

</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
        alert("اسمح بالنوافذ المنبثقة في المتصفح");
        return;
    }
    w.document.write(html);
    w.document.close();
}

function exportAbsencesCSV(rows: any[]) {
    const header = ["اسم الطالب", "الفصل", "المادة", "الفئة", "الحالة", "التاريخ", "رقم ولي الأمر"];
    const escape = (s: any) => {
        const v = String(s ?? "").replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
        lines.push([
            r.studentName,
            r.className,
            r.subject ?? "—",
            r.category ?? "—",
            r.status === "excused" ? "بعذر" : "غائب",
            new Date(r.markedAt).toLocaleDateString("ar-EG"),
            r.guardianPhone ?? "",
        ].map(escape).join(","));
    }
    // BOM for Excel Arabic compatibility
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `قائمة-الغائبين-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

type View = "classes" | "roster" | "report";

type SubjectMeta = { subject: string; category: string };

export default function PracticalExamsPage() {
    const [view, setView] = useState<View>("classes");
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const settings = useQuery(api.practicalExams.getSettings) as any;
    const classes = useQuery(api.practicalExams.getClassesWithStats) as any[] | undefined;

    const subjects: SubjectMeta[] = settings?.subjects ?? [];
    // Group subjects by category (must be before any early return)
    const byCategory = useMemo(() => {
        const map: Record<string, SubjectMeta[]> = {};
        for (const s of subjects) {
            if (!map[s.category]) map[s.category] = [];
            map[s.category].push(s);
        }
        return map;
    }, [subjects]);

    if (!settings) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/></div>;

    return (
        <div dir="rtl" className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-7">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <FlaskConical className="w-7 h-7 text-white/80"/>الاختبارات العملية والشفوية
                        </h1>
                        <p className="text-white/80 font-bold text-sm mt-1">رصد غياب الطلاب · اختر فصلاً ثم مادة ثم علّم الغائبين</p>
                        <div className="flex gap-2 mt-2 text-white/70 text-xs font-bold flex-wrap items-center">
                            {Object.keys(byCategory).map(cat => {
                                const st = categoryStyle(cat);
                                const Icon = st.icon;
                                return (
                                    <span key={cat} className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-full">
                                        <Icon className="w-3 h-3"/>{cat} ({byCategory[cat].length})
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            <PageTabs label="طرق عرض الاختبارات" active={view}
                items={[
                    { id: "classes" as const, label: "الفصول", icon: <Layers className="w-4 h-4"/> },
                    { id: "report" as const, label: "قائمة الغائبين", icon: <FileText className="w-4 h-4"/> },
                ]}
                onChange={next => { setView(next); setSelectedClass(null); }}/>

            {selectedClass ? (
                <RosterView className={selectedClass} subjects={subjects} byCategory={byCategory} onBack={() => setSelectedClass(null)}/>
            ) : view === "classes" ? (
                <ClassesGrid classes={classes ?? []} onSelect={setSelectedClass}/>
            ) : (
                <AbsencesReport subjects={subjects} byCategory={byCategory} template={settings.template}/>
            )}
        </div>
    );
}

// ── Classes Grid ──────────────────────────────────────────────────────────
function ClassesGrid({ classes, onSelect }: { classes: any[]; onSelect: (n: string) => void }) {
    const [filterGrade, setFilterGrade] = useState<number | "all">("all");
    const [search, setSearch] = useState("");

    const grades = Array.from(new Set(classes.map(c => c.grade))).sort();
    const filtered = classes
        .filter(c => filterGrade === "all" || c.grade === filterGrade)
        .filter(c => !search.trim() || c.name.includes(search.trim()))
        .sort((a, b) => (a.grade - b.grade) || a.name.localeCompare(b.name, "ar", { numeric: true }));

    if (classes.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3">
                <Layers className="w-12 h-12 text-slate-200"/>
                <p className="font-black text-slate-400">لا توجد فصول</p>
                <p className="text-xs text-slate-300 font-bold">أضف الفصول من الإعدادات → "الإعدادات العامة"</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400">{filtered.length}/{classes.length}</span>
                    <span className="text-xs font-black text-slate-600 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/>اختر الفصل</span>
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilterGrade("all")}
                        className={`px-3 py-1 rounded-lg text-xs font-black border ${filterGrade === "all" ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                        الكل
                    </button>
                    {grades.map(g => (
                        <button key={g} onClick={() => setFilterGrade(g)}
                            className={`px-3 py-1 rounded-lg text-xs font-black border ${filterGrade === g ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                            {g === 10 ? "عاشر" : g === 11 ? "حادي عشر" : g === 12 ? "ثاني عشر" : g}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map(c => {
                    const trackColor = TRACK_COLORS[c.track || "عام"] || "#5C1523";
                    return (
                        <button key={c._id} onClick={() => onSelect(c.name)}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-qatar-maroon/40 transition-all text-right group">
                            <div className="h-1.5" style={{ background: trackColor }}/>
                            <div className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: trackColor }}>
                                        {c.track || "عام"}
                                    </span>
                                    <p className="font-black text-slate-800 text-base">{c.name}</p>
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                                    <span className="text-rose-600 flex items-center gap-1">
                                        <UserX className="w-3 h-3"/>{c.absenceCount}
                                    </span>
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Users className="w-3 h-3"/>{c.totalStudents}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Roster View ───────────────────────────────────────────────────────────
function RosterView({ className, subjects, byCategory, onBack }: {
    className: string;
    subjects: SubjectMeta[];
    byCategory: Record<string, SubjectMeta[]>;
    onBack: () => void;
}) {
    const data = useQuery(api.practicalExams.getClassRoster, { className }) as any;
    const toggleAbsence = useMutation(api.practicalExams.toggleAbsence);
    const clearSubject = useMutation(api.practicalExams.clearAbsencesForSubject);

    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<SubjectMeta | null>(subjects[0] ?? null);

    // Build lookup: studentName → subject → absence record
    const absMap = useMemo(() => {
        const m = new Map<string, Map<string, any>>();
        const list = data?.absences ?? [];
        for (const a of list) {
            if (!m.has(a.studentName)) m.set(a.studentName, new Map());
            m.get(a.studentName)!.set(a.subject, a);
        }
        return m;
    }, [data?.absences]);

    if (!data) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;
    if (!data.classMeta) return <div className="text-center py-10 text-slate-400 font-bold">الفصل غير موجود</div>;

    const { classMeta, students, absences } = data;

    const filteredStudents = students.filter((s: any) =>
        !search.trim() || s.fullName.includes(search.trim())
    );

    const handleToggle = async (student: any, status: "absent" | "excused") => {
        if (!selected) return;
        await toggleAbsence({
            studentId: student._id,
            studentName: student.fullName,
            className,
            grade: classMeta.grade,
            subject: selected.subject,
            category: selected.category,
            status,
        });
    };

    // Counts per subject (across all students)
    const subjectCounts: Record<string, number> = {};
    for (const a of absences) {
        subjectCounts[a.subject] = (subjectCounts[a.subject] ?? 0) + 1;
    }

    const selStyle = selected ? categoryStyle(selected.category) : { icon: BookOpen, color: "#64748b", light: "#f1f5f9" };
    const SelIcon = selStyle.icon;

    const trackColor = TRACK_COLORS[classMeta.track || "عام"] || "#5C1523";
    const totalAbsences = absences.length;

    return (
        <div className="space-y-4">
            {/* Class header — compact modern */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-stretch">
                    <button onClick={onBack}
                        className="px-4 hover:bg-slate-50 transition-colors flex items-center text-slate-400 hover:text-slate-700 border-l border-slate-100">
                        <ChevronRight className="w-5 h-5"/>
                    </button>
                    <div className="flex-1 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
                        style={{ background: `linear-gradient(90deg,${trackColor}10,transparent 50%)`, borderRight: `4px solid ${trackColor}` }}>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Users className="w-4 h-4"/>
                                <span className="text-xs font-black">{students.length} طالب</span>
                            </div>
                            {totalAbsences > 0 && (
                                <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                                    <UserX className="w-3 h-3"/>
                                    <span className="text-[11px] font-black">{totalAbsences} غياب</span>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="font-black text-xl text-slate-800">{classMeta.name}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: trackColor }}>{classMeta.track}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject picker — grid of category cards */}
            {Object.keys(byCategory).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-10 flex flex-col items-center gap-2">
                    <BookOpen className="w-10 h-10 text-slate-200"/>
                    <p className="text-sm font-black text-slate-400">لا توجد مواد</p>
                    <p className="text-xs font-bold text-slate-300">أضف من الإعدادات → الاختبارات العملية</p>
                </div>
            ) : (
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-[10px] font-black text-slate-400">{subjects.length} مادة في {Object.keys(byCategory).length} فئة</span>
                        <span className="text-sm font-black text-slate-700 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-qatar-maroon"/>اختر المادة للرصد
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(byCategory).map(([cat, subjList]) => {
                            const st = categoryStyle(cat);
                            const Icon = st.icon;
                            const catTotal = subjList.reduce((sum, s) => sum + (subjectCounts[s.subject] ?? 0), 0);
                            return (
                                <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {/* Category header */}
                                    <div className="px-3.5 py-2.5 flex items-center justify-between"
                                        style={{ background: `linear-gradient(135deg, ${st.color}12, ${st.color}04)`, borderBottom: `2px solid ${st.color}20` }}>
                                        <div className="flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ background: st.color }}>
                                                <Icon className="w-3.5 h-3.5"/>
                                            </span>
                                            <span className="text-xs font-black" style={{ color: st.color }}>{cat}</span>
                                        </div>
                                        {catTotal > 0 && (
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                                                {catTotal}
                                            </span>
                                        )}
                                    </div>
                                    {/* Subject buttons */}
                                    <div className="p-2 space-y-1">
                                        {subjList.map(s => {
                                            const isActive = selected?.subject === s.subject;
                                            const cnt = subjectCounts[s.subject] ?? 0;
                                            return (
                                                <button key={s.subject} dir="rtl" onClick={() => setSelected(s)}
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-black transition-all text-right ${
                                                        isActive ? "text-white shadow-md scale-[1.01]" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                                    }`}
                                                    style={isActive ? { background: st.color, boxShadow: `0 4px 12px ${st.color}40` } : {}}>
                                                    <span>{s.subject}</span>
                                                    {cnt > 0 && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive ? "bg-white/30 text-white" : "bg-rose-100 text-rose-600"}`}>
                                                            {cnt}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!selected ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-10 flex flex-col items-center gap-2">
                    <BookOpen className="w-10 h-10 text-slate-200"/>
                    <p className="text-sm font-black text-slate-400">اختر مادة أعلاه لبدء رصد الغياب</p>
                </div>
            ) : (
                <>
                    {/* Active subject banner */}
                    <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
                        style={{ borderColor: selStyle.color + "40", background: selStyle.light + "40" }}>
                        <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-1">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                                    style={{ background: selStyle.color }}>
                                    <SelIcon className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="font-black text-slate-800 text-base">{selected.subject}</p>
                                    <p className="text-[10px] font-bold" style={{ color: selStyle.color }}>{selected.category}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-2xl font-black" style={{ color: selStyle.color }}>
                                        {subjectCounts[selected.subject] ?? 0}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400">غائب</p>
                                </div>
                                {(subjectCounts[selected.subject] ?? 0) > 0 && (
                                    <button onClick={async () => {
                                        if (confirm(`مسح كل تسجيلات "${selected.subject}" في هذا الفصل؟`)) {
                                            await clearSubject({ className, subject: selected.subject });
                                        }
                                    }}
                                        className="text-[10px] font-black px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200">
                                        مسح الكل
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن طالب..."
                                className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                        </div>
                    </div>

                    {/* Roster */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
                        {/* Branded header bar — matches other sections */}
                        <div dir="rtl" className="px-5 py-3 flex items-center justify-between gap-3"
                            style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)" }}>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white">
                                    {filteredStudents.length} / {students.length}
                                </span>
                                <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-white/70">
                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>حاضر</span>
                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>بعذر</span>
                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"/>غائب</span>
                                </div>
                            </div>
                            <span className="font-black text-white text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-white/70"/>كشف الحضور
                            </span>
                        </div>

                        {students.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center gap-3">
                                <Users className="w-12 h-12 text-slate-200"/>
                                <p className="text-sm font-black text-slate-400">لا يوجد طلاب في هذا الفصل</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center gap-3">
                                <Search className="w-12 h-12 text-slate-200"/>
                                <p className="text-sm font-black text-slate-400">لا توجد نتائج للبحث</p>
                            </div>
                        ) : (
                            <>
                                {/* Column headers */}
                                <div dir="rtl" className="hidden sm:grid grid-cols-[60px_1fr_auto_200px] gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">#</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">اسم الطالب</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">الحالة الحالية</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">الإجراء</span>
                                </div>

                                <div>
                                    {filteredStudents.map((s: any, idx: number) => {
                                        const ab = absMap.get(s.fullName)?.get(selected.subject);
                                        const isAbsent = ab?.status === "absent";
                                        const isExcused = ab?.status === "excused";
                                        const initial = (s.fullName ?? "?").trim().charAt(0);
                                        const stripeBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
                                        const stateBg = isAbsent ? "bg-rose-50/50" : isExcused ? "bg-amber-50/40" : stripeBg;
                                        return (
                                            <div key={s._id} dir="rtl" className={`group border-b border-slate-100 transition-all ${stateBg} hover:bg-slate-50`}>
                                                {/* Desktop layout */}
                                                <div className="hidden sm:grid grid-cols-[60px_1fr_auto_200px] gap-3 px-5 py-3 items-center">
                                                    {/* Index */}
                                                    <span className="text-xs font-black text-slate-400 text-center tabular-nums">{String(idx + 1).padStart(2, "0")}</span>

                                                    {/* Student name with avatar */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-md transition-all`}
                                                            style={{
                                                                background: isAbsent
                                                                    ? `linear-gradient(135deg, ${selStyle.color}, ${selStyle.color}dd)`
                                                                    : isExcused
                                                                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                                                    : "linear-gradient(135deg, #cbd5e1, #94a3b8)",
                                                                boxShadow: isAbsent || isExcused ? `0 4px 12px ${isAbsent ? selStyle.color : "#f59e0b"}40` : "",
                                                            }}>
                                                            {initial}
                                                            {(isAbsent || isExcused) && (
                                                                <span className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center shadow">
                                                                    <span className={`w-2 h-2 rounded-full ${isAbsent ? "bg-rose-500" : "bg-amber-400"}`}/>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={`text-sm font-black truncate ${
                                                            isAbsent ? "text-rose-800" : isExcused ? "text-amber-800" : "text-slate-800"
                                                        }`}>
                                                            {s.fullName}
                                                        </p>
                                                    </div>

                                                    {/* Status chip */}
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border whitespace-nowrap ${
                                                        isAbsent ? "bg-rose-100 text-rose-700 border-rose-200"
                                                        : isExcused ? "bg-amber-100 text-amber-700 border-amber-200"
                                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                            isAbsent ? "bg-rose-500" : isExcused ? "bg-amber-400" : "bg-emerald-500"
                                                        }`}/>
                                                        {isAbsent ? "غائب" : isExcused ? "غياب بعذر" : "حاضر"}
                                                    </span>

                                                    {/* Action buttons */}
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => handleToggle(s, "excused")}
                                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border ${
                                                                isExcused
                                                                    ? "bg-amber-500 text-white border-transparent shadow-md"
                                                                    : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
                                                            }`}>
                                                            {isExcused && <CheckCircle2 className="w-3 h-3"/>}
                                                            بعذر
                                                        </button>
                                                        <button onClick={() => handleToggle(s, "absent")}
                                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border ${
                                                                isAbsent
                                                                    ? "text-white border-transparent shadow-md"
                                                                    : "bg-white text-rose-500 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                                                            }`}
                                                            style={isAbsent ? { background: selStyle.color, boxShadow: `0 4px 12px ${selStyle.color}30` } : {}}>
                                                            {isAbsent && <CheckCircle2 className="w-3 h-3"/>}
                                                            غائب
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mobile layout */}
                                                <div className="sm:hidden p-3 flex items-center gap-2.5">
                                                    <span className="text-[10px] font-black text-slate-400 w-6 text-center flex-shrink-0 tabular-nums">{idx + 1}</span>
                                                    <div className="relative w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-md"
                                                        style={{
                                                            background: isAbsent
                                                                ? `linear-gradient(135deg, ${selStyle.color}, ${selStyle.color}dd)`
                                                                : isExcused
                                                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                                                : "linear-gradient(135deg, #cbd5e1, #94a3b8)",
                                                        }}>
                                                        {initial}
                                                        {(isAbsent || isExcused) && (
                                                            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-white flex items-center justify-center shadow">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isAbsent ? "bg-rose-500" : "bg-amber-400"}`}/>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`flex-1 text-sm font-black truncate ${
                                                        isAbsent ? "text-rose-800" : isExcused ? "text-amber-800" : "text-slate-800"
                                                    }`}>
                                                        {s.fullName}
                                                    </p>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button onClick={() => handleToggle(s, "excused")}
                                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border ${
                                                                isExcused ? "bg-amber-500 text-white border-transparent" : "bg-white text-amber-600 border-amber-200"
                                                            }`}>
                                                            عذر
                                                        </button>
                                                        <button onClick={() => handleToggle(s, "absent")}
                                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border ${
                                                                isAbsent ? "text-white border-transparent" : "bg-white text-rose-500 border-rose-200"
                                                            }`}
                                                            style={isAbsent ? { background: selStyle.color } : {}}>
                                                            غائب
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        {/* Footer with summary stats */}
                        <div dir="rtl" className="bg-slate-50 px-5 py-3 flex items-center justify-between gap-2 border-t border-slate-200 flex-wrap">
                            <div className="flex items-center gap-3 text-[11px] font-black flex-wrap">
                                <span className="flex items-center gap-1.5 text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                                    حاضر: {students.length - (subjectCounts[selected.subject] ?? 0)}
                                </span>
                                <span className="flex items-center gap-1.5 text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
                                    غائب: {absences.filter((a: any) => a.subject === selected.subject && a.status === "absent").length}
                                </span>
                                <span className="flex items-center gap-1.5 text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                                    بعذر: {absences.filter((a: any) => a.subject === selected.subject && a.status === "excused").length}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3"/>
                                اضغط للتعليم · إعادة الضغط = إلغاء
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Absences Report ───────────────────────────────────────────────────────
function AbsencesReport({ subjects, byCategory, template }: {
    subjects: SubjectMeta[];
    byCategory: Record<string, SubjectMeta[]>;
    template: string;
}) {
    const all = useQuery(api.practicalExams.getAllAbsences) as any[] | undefined;
    const deleteAbsence = useMutation(api.practicalExams.deleteAbsence);
    const deleteLegacy = useMutation(api.practicalExams.deleteLegacyAbsences);

    const [filterCategory, setFilterCategory] = useState<string | "all">("all");
    const [filterSubject, setFilterSubject] = useState<string | "all">("all");
    const [filterClass, setFilterClass] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [cleaning, setCleaning] = useState(false);

    const allSafe = all ?? [];
    const legacyCount = allSafe.filter(a => !a.subject || a.subject.trim() === "").length;
    const classes = Array.from(new Set(allSafe.map(a => a.className))).sort();
    const filtered = allSafe.filter(a => {
        if (filterCategory !== "all" && a.category !== filterCategory) return false;
        if (filterSubject !== "all" && a.subject !== filterSubject) return false;
        if (filterClass !== "all" && a.className !== filterClass) return false;
        if (search.trim() && !a.studentName.includes(search.trim())) return false;
        return true;
    });

    const sendWhatsApp = (a: any) => {
        if (!a.guardianPhone) { alert("لا يوجد رقم ولي أمر مسجل"); return; }
        const msg = template
            .replace(/{studentName}/g, a.studentName)
            .replace(/{subject}/g, a.subject)
            .replace(/{category}/g, a.category)
            .replace(/{className}/g, a.className)
            .replace(/{date}/g, new Date(a.markedAt).toLocaleDateString("ar-EG"));
        const phone = a.guardianPhone.replace(/[^\d]/g, "");
        const finalPhone = phone.startsWith("974") ? phone : ("974" + phone);
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const sendGroupedWhatsApp = (group: any) => {
        if (!group.guardianPhone) { alert("لا يوجد رقم ولي أمر مسجل"); return; }
        const lines = [
            `السلام عليكم ولي أمر الطالب *${group.studentName}*`,
            `نود إعلامكم بـ غياب الطالب عن الاختبارات التالية:`,
            ``,
            ...group.records.map((r: any) =>
                `▪️ ${r.subject || r.category} (${r.category})${r.status === "excused" ? " - بعذر" : ""}`
            ),
            ``,
            `🏫 الفصل: ${group.className}`,
            `📅 التاريخ: ${new Date().toLocaleDateString("ar-EG")}`,
            ``,
            `نأمل التواصل مع إدارة المدرسة بشأن الاختبارات التعويضية.`,
            ``,
            `مدرسة ابن تيمية الثانوية للبنين`,
        ];
        const phone = group.guardianPhone.replace(/[^\d]/g, "");
        const finalPhone = phone.startsWith("974") ? phone : ("974" + phone);
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
    };

    // Group by studentName + className
    const groupedFiltered = useMemo(() => {
        const map = new Map<string, any>();
        for (const r of filtered) {
            const key = `${r.studentName}|${r.className}`;
            if (!map.has(key)) {
                map.set(key, {
                    studentName: r.studentName,
                    className: r.className,
                    guardianPhone: r.guardianPhone,
                    records: [],
                    earliestDate: r.markedAt,
                });
            }
            const g = map.get(key)!;
            g.records.push(r);
            if (r.markedAt < g.earliestDate) g.earliestDate = r.markedAt;
            if (r.markedAt > (g.latestDate ?? 0)) g.latestDate = r.markedAt;
        }
        return Array.from(map.values()).sort((a, b) => (b.latestDate ?? 0) - (a.latestDate ?? 0));
    }, [filtered]);

    if (all === undefined) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    // Subjects for the filter (filtered by selected category)
    const availableSubjects = filterCategory === "all"
        ? subjects
        : subjects.filter(s => s.category === filterCategory);

    return (
        <div className="space-y-4">
            {/* Legacy records warning */}
            {legacyCount > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"/>
                        <div>
                            <p className="font-black text-amber-800 text-sm">يوجد {legacyCount} سجل غياب قديم بدون مادة محددة</p>
                            <p className="text-xs text-amber-700 font-bold mt-0.5">سجلات قديمة من قبل تقسيم الفئات لمواد. يظهرون هنا لكن مش بيظهروا في الفصول.</p>
                        </div>
                    </div>
                    <button onClick={async () => {
                        if (!confirm(`سيتم حذف ${legacyCount} سجل قديم بدون مادة. هل تريد المتابعة؟`)) return;
                        setCleaning(true);
                        try { await deleteLegacy({}); } finally { setCleaning(false); }
                    }} disabled={cleaning}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-black hover:bg-amber-600 disabled:opacity-50 flex-shrink-0">
                        <Trash2 className="w-4 h-4"/>
                        {cleaning ? "جارٍ الحذف..." : "حذف السجلات القديمة"}
                    </button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="إجمالي الغياب" value={all.length} color="#5C1523"/>
                <KPI label="بدون عذر" value={all.filter(a => a.status === "absent").length} color="#ef4444"/>
                <KPI label="بعذر" value={all.filter(a => a.status === "excused").length} color="#f59e0b"/>
                <KPI label="عدد الطلاب" value={new Set(all.map(a => a.studentName)).size} color="#1e40af"/>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2">
                        <button onClick={() => printAbsences(filtered, { category: filterCategory, subject: filterSubject, className: filterClass })}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-qatar-maroon text-white text-xs font-black hover:opacity-90 disabled:opacity-40">
                            <Printer className="w-3.5 h-3.5"/>طباعة / PDF
                        </button>
                        <button onClick={() => exportAbsencesCSV(filtered)}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black hover:bg-emerald-100 disabled:opacity-40">
                            <Download className="w-3.5 h-3.5"/>Excel
                        </button>
                        <span className="text-[10px] font-black text-slate-400 self-center">{filtered.length} نتيجة</span>
                    </div>
                    <span className="text-xs font-black text-slate-600 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/>التصفية</span>
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن طالب..."
                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                </div>
                {/* Category pills */}
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setFilterCategory("all"); setFilterSubject("all"); }}
                        className={`px-3 py-1 rounded-lg text-xs font-black border ${filterCategory === "all" ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                        كل الفئات
                    </button>
                    {Object.keys(byCategory).map(c => {
                        const st = categoryStyle(c);
                        const Icon = st.icon;
                        const isActive = filterCategory === c;
                        return (
                            <button key={c} onClick={() => { setFilterCategory(c); setFilterSubject("all"); }}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border ${isActive ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                                style={isActive ? { background: st.color } : {}}>
                                <Icon className="w-3 h-3"/>{c}
                            </button>
                        );
                    })}
                </div>
                {/* Subject + class */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="all">كل المواد</option>
                        {availableSubjects.map(s => <option key={s.subject} value={s.subject}>{s.subject} ({s.category})</option>)}
                    </select>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="all">كل الفصول</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-slate-200"/>
                        <p className="text-sm font-black text-slate-400">لا توجد غيابات تطابق التصفية</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table header */}
                        <div dir="rtl" className="hidden md:grid grid-cols-[40px_minmax(0,1.5fr)_minmax(0,2fr)_120px_140px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <span>#</span>
                            <span>الطالب</span>
                            <span>المواد الغائب عنها</span>
                            <span>الفصل</span>
                            <span className="text-center">الإجراءات</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {groupedFiltered.map((group, i) => {
                                const initial = (group.studentName ?? "?").trim().charAt(0);
                                const firstSt = categoryStyle(group.records[0]?.category ?? "");
                                const hasLegacy = group.records.some((r: any) => !r.subject || r.subject.trim() === "");
                                return (
                                    <div key={`${group.studentName}|${group.className}`} dir="rtl" className="group transition-colors hover:bg-slate-50/60">
                                        {/* Desktop layout */}
                                        <div className="hidden md:grid grid-cols-[40px_minmax(0,1.5fr)_minmax(0,2fr)_120px_140px] gap-3 px-4 py-3 items-center">
                                            <span className="text-[11px] font-black text-slate-400 text-center">{i + 1}</span>

                                            {/* Student */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-sm"
                                                    style={{ background: `linear-gradient(135deg, ${firstSt.color}, ${firstSt.color}cc)` }}>
                                                    {initial}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-800 truncate">{group.studentName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{group.records.length} غياب</span>
                                                        {group.guardianPhone && (
                                                            <p className="text-[10px] font-bold text-slate-400 truncate" dir="ltr">{group.guardianPhone}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Subjects chips */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {group.records.map((r: any) => {
                                                    const st = categoryStyle(r.category);
                                                    const Icon = st.icon;
                                                    const isLegacy = !r.subject || r.subject.trim() === "";
                                                    return (
                                                        <div key={r._id}
                                                            className={`group/chip relative inline-flex items-center gap-1 pr-2 pl-1 py-1 rounded-lg text-[10px] font-black border ${
                                                                isLegacy
                                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                    : r.status === "excused"
                                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                    : "text-white border-transparent"
                                                            }`}
                                                            style={!isLegacy && r.status !== "excused" ? { background: st.color } : {}}>
                                                            <Icon className="w-2.5 h-2.5"/>
                                                            <span>{isLegacy ? "قديم" : r.subject}</span>
                                                            {r.status === "excused" && <span className="text-[8px] opacity-80">(عذر)</span>}
                                                            <button onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`حذف غياب ${group.studentName} في ${r.subject || r.category}؟`)) {
                                                                    await deleteAbsence({ id: r._id as any });
                                                                }
                                                            }}
                                                                className="opacity-0 group-hover/chip:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/20"
                                                                title="حذف هذا الغياب">
                                                                <Trash2 className="w-2.5 h-2.5"/>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Class */}
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black w-fit">
                                                <Users className="w-3 h-3"/>{group.className}
                                            </span>

                                            {/* Actions */}
                                            <div className="flex items-center justify-center gap-1">
                                                {group.guardianPhone ? (
                                                    <>
                                                        <button onClick={() => sendGroupedWhatsApp(group)}
                                                            className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors" title="إرسال واتساب بكل الغياب">
                                                            <MessageSquare className="w-4 h-4"/>
                                                        </button>
                                                        <a href={`tel:${group.guardianPhone}`}
                                                            className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-colors" title="اتصال">
                                                            <Phone className="w-4 h-4"/>
                                                        </a>
                                                    </>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-300">بدون رقم</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile card */}
                                        <div className="md:hidden p-3">
                                            <div className="flex items-start gap-2.5 mb-2">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-sm"
                                                    style={{ background: `linear-gradient(135deg, ${firstSt.color}, ${firstSt.color}cc)` }}>
                                                    {initial}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-slate-800 text-sm truncate">{group.studentName}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{group.records.length} غياب</span>
                                                        <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{group.className}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Subjects chips */}
                                            <div className="flex flex-wrap gap-1 mb-2 pr-12">
                                                {group.records.map((r: any) => {
                                                    const st = categoryStyle(r.category);
                                                    const Icon = st.icon;
                                                    const isLegacy = !r.subject || r.subject.trim() === "";
                                                    return (
                                                        <span key={r._id}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black ${
                                                                isLegacy ? "bg-amber-100 text-amber-700"
                                                                : r.status === "excused" ? "bg-amber-100 text-amber-700"
                                                                : "text-white"
                                                            }`}
                                                            style={!isLegacy && r.status !== "excused" ? { background: st.color } : {}}>
                                                            <Icon className="w-2.5 h-2.5"/>
                                                            {isLegacy ? "قديم" : r.subject}
                                                            {r.status === "excused" && " (عذر)"}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {/* Mobile actions */}
                                            <div className="flex items-center gap-1.5 pr-12">
                                                {group.guardianPhone && (
                                                    <>
                                                        <button onClick={() => sendGroupedWhatsApp(group)}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black">
                                                            <MessageSquare className="w-3 h-3"/>واتساب
                                                        </button>
                                                        <a href={`tel:${group.guardianPhone}`}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black">
                                                            <Phone className="w-3 h-3"/>اتصال
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


function KPI({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400">{label}</p>
            <p className="text-2xl font-black mt-1" style={{ color }}>{value}</p>
        </div>
    );
}
