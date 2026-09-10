import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    ClipboardCheck, CalendarDays, Layers, BookOpen, Users, AlertCircle,
    CheckCircle2, RotateCcw, Search, MessageSquare, BarChart3, Printer,
    UserX, ChevronDown, X, History,
} from "lucide-react";
import { EmptyState, PageHeader, LoadingSpinner, KPICard } from "../components/ui";

type MarkValue = "no" | null;

// Two states only: met or not. One tap toggles.
const MARK_STYLE: Record<string, { label: string; short: string; cls: string }> = {
    ok: { label: "ملتزم",     short: "✓", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    no: { label: "غير ملتزم", short: "✗", cls: "bg-rose-100 text-rose-800 border-rose-300 font-black" },
};

const TRACK_COLORS: Record<string, string> = {
    "عام": "#5C1523", "علمي": "#1e40af", "أدبي": "#f59e0b", "تكنولوجي": "#7c3aed",
};

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoISO(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function markOf(marks: Record<string, string>, criterionId: string): MarkValue {
    // rows recorded under the old three-state scale read as "not met"
    const v = marks[criterionId];
    return v === "no" || v === "partial" ? "no" : null;
}

export default function FollowUpPage() {
    const [view, setView] = useState<"entry" | "analysis" | "log">("entry");

    return (
        <div dir="rtl" className="grades-page max-w-7xl mx-auto space-y-5">
            <PageHeader icon={<ClipboardCheck className="w-5 h-5"/>} title="المتابعة اليومية"
                subtitle="كشف تقييم يومي للطلاب — رصد الالتزام بمعايير الحصة">
                <span className="grades-header-note">الطالب ملتزم افتراضياً — علّم المخالفات فقط</span>
            </PageHeader>

            <div className="grades-tabs" role="group" aria-label="أقسام المتابعة اليومية">
                {([
                    { key: "entry" as const, label: "رصد الكشف", icon: <ClipboardCheck className="w-4 h-4"/> },
                    { key: "analysis" as const, label: "التحليل والمتكررون", icon: <BarChart3 className="w-4 h-4"/> },
                    { key: "log" as const, label: "سجل الكشوف", icon: <History className="w-4 h-4"/> },
                ]).map(({ key, label, icon }) => (
                    <button key={key} onClick={() => setView(key)} aria-pressed={view === key}
                        className={`grades-tab ${view === key ? "is-active" : ""}`}>
                        {icon}{label}
                    </button>
                ))}
            </div>

            {view === "entry" && <EntryView/>}
            {view === "analysis" && <AnalysisView/>}
            {view === "log" && <LogView/>}
        </div>
    );
}

// ── Sheet entry ───────────────────────────────────────────────────────────
function EntryView() {
    const data = useQuery(api.setup.getInitialData) as any;
    const criteria = useQuery(api.followUp.getCriteria) as any[] | undefined;

    const [classId, setClassId] = useState<string>("");
    const [subject, setSubject] = useState<string>("");
    const [date, setDate] = useState<string>(todayISO());
    const [teacherName, setTeacherName] = useState<string>("");
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState("");

    const sheet = useQuery(api.followUp.getSheet,
        classId && subject && date ? { classId: classId as any, subjectName: subject, date } : "skip" as any
    ) as any;

    const setMark = useMutation(api.followUp.setMark);
    const setAbsent = useMutation(api.followUp.setAbsent);
    const setNotes = useMutation(api.followUp.setNotes);
    const openSheet = useMutation(api.followUp.openSheet);
    const setMarkForStudents = useMutation(api.followUp.setMarkForStudents);
    const clearSheet = useMutation(api.followUp.clearSheet);

    const classes = useMemo(() => (data?.classes ?? [])
        .filter((c: any) => c.isActive !== false)
        .sort((a: any, b: any) => (a.grade - b.grade) || a.name.localeCompare(b.name, "ar", { numeric: true })),
        [data]);

    const subjects = useMemo(() => (data?.subjects ?? [])
        .map((s: any) => s.name)
        .sort((a: string, b: string) => a.localeCompare(b, "ar")),
        [data]);

    const filtered = useMemo(() => {
        const list = sheet?.students ?? [];
        if (!search.trim()) return list;
        return list.filter((s: any) => s.fullName.includes(search.trim()));
    }, [sheet, search]);

    const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3500); };

    const ctx = () => ({ classId: classId as any, subjectName: subject, date, teacherName: teacherName.trim() || undefined });

    // Tap a cell to toggle between met and not met
    const cycleMark = async (studentId: string, criterionId: string, current: MarkValue) => {
        const next: MarkValue = current === null ? "no" : null;
        const key = `${studentId}|${criterionId}`;
        setBusy(key);
        try {
            await setMark({ ...ctx(), studentId: studentId as any, criterionId, value: next });
        } catch (e: any) { flash(e.message ?? "تعذّر الحفظ"); }
        finally { setBusy(null); }
    };

    const toggleAbsent = async (studentId: string, isAbsent: boolean) => {
        setBusy(`absent|${studentId}`);
        try {
            await setAbsent({ ...ctx(), studentId: studentId as any, isAbsent: !isAbsent });
        } catch (e: any) { flash(e.message ?? "تعذّر الحفظ"); }
        finally { setBusy(null); }
    };

    const saveNote = async (studentId: string, notes: string) => {
        try {
            await setNotes({ ...ctx(), studentId: studentId as any, notes });
        } catch (e: any) { flash(e.message ?? "تعذّر حفظ الملاحظة"); }
    };

    const confirmAllCompliant = async () => {
        setBusy("open");
        try {
            await openSheet(ctx());
            flash("تم اعتماد الكشف — جميع الطلاب ملتزمون.");
        } catch (e: any) { flash(e.message ?? "تعذّر الاعتماد"); }
        finally { setBusy(null); }
    };

    const markColumn = async (criterionId: string, value: MarkValue, label: string) => {
        const ids = filtered.filter((s: any) => !s.isAbsent).map((s: any) => s.studentId);
        if (ids.length === 0) return;
        if (value !== null && !window.confirm(
            `تعليم «${label}» كـ«${MARK_STYLE[value].label}» لـ ${ids.length} طالب. متأكد؟`
        )) return;
        setBusy(`col|${criterionId}`);
        try {
            const res: any = await setMarkForStudents({ ...ctx(), studentIds: ids, criterionId, value });
            flash(value === null
                ? `تم مسح تعليمات «${label}» عن ${res.changed} طالب.`
                : `تم تعليم «${label}» لـ ${res.changed} طالب.`);
        } catch (e: any) { flash(e.message ?? "تعذّر التنفيذ"); }
        finally { setBusy(null); }
    };

    const resetSheet = async () => {
        if (!window.confirm("إعادة الكشف إلى الوضع الافتراضي (الجميع ملتزم)؟")) return;
        setBusy("clear");
        try {
            const res: any = await clearSheet({ classId: classId as any, subjectName: subject, date });
            flash(`تمت إعادة الضبط — أُزيلت ${res.cleared} حالة.`);
        } catch (e: any) { flash(e.message ?? "تعذّر المسح"); }
        finally { setBusy(null); }
    };

    if (!data || !criteria) return <LoadingSpinner label="جاري التحميل"/>;

    const flaggedCount = (sheet?.students ?? []).filter((s: any) => Object.keys(s.marks).length > 0).length;
    const absentCount = (sheet?.students ?? []).filter((s: any) => s.isAbsent).length;

    return (
        <div className="space-y-4">
            {/* Pickers */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label htmlFor="fu-class" className="block text-xs font-semibold text-slate-600 mb-1.5">١. الشعبة</label>
                    <select id="fu-class" value={classId} onChange={e => setClassId(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="">— اختر الشعبة —</option>
                        {classes.map((c: any) => (
                            <option key={c._id} value={c._id}>{c.name} ({c.track ?? "عام"})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="fu-subject" className="block text-xs font-semibold text-slate-600 mb-1.5">٢. المادة</label>
                    <select id="fu-subject" value={subject} onChange={e => setSubject(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="">— اختر المادة —</option>
                        {subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="fu-date" className="block text-xs font-semibold text-slate-600 mb-1.5">٣. التاريخ</label>
                    <input id="fu-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label htmlFor="fu-teacher" className="block text-xs font-semibold text-slate-600 mb-1.5">اسم المعلم (اختياري)</label>
                    <input id="fu-teacher" value={teacherName} onChange={e => setTeacherName(e.target.value)}
                        placeholder="يظهر في الكشف المطبوع"
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
            </div>

            {msg && (
                <div role="status" className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4"/>{msg}
                </div>
            )}

            {(!classId || !subject) && (
                <EmptyState icon={<ClipboardCheck className="w-6 h-6"/>}
                    title={classId ? "اختر المادة" : "ابدأ باختيار الشعبة والمادة"}
                    description="سيظهر كشف الطلاب هنا. جميع الطلاب ملتزمون افتراضياً — اضغط على الخانة لتعليم المخالفة."/>
            )}

            {classId && subject && (sheet === undefined ? <LoadingSpinner label="جاري تحميل الكشف"/> : !sheet ? null : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Sheet header */}
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap"
                        style={{ background: `linear-gradient(135deg,${TRACK_COLORS[sheet.track] || "#5C1523"},${TRACK_COLORS[sheet.track] || "#5C1523"}dd)` }}>
                        <div className="text-white">
                            <p className="font-semibold text-base">{sheet.subjectName}</p>
                            <p className="text-xs font-bold text-white/80">{sheet.className} · {sheet.track} · {sheet.date}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg border ${
                                sheet.isRecorded
                                    ? "bg-white/15 text-white border-white/25"
                                    : "bg-amber-400 text-amber-950 border-amber-300"
                            }`}>
                                {sheet.isRecorded ? "الكشف مرصود" : "لم يُرصد بعد"}
                            </span>
                            <button onClick={() => window.open(
                                `/follow-up/print/${classId}/${encodeURIComponent(subject)}/${date}`, "_blank")}
                                className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg bg-white/15 text-white border border-white/25 hover:bg-white/25">
                                <Printer className="w-3.5 h-3.5"/>طباعة الأسبوع
                            </button>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="p-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                        <button onClick={confirmAllCompliant} disabled={busy !== null}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                            <CheckCircle2 className="w-4 h-4"/>
                            {sheet.isRecorded ? "اعتماد الكشف" : "الجميع ملتزم — اعتماد الكشف"}
                        </button>
                        {sheet.isRecorded && (flaggedCount > 0 || absentCount > 0) && (
                            <button onClick={resetSheet} disabled={busy !== null}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-slate-600 bg-white border border-slate-200 hover:border-qatar-maroon hover:text-qatar-maroon disabled:opacity-50">
                                <RotateCcw className="w-4 h-4"/>إعادة الضبط
                            </button>
                        )}
                        <div className="relative sm:max-w-xs flex-1 min-w-[180px] mr-auto">
                            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input value={search} onChange={e => setSearch(e.target.value)} aria-label="بحث باسم الطالب"
                                placeholder="بحث باسم الطالب..."
                                className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                        </div>
                    </div>

                    {/* Counters */}
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap text-[11px] font-black">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                            ملتزم: {sheet.students.length - flaggedCount - absentCount}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                            عليهم ملاحظات: {flaggedCount}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                            غائب: {absentCount}
                        </span>
                        <span className="text-slate-400 font-bold">اضغط الخانة للتبديل بين ✓ و ✗</span>
                    </div>

                    {/* Grid */}
                    <div className="grade-table-scroll overflow-auto max-h-[70vh]" tabIndex={0} role="region" aria-label="كشف المتابعة اليومية">
                        <table className="grade-entry-table w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-500 border-l border-slate-200 w-10">#</th>
                                    <th className="sticky right-0 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-700 border-l border-slate-200 min-w-[190px]">الاسم</th>
                                    {criteria.map((c: any) => (
                                        <th key={c.id} className="px-1 py-2 text-center font-semibold text-slate-600 border-l border-slate-100 min-w-[92px]">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="leading-tight">{c.label}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <button type="button" onClick={() => markColumn(c.id, "no", c.label)}
                                                        disabled={busy !== null} title={`تعليم «${c.label}» كغير ملتزم للجميع`}
                                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40">✗</button>
                                                    <button type="button" onClick={() => markColumn(c.id, null, c.label)}
                                                        disabled={busy !== null} title={`مسح تعليمات «${c.label}» عن الجميع`}
                                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">✓</button>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-center font-semibold text-slate-500 border-l border-slate-100 w-16">غياب</th>
                                    <th className="px-2 py-2 text-right font-semibold text-slate-500 min-w-[150px]">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={criteria.length + 4} className="text-center py-8 text-slate-500 text-sm">
                                        {search.trim() ? "لا يوجد طالب مطابق للبحث." : "لا يوجد طلاب في هذه الشعبة."}
                                    </td></tr>
                                )}
                                {filtered.map((s: any, idx: number) => (
                                    <tr key={s.studentId} className={`border-t border-slate-100 ${s.isAbsent ? "bg-slate-50 opacity-60" : "hover:bg-slate-50"}`}>
                                        <td className="px-2 py-1 text-center font-bold text-slate-400 border-l border-slate-100">{idx + 1}</td>
                                        <td className="sticky right-0 bg-white px-3 py-1.5 text-right font-bold text-slate-700 border-l border-slate-200 max-w-[220px] whitespace-normal">
                                            {s.fullName}
                                        </td>
                                        {criteria.map((c: any) => {
                                            const value = markOf(s.marks, c.id);
                                            const style = MARK_STYLE[value ?? "ok"];
                                            const key = `${s.studentId}|${c.id}`;
                                            return (
                                                <td key={c.id} className="px-1 py-1 text-center border-l border-slate-100">
                                                    <button type="button" disabled={s.isAbsent || busy === key}
                                                        onClick={() => cycleMark(s.studentId, c.id, value)}
                                                        aria-label={`${c.label} — ${style.label}`}
                                                        title={style.label}
                                                        className={`w-full min-w-[64px] py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none ${style.cls}`}>
                                                        {busy === key ? "…" : style.short}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-1 text-center border-l border-slate-100">
                                            <button type="button" onClick={() => toggleAbsent(s.studentId, s.isAbsent)}
                                                disabled={busy === `absent|${s.studentId}`}
                                                title={s.isAbsent ? "إلغاء الغياب" : "تعليم غائب"}
                                                className={`p-1.5 rounded-lg border transition-colors ${
                                                    s.isAbsent
                                                        ? "bg-slate-700 text-white border-slate-700"
                                                        : "bg-white text-slate-300 border-slate-200 hover:text-slate-600"
                                                }`}>
                                                <UserX className="w-4 h-4"/>
                                            </button>
                                        </td>
                                        <td className="px-2 py-1">
                                            <input defaultValue={s.notes} placeholder="—"
                                                onBlur={e => { if (e.target.value !== s.notes) saveNote(s.studentId, e.target.value); }}
                                                aria-label={`ملاحظة على ${s.fullName}`}
                                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-qatar-maroon rounded-lg px-2 py-1 text-xs outline-none"/>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Analysis ──────────────────────────────────────────────────────────────
function AnalysisView() {
    const data = useQuery(api.setup.getInitialData) as any;
    const [from, setFrom] = useState(daysAgoISO(30));
    const [to, setTo] = useState(todayISO());
    const [classId, setClassId] = useState<string>("");
    const [minFlags, setMinFlags] = useState(3);

    const analysis = useQuery(api.followUp.getAnalysis, {
        from, to, ...(classId ? { classId: classId as any } : {}),
    }) as any;

    const classes = useMemo(() => (data?.classes ?? [])
        .filter((c: any) => c.isActive !== false)
        .sort((a: any, b: any) => (a.grade - b.grade) || a.name.localeCompare(b.name, "ar", { numeric: true })),
        [data]);

    if (!analysis) return <LoadingSpinner label="جاري تحليل الكشوف"/>;

    const repeat = analysis.students.filter((s: any) => s.flags >= minFlags);
    const maxCriterion = analysis.byCriterion[0]?.total ?? 0;

    const waLink = (phone: string | undefined, name: string, flags: number) => {
        if (!phone) return null;
        const clean = phone.replace(/[^\d]/g, "");
        const text = encodeURIComponent(
            `السلام عليكم، بخصوص الطالب ${name} — تكرر تسجيل ملاحظات المتابعة اليومية عليه (${flags} ملاحظة) خلال الفترة من ${from} إلى ${to}. نرجو المتابعة. مدرسة ابن تيمية الثانوية للبنين.`
        );
        return `https://wa.me/974${clean}?text=${text}`;
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">من تاريخ</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">إلى تاريخ</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">الشعبة</label>
                    <select value={classId} onChange={e => setClassId(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="">كل الشعب</option>
                        {classes.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">حد التكرار</label>
                    <input type="number" min={1} value={minFlags} onChange={e => setMinFlags(Number(e.target.value) || 1)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="كشوف مرصودة" value={analysis.sessionCount} icon={<ClipboardCheck className="w-5 h-5"/>}/>
                {/* a student who was only absent has a record but no flags */}
                <KPICard label="طلاب عليهم ملاحظات" value={analysis.students.filter((s: any) => s.flags > 0).length}
                    icon={<Users className="w-5 h-5"/>} color="#b91c1c"/>
                <KPICard label="إجمالي الملاحظات" value={analysis.byCriterion.reduce((a: number, c: any) => a + c.total, 0)}
                    icon={<AlertCircle className="w-5 h-5"/>} color="#ea580c"/>
                <KPICard label={`متكررون (${minFlags}+)`} value={repeat.length} icon={<BarChart3 className="w-5 h-5"/>} color="#7c3aed"/>
            </div>

            {analysis.sessionCount === 0 ? (
                <EmptyState icon={<BarChart3 className="w-6 h-6"/>} title="لا توجد كشوف مرصودة في هذه الفترة"
                    description="ارصد كشفاً من تبويب «رصد الكشف» وستظهر التحليلات هنا."/>
            ) : (
                <>
                    {/* Weakest criteria */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-qatar-maroon"/>
                            <h3 className="font-bold text-slate-700 text-sm">المعايير الأكثر إخلالاً</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            {analysis.byCriterion.map((c: any) => (
                                <div key={c.id} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-700">{c.label}</span>
                                        <span className="text-slate-500">{c.total} ملاحظة</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500 rounded-full"
                                            style={{ width: `${maxCriterion ? (c.total / maxCriterion) * 100 : 0}%` }}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Repeat offenders */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-qatar-maroon"/>
                                <h3 className="font-bold text-slate-700 text-sm">الطلاب المتكررون ({minFlags} ملاحظات فأكثر)</h3>
                            </div>
                            <span className="text-xs font-black text-slate-400">{repeat.length} طالب</span>
                        </div>
                        {repeat.length === 0 ? (
                            <p className="text-center py-8 text-slate-500 text-sm">لا يوجد طالب بلغ هذا الحد — خفّض حد التكرار لعرض المزيد.</p>
                        ) : (
                            <div className="overflow-auto max-h-[60vh]">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600">الطالب</th>
                                            <th className="px-2 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                                            <th className="px-2 py-2 text-center font-semibold text-slate-600">الملاحظات</th>
                                            <th className="px-2 py-2 text-center font-semibold text-slate-600">أيام</th>
                                            <th className="px-2 py-2 text-center font-semibold text-slate-600">مواد</th>
                                            <th className="px-2 py-2 text-right font-semibold text-slate-600">أبرز المعايير</th>
                                            <th className="px-2 py-2 text-center font-semibold text-slate-600">تواصل</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {repeat.map((s: any) => {
                                            const top = analysis.criteria
                                                .map((c: any) => ({ label: c.label, n: s.perCriterion[c.id] ?? 0 }))
                                                .filter((x: any) => x.n > 0)
                                                .sort((a: any, b: any) => b.n - a.n)
                                                .slice(0, 3);
                                            const link = waLink(s.guardianPhone, s.studentName, s.flags);
                                            return (
                                                <tr key={s.studentId} className="border-t border-slate-100 hover:bg-slate-50">
                                                    <td className="px-3 py-2 text-right font-bold text-slate-700">{s.studentName}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-slate-500">{s.className}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black">{s.flags}</span>
                                                    </td>
                                                    <td className="px-2 py-2 text-center font-bold text-slate-500">{s.dayCount}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-slate-500">{s.subjectCount}</td>
                                                    <td className="px-2 py-2 text-right">
                                                        <div className="flex flex-wrap gap-1">
                                                            {top.map((t: any) => (
                                                                <span key={t.label} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">
                                                                    {t.label} ({t.n})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        {link ? (
                                                            <a href={link} target="_blank" rel="noopener noreferrer"
                                                                title="مراسلة ولي الأمر"
                                                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                                                <MessageSquare className="w-3.5 h-3.5"/>
                                                            </a>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Log of recorded sheets ────────────────────────────────────────────────
function LogView() {
    const sessions = useQuery(api.followUp.getRecentSessions, { limit: 60 }) as any[] | undefined;
    if (!sessions) return <LoadingSpinner label="جاري تحميل السجل"/>;
    if (sessions.length === 0) {
        return <EmptyState icon={<History className="w-6 h-6"/>} title="لم يُرصد أي كشف بعد"
            description="كل كشف ترصده سيظهر هنا مع عدد الملاحظات والغياب."/>;
    }
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                        <tr>
                            <th className="px-3 py-2 text-center font-semibold text-slate-600">التاريخ</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-600">المادة</th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-600">المعلم</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-600">طلاب عليهم ملاحظات</th>
                            <th className="px-3 py-2 text-center font-semibold text-slate-600">غياب</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((s: any) => (
                            <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-center font-bold text-slate-500" dir="ltr">{s.date}</td>
                                <td className="px-3 py-2 text-center font-black text-slate-700">{s.className}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-600">{s.subjectName}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{s.teacherName || "—"}</td>
                                <td className="px-3 py-2 text-center">
                                    {s.flaggedStudents === 0
                                        ? <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-black">الجميع ملتزم</span>
                                        : <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black">{s.flaggedStudents}</span>}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-slate-500">{s.absences || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
