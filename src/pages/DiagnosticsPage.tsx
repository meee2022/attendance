import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    Stethoscope, Plus, Trash2, Copy, Settings2, ClipboardList, BarChart3,
    Search, AlertCircle, CheckCircle2, UserX, ArrowDownToLine, Users,
    MessageSquare, Printer, TrendingUp, ChevronRight, Target, X, Eraser, RotateCcw, Download,
} from "lucide-react";
import { EmptyState, PageHeader, LoadingSpinner, KPICard } from "../components/ui";
import DiagnosticsExport from "./DiagnosticsExport";

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

function pct(v: number | null | undefined, digits = 0) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return `${(v * 100).toFixed(digits)}%`;
}

function num(v: number | null | undefined, digits = 1) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v.toFixed(digits)).toString();
}

// Weak → strong, used for every percentage bar in the module
function bandColor(p: number, threshold: number) {
    if (p >= 0.9) return "#059669";
    if (p >= threshold) return "#0891b2";
    if (p >= threshold * 0.75) return "#f59e0b";
    return "#e11d48";
}

export default function DiagnosticsPage() {
    const [testId, setTestId] = useState<string | null>(null);
    const [view, setView] = useState<"build" | "entry" | "analysis" | "compare" | "export">("entry");

    if (!testId) return <TestList onOpen={(id, v) => { setTestId(id); setView(v); }}/>;

    return (
        <div dir="rtl" className="grades-page max-w-7xl mx-auto space-y-5">
            <TestHeader testId={testId} onBack={() => setTestId(null)}/>
            <div className="grades-tabs" role="group" aria-label="أقسام الاختبار التشخيصي">
                {([
                    { key: "entry" as const, label: "رصد الدرجات", icon: <ClipboardList className="w-4 h-4"/> },
                    { key: "analysis" as const, label: "التحليل", icon: <BarChart3 className="w-4 h-4"/> },
                    { key: "compare" as const, label: "المقارنة", icon: <TrendingUp className="w-4 h-4"/> },
                    { key: "export" as const, label: "تصدير وحفظ", icon: <Download className="w-4 h-4"/> },
                    { key: "build" as const, label: "إعداد الاختبار", icon: <Settings2 className="w-4 h-4"/> },
                ]).map(({ key, label, icon }) => (
                    <button key={key} onClick={() => setView(key)} aria-pressed={view === key}
                        className={`grades-tab ${view === key ? "is-active" : ""}`}>
                        {icon}{label}
                    </button>
                ))}
            </div>
            {view === "build" && <TestBuilder testId={testId}/>}
            {view === "entry" && <ScoreEntry testId={testId} onGoBuild={() => setView("build")}/>}
            {view === "analysis" && <AnalysisView testId={testId}/>}
            {view === "compare" && <CompareView testId={testId}/>}
            {view === "export" && <DiagnosticsExport testId={testId}/>}
        </div>
    );
}

function TestHeader({ testId, onBack }: { testId: string; onBack: () => void }) {
    const test = useQuery(api.diagnostics.getTest, { testId: testId as any }) as any;
    return (
        <PageHeader icon={<Stethoscope className="w-5 h-5"/>}
            title={test?.title ?? "الاختبار التشخيصي"}
            subtitle={test ? `${(test.subjectNames?.length ? test.subjectNames : [test.subjectName]).join(" + ")} · الصف ${GRADE_LABELS[test.grade] ?? test.grade} · ${test.questions.length} سؤال · الدرجة الكلية ${test.totalMarks}` : "…"}>
            <button onClick={onBack} className="grades-header-note hover:underline">
                <ChevronRight className="w-3 h-3 inline"/> كل الاختبارات
            </button>
        </PageHeader>
    );
}

// ── Test list ─────────────────────────────────────────────────────────────
function TestList({ onOpen }: { onOpen: (id: string, view: "build" | "entry") => void }) {
    const tests = useQuery(api.diagnostics.listTests) as any[] | undefined;
    const data = useQuery(api.setup.getInitialData) as any;
    const createTest = useMutation(api.diagnostics.createTest);
    const deleteTest = useMutation(api.diagnostics.deleteTest);
    const duplicateTest = useMutation(api.diagnostics.duplicateTest);

    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [chosenSubjects, setChosenSubjects] = useState<string[]>([]);
    const [grade, setGrade] = useState(10);
    const [classNames, setClassNames] = useState<string[]>([]);
    const [error, setError] = useState("");

    const subjects = useMemo(() => (data?.subjects ?? []).map((s: any) => s.name)
        .sort((a: string, b: string) => a.localeCompare(b, "ar")), [data]);

    const gradeClasses = useMemo(() => (data?.classes ?? [])
        .filter((c: any) => c.isActive !== false && c.grade === grade)
        .map((c: any) => c.name)
        .sort((a: string, b: string) => a.localeCompare(b, "ar", { numeric: true })), [data, grade]);

    // Selecting a grade normally means "all its sections"
    useEffect(() => { setClassNames(gradeClasses); }, [grade, data]);

    if (!tests || !data) return <LoadingSpinner label="جاري تحميل الاختبارات"/>;

    const handleCreate = async () => {
        setError("");
        try {
            const id = await createTest({
                title,
                // The first subject labels the test; the full list drives the
                // per-subject analysis of a combined test.
                subjectName: chosenSubjects[0] ?? subjects[0] ?? "",
                subjectNames: chosenSubjects.length > 1 ? chosenSubjects : undefined,
                grade, classNames,
            });
            setShowForm(false);
            setTitle("");
            onOpen(id as string, "build");
        } catch (e: any) { setError(e.message ?? "تعذّر الإنشاء"); }
    };

    return (
        <div dir="rtl" className="grades-page max-w-7xl mx-auto space-y-5">
            <PageHeader icon={<Stethoscope className="w-5 h-5"/>} title="الاختبارات التشخيصية"
                subtitle="تحليل نتائج الاختبار حسب المهارات والأسئلة والفصول">
                <span className="grades-header-note">{tests.length} اختبار</span>
            </PageHeader>

            <div className="flex justify-end">
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90">
                    <Plus className="w-4 h-4"/>اختبار جديد
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">اسم الاختبار</label>
                            <input value={title} onChange={e => setTitle(e.target.value)}
                                placeholder="الاختبار التشخيصي — الفصل الأول"
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">الصف</label>
                            <select value={grade} onChange={e => setGrade(Number(e.target.value))}
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                                {[10, 11, 12].map(g => <option key={g} value={g}>الصف {GRADE_LABELS[g]}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            المواد ({chosenSubjects.length}) — اختر أكثر من مادة لاختبار مجمّع كاختبار العلوم
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {subjects.map((sub: string) => {
                                const on = chosenSubjects.includes(sub);
                                return (
                                    <button key={sub} type="button"
                                        onClick={() => setChosenSubjects(p => on ? p.filter(x => x !== sub) : [...p, sub])}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-colors ${
                                            on ? "bg-qatar-maroon text-white border-transparent"
                                               : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400"}`}>
                                        {on && chosenSubjects.length > 1 ? `${chosenSubjects.indexOf(sub) + 1}. ` : ""}{sub}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            الشعب المشاركة ({classNames.length} من {gradeClasses.length})
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {gradeClasses.map((c: string) => {
                                const on = classNames.includes(c);
                                return (
                                    <button key={c} type="button"
                                        onClick={() => setClassNames(p => on ? p.filter(x => x !== c) : [...p, c])}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-colors ${
                                            on ? "bg-qatar-maroon text-white border-transparent"
                                               : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400"}`}>
                                        {c}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {error && <p className="text-xs font-black text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                    <button onClick={handleCreate} disabled={!title.trim() || classNames.length === 0 || chosenSubjects.length === 0}
                        className="w-full py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90 disabled:opacity-40">
                        إنشاء ومتابعة إلى إعداد الأسئلة
                    </button>
                </div>
            )}

            {tests.length === 0 ? (
                <EmptyState icon={<Stethoscope className="w-6 h-6"/>} title="لا توجد اختبارات بعد"
                    description="أنشئ اختباراً، عرّف مهاراته وأسئلته، ثم ارصد الدرجات وسيتولى النظام التحليل."/>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {tests.map(t => (
                        <div key={t._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-black text-slate-800">{t.title}</p>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                                        {(t.subjectNames?.length ? t.subjectNames : [t.subjectName]).join(" + ")}
                                        {" · "}الصف {GRADE_LABELS[t.grade] ?? t.grade} · {t.classNames.length} شعبة
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button title="نسخة جديدة (لاختبار بعدي)"
                                        onClick={async () => {
                                            const name = window.prompt("اسم النسخة الجديدة:", `${t.title} — بعدي`);
                                            if (name) await duplicateTest({ testId: t._id, title: name });
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-qatar-maroon hover:bg-rose-50">
                                        <Copy className="w-4 h-4"/>
                                    </button>
                                    <button title="حذف الاختبار"
                                        onClick={async () => {
                                            if (window.confirm(`حذف «${t.title}» وكل درجاته نهائياً؟`)) {
                                                await deleteTest({ testId: t._id });
                                            }
                                        }}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{t.questionCount} سؤال</span>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{t.skillCount} مهارة</span>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">من {t.totalMarks}</span>
                                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">{t.gradedCount} مرصود</span>
                                {t.unmappedQuestions > 0 && (
                                    <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800">
                                        {t.unmappedQuestions} سؤال بلا مهارة
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => onOpen(t._id, "entry")}
                                    className="flex-1 py-2 rounded-xl bg-qatar-maroon text-white font-black text-xs hover:opacity-90">
                                    فتح الاختبار
                                </button>
                                <button onClick={() => onOpen(t._id, "build")}
                                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-black text-xs hover:border-qatar-maroon hover:text-qatar-maroon">
                                    الإعداد
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Builder: skills + questions ───────────────────────────────────────────
function TestBuilder({ testId }: { testId: string }) {
    const test = useQuery(api.diagnostics.getTest, { testId: testId as any }) as any;
    const data = useQuery(api.setup.getInitialData) as any;
    const updateTest = useMutation(api.diagnostics.updateTest);
    // @ts-ignore
    const clearAllScores = useMutation(api.diagnostics.clearAllScores);
    // @ts-ignore
    const progress = useQuery(api.diagnostics.getClassProgress, { testId: testId as any }) as any[] | undefined;

    const [skills, setSkills] = useState<{ id: string; label: string; subjectName?: string }[]>([]);
    const [questions, setQuestions] = useState<{ n: number; skillId?: string; subjectName?: string; maxMark: number }[]>([]);
    const [threshold, setThreshold] = useState(60);
    const [classNames, setClassNames] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!test) return;
        setSkills(test.skills.map((s: any) => ({ ...s })));
        setQuestions(test.questions.map((q: any) => ({ ...q })));
        setThreshold(Math.round(test.masteryThreshold * 100));
        setClassNames(test.classNames);
    }, [test]);

    const gradeClasses = useMemo(() => (data?.classes ?? [])
        .filter((c: any) => c.isActive !== false && c.grade === test?.grade)
        .map((c: any) => c.name)
        .sort((a: string, b: string) => a.localeCompare(b, "ar", { numeric: true })), [data, test]);

    if (!test || !data) return <LoadingSpinner label="جاري التحميل"/>;

    const testSubjects: string[] = test.subjectNames?.length ? test.subjectNames : [test.subjectName];
    const isCombined = testSubjects.length > 1;
    const total = questions.reduce((s, q) => s + (q.maxMark || 0), 0);
    const recorded = (progress ?? []).reduce((a, p) => a + p.gradedCount + p.absentCount, 0);
    const unmapped = questions.filter(q => !q.skillId).length;
    const noMark = questions.filter(q => !q.maxMark).length;
    const noSubject = isCombined ? questions.filter(q => !q.subjectName).length : 0;

    const addSkill = () => {
        const id = `s${Date.now().toString(36)}${skills.length}`;
        setSkills(p => [...p, { id, label: "" }]);
    };

    const setQuestionCount = (count: number) => {
        setQuestions(p => {
            const next = [...p];
            while (next.length < count) next.push({ n: next.length + 1, maxMark: 1 });
            return next.slice(0, count).map((q, i) => ({ ...q, n: i + 1 }));
        });
    };

    const handleSave = async () => {
        setError("");
        try {
            await updateTest({
                testId: testId as any,
                skills: skills.filter(s => s.label.trim())
                    .map(s => ({ id: s.id, label: s.label.trim(), subjectName: s.subjectName || undefined })),
                questions: questions.map(q => ({
                    n: q.n,
                    skillId: q.skillId || undefined,
                    subjectName: q.subjectName || undefined,
                    maxMark: Number(q.maxMark) || 0,
                })),
                masteryThreshold: Math.min(Math.max(threshold, 1), 100) / 100,
                classNames,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) { setError(e.message ?? "تعذّر الحفظ"); }
    };

    return (
        <div className="space-y-4">
            {/* Readiness — the spreadsheet's فحص الجاهزية, but live */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="الدرجة الكلية" value={total} icon={<Target className="w-5 h-5"/>}/>
                <KPICard label="عدد الأسئلة" value={questions.length} icon={<ClipboardList className="w-5 h-5"/>}/>
                <KPICard label="أسئلة بلا مهارة" value={unmapped} icon={<AlertCircle className="w-5 h-5"/>}
                    color={unmapped > 0 ? "#ea580c" : "#059669"}/>
                <KPICard label={isCombined ? "أسئلة بلا مادة" : "أسئلة بلا درجة"}
                    value={isCombined ? noSubject : noMark} icon={<AlertCircle className="w-5 h-5"/>}
                    color={(isCombined ? noSubject : noMark) > 0 ? "#e11d48" : "#059669"}/>
            </div>

            {/* A combined test needs its marks spread across its subjects */}
            {isCombined && (
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-black bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
                    <span className="text-slate-500">توزيع الدرجات على المواد:</span>
                    {testSubjects.map(sub => {
                        const marks = questions.filter(q => q.subjectName === sub).reduce((a, q) => a + (q.maxMark || 0), 0);
                        const count = questions.filter(q => q.subjectName === sub).length;
                        return (
                            <span key={sub} className={`px-2.5 py-1 rounded-lg border ${
                                count ? "bg-rose-50 text-qatar-maroon border-rose-100" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                {sub} · {count} سؤال · {marks} درجة
                            </span>
                        );
                    })}
                    {noSubject > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                            {noSubject} سؤال بلا مادة
                        </span>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Skills */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 text-sm">المهارات</h3>
                        <button onClick={addSkill}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-qatar-maroon bg-rose-50 border border-rose-200 hover:bg-rose-100">
                            <Plus className="w-3.5 h-3.5"/>مهارة
                        </button>
                    </div>
                    <div className="p-4 space-y-2 max-h-[420px] overflow-auto">
                        {skills.length === 0 && (
                            <p className="text-center text-slate-400 text-xs font-bold py-6">
                                أضف المهارات التي يقيسها الاختبار، ثم اربط كل سؤال بمهارته.
                            </p>
                        )}
                        {skills.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs flex-shrink-0">
                                    {i + 1}
                                </span>
                                <input value={s.label} placeholder="اسم المهارة"
                                    onChange={e => setSkills(p => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                                    className="flex-1 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                                {isCombined && (
                                    <select value={s.subjectName ?? ""}
                                        onChange={e => setSkills(p => p.map((x, idx) => idx === i ? { ...x, subjectName: e.target.value || undefined } : x))}
                                        aria-label="مادة المهارة"
                                        className="w-28 border-2 border-slate-100 rounded-xl px-2 py-2 text-xs font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                                        <option value="">كل المواد</option>
                                        {testSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                    </select>
                                )}
                                <button onClick={() => {
                                        setSkills(p => p.filter((_, idx) => idx !== i));
                                        setQuestions(p => p.map(q => q.skillId === s.id ? { ...q, skillId: undefined } : q));
                                    }}
                                    aria-label={`حذف ${s.label}`}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Questions */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-700 text-sm">الأسئلة</h3>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500">عدد الأسئلة</label>
                            <input type="number" min={0} max={200} value={questions.length}
                                onChange={e => setQuestionCount(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                                className="w-20 border-2 border-slate-100 rounded-lg px-2 py-1 text-sm font-black bg-slate-50 text-center focus:outline-none focus:border-qatar-maroon"/>
                        </div>
                    </div>
                    <div className="p-4 max-h-[420px] overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-white">
                                <tr>
                                    <th className="px-1 py-1 text-center font-semibold text-slate-500 w-10">س</th>
                                    {isCombined && <th className="px-1 py-1 text-right font-semibold text-slate-500 w-28">المادة</th>}
                                    <th className="px-1 py-1 text-right font-semibold text-slate-500">المهارة</th>
                                    <th className="px-1 py-1 text-center font-semibold text-slate-500 w-20">الدرجة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questions.map((q, i) => (
                                    <tr key={q.n}>
                                        <td className="px-1 py-1 text-center font-black text-slate-500">{q.n}</td>
                                        {isCombined && (
                                            <td className="px-1 py-1">
                                                <select value={q.subjectName ?? ""}
                                                    onChange={e => setQuestions(p => p.map((x, idx) => idx === i ? { ...x, subjectName: e.target.value || undefined } : x))}
                                                    className={`w-full border-2 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-qatar-maroon ${
                                                        q.subjectName ? "border-slate-100 bg-slate-50" : "border-amber-200 bg-amber-50"}`}>
                                                    <option value="">— بلا مادة —</option>
                                                    {testSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                                </select>
                                            </td>
                                        )}
                                        <td className="px-1 py-1">
                                            <select value={q.skillId ?? ""}
                                                onChange={e => setQuestions(p => p.map((x, idx) => idx === i ? { ...x, skillId: e.target.value || undefined } : x))}
                                                className={`w-full border-2 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-qatar-maroon ${
                                                    q.skillId ? "border-slate-100 bg-slate-50" : "border-amber-200 bg-amber-50"}`}>
                                                <option value="">— بلا مهارة —</option>
                                                {skills.filter(s => s.label.trim())
                                                    /* on a combined test show only the skills of this subject */
                                                    .filter(s => !isCombined || !q.subjectName || !s.subjectName || s.subjectName === q.subjectName)
                                                    .map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.subjectName && isCombined ? `${s.subjectName} — ` : ""}{s.label}
                                                        </option>
                                                    ))}
                                            </select>
                                        </td>
                                        <td className="px-1 py-1">
                                            <input type="number" min={0} step="0.5" value={q.maxMark}
                                                onChange={e => setQuestions(p => p.map((x, idx) => idx === i ? { ...x, maxMark: Number(e.target.value) } : x))}
                                                className={`w-full border-2 rounded-lg px-2 py-1 text-xs font-black text-center focus:outline-none focus:border-qatar-maroon ${
                                                    q.maxMark ? "border-slate-100 bg-slate-50" : "border-rose-200 bg-rose-50"}`}/>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">حد الإتقان (%)</label>
                        <input type="number" min={1} max={100} value={threshold}
                            onChange={e => setThreshold(Number(e.target.value) || 60)}
                            className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                        <p className="text-[11px] text-slate-400 font-bold mt-1">
                            درجة الإتقان = {num(total * threshold / 100)} من {total}
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            الشعب المشاركة ({classNames.length})
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {gradeClasses.map((c: string) => {
                                const on = classNames.includes(c);
                                return (
                                    <button key={c} type="button"
                                        onClick={() => setClassNames(p => on ? p.filter(x => x !== c) : [...p, c])}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-colors ${
                                            on ? "bg-qatar-maroon text-white border-transparent"
                                               : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400"}`}>
                                        {c}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {error && <p className="text-xs font-black text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                <button onClick={handleSave}
                    className="w-full py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90">
                    {saved ? "تم الحفظ ✓" : "حفظ إعداد الاختبار"}
                </button>
            </div>

            {/* Wiping the marks without deleting the test definition */}
            {recorded > 0 && (
                <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm p-5 space-y-3">
                    <div>
                        <h3 className="font-black text-red-800 text-sm">مسح جميع درجات هذا الاختبار</h3>
                        <p className="text-xs font-bold text-slate-500 mt-1 leading-relaxed">
                            حالياً {recorded} طالب مرصود في {(progress ?? []).filter(p => p.gradedCount + p.absentCount > 0).length} شعبة.
                            يمسح الدرجات في كل الشعب دفعة واحدة ويُبقي الأسئلة والمهارات كما هي.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
                        {(progress ?? []).filter(p => p.gradedCount + p.absentCount > 0).map(p => (
                            <span key={p.className} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                                {p.className} · {p.gradedCount}/{p.expected}
                            </span>
                        ))}
                    </div>
                    <button onClick={async () => {
                            if (!window.confirm(`مسح درجات ${recorded} طالب في كل الشعب نهائياً؟ الأسئلة والمهارات ستبقى.`)) return;
                            const res: any = await clearAllScores({ testId: testId as any });
                            window.alert(`تم مسح درجات ${res.cleared} طالب.`);
                        }}
                        className="w-full py-3 rounded-xl bg-red-600 text-white font-black text-sm hover:bg-red-700">
                        مسح كل الدرجات
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Score entry ───────────────────────────────────────────────────────────
function ScoreEntry({ testId, onGoBuild }: { testId: string; onGoBuild: () => void }) {
    const test = useQuery(api.diagnostics.getTest, { testId: testId as any }) as any;
    const [className, setClassName] = useState("");
    const [search, setSearch] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState<number | null>(null);

    const sheet = useQuery(api.diagnostics.getEntrySheet,
        className ? { testId: testId as any, className } : "skip" as any) as any;

    const setScore = useMutation(api.diagnostics.setScore);
    const setAbsent = useMutation(api.diagnostics.setAbsent);
    const fillQuestion = useMutation(api.diagnostics.fillQuestion);
    // @ts-ignore
    const restoreQuestion = useMutation(api.diagnostics.restoreQuestion);
    // @ts-ignore
    const clearClassScores = useMutation(api.diagnostics.clearClassScores);
    // @ts-ignore
    const progress = useQuery(api.diagnostics.getClassProgress, { testId: testId as any }) as any[] | undefined;

    useEffect(() => {
        if (test && !className && test.classNames.length > 0) setClassName(test.classNames[0]);
    }, [test]);

    // Cells are controlled off a local buffer that re-syncs whenever the server
    // data changes, so a fill (or an undo) always shows up in the grid.
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!sheet || !test) return;
        const init: Record<string, string> = {};
        for (const s of sheet.students) {
            for (const q of test.questions) {
                const v = s.scores[String(q.n)];
                init[`${s.studentId}|${q.n}`] = v === undefined ? "" : String(v);
            }
        }
        setLocalValues(init);
    }, [sheet, test]);

    // One snapshot per question, so pressing ملء twice cannot overwrite the
    // original state and each filled column keeps its own undo.
    type Snapshot = { n: number; entries: { studentId: string; value: number | null }[] };
    const [pendingFills, setPendingFills] = useState<Snapshot[]>([]);
    const [undoing, setUndoing] = useState<number | null>(null);

    const filtered = useMemo(() => {
        const list = sheet?.students ?? [];
        if (!search.trim()) return list;
        return list.filter((s: any) => s.fullName.includes(search.trim()));
    }, [sheet, search]);

    // Consecutive questions measuring the same skill share one header band
    const skillBands = useMemo(() => {
        if (!test) return [];
        const bands: { label: string; span: number; skillId?: string }[] = [];
        for (const q of test.questions) {
            const label = test.skills.find((s: any) => s.id === q.skillId)?.label ?? "بلا مهارة";
            const last = bands[bands.length - 1];
            if (last && last.skillId === q.skillId) last.span++;
            else bands.push({ label, span: 1, skillId: q.skillId });
        }
        return bands;
    }, [test]);

    if (!test) return <LoadingSpinner label="جاري التحميل"/>;

    if (test.questions.length === 0) {
        return <EmptyState icon={<Settings2 className="w-6 h-6"/>} title="لم تُعرَّف أسئلة الاختبار بعد"
            description="حدّد عدد الأسئلة ودرجة كل سؤال والمهارة التي يقيسها من تبويب «إعداد الاختبار»."
            action={<button onClick={onGoBuild} className="px-5 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm">الذهاب للإعداد</button>}/>;
    }

    const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

    const saveCell = async (studentId: string, n: number, raw: string) => {
        const trimmed = raw.trim();
        const value = trimmed === "" ? null : Number(trimmed);
        if (value !== null && isNaN(value)) { flash("قيمة غير صالحة"); return; }
        // A manual edit makes that column's snapshot stale
        setPendingFills(p => p.filter(f => f.n !== n));
        try {
            await setScore({ testId: testId as any, studentId: studentId as any, questionNumber: n, value });
        } catch (e: any) {
            flash(e.message ?? "تعذّر الحفظ");
            // Put the cell back to what the server still holds
            const current = sheet?.students.find((s: any) => s.studentId === studentId)?.scores[String(n)];
            setLocalValues(p => ({ ...p, [`${studentId}|${n}`]: current === undefined ? "" : String(current) }));
        }
    };

    const snapshotOf = (n: number): Snapshot => ({
        n,
        entries: filtered.filter((s: any) => !s.isAbsent).map((s: any) => ({
            studentId: s.studentId,
            value: s.scores[String(n)] ?? null,
        })),
    });

    const runColumn = async (n: number, value: number | null, label: string, overwrite: boolean) => {
        const ids = filtered.filter((s: any) => !s.isAbsent).map((s: any) => s.studentId);
        if (ids.length === 0) return;
        if (overwrite && !window.confirm(
            value === null
                ? `مسح درجات السؤال ${n} لـ ${ids.length} طالب؟`
                : `إعطاء ${value} للسؤال ${n} لـ ${ids.length} طالب واستبدال المرصود؟`
        )) return;

        const before = snapshotOf(n);
        setBusy(n);
        try {
            const res: any = await fillQuestion({
                testId: testId as any, studentIds: ids, questionNumber: n, value, overwrite,
            });
            flash(`${label} — ${res.filled} خانة` + (res.skipped ? ` (تُركت ${res.skipped} خانة مرصودة)` : ""));
            setPendingFills(p => p.some(f => f.n === n) ? p : [...p, before]);
        } catch (e: any) { flash(e.message ?? "تعذّر التنفيذ"); }
        finally { setBusy(null); }
    };

    const undoColumn = async (snap: Snapshot) => {
        setUndoing(snap.n);
        try {
            await restoreQuestion({ testId: testId as any, questionNumber: snap.n, entries: snap.entries as any });
            flash(`تم التراجع عن السؤال ${snap.n} وإرجاع الدرجات كما كانت.`);
            setPendingFills(p => p.filter(f => f.n !== snap.n));
        } catch (e: any) { flash(e.message ?? "تعذّر التراجع"); }
        finally { setUndoing(null); }
    };

    const clearThisClass = async () => {
        const here = progress?.find(p => p.className === className);
        const n = (here?.gradedCount ?? 0) + (here?.absentCount ?? 0);
        if (n === 0) { flash("لا توجد درجات مرصودة في هذه الشعبة."); return; }
        if (!window.confirm(`مسح درجات ${n} طالب في الشعبة ${className} نهائياً؟`)) return;
        try {
            const res: any = await clearClassScores({ testId: testId as any, className });
            setPendingFills([]);
            flash(`تم مسح درجات ${res.cleared} طالب في ${className}.`);
        } catch (e: any) { flash(e.message ?? "تعذّر المسح"); }
    };

    const moveFocus = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
        const go = (r: number, c: number) => {
            const el = document.querySelector<HTMLInputElement>(`input[data-dcell="${r}-${c}"]`);
            if (el) { e.preventDefault(); el.focus(); el.select(); }
        };
        if (e.key === "Enter" || e.key === "Tab") go(col + 1 < test.questions.length ? row : row + 1,
            col + 1 < test.questions.length ? col + 1 : 0);
        else if (e.key === "ArrowDown") go(row + 1, col);
        else if (e.key === "ArrowUp") go(row - 1, col);
    };

    const totalGraded = (progress ?? []).reduce((a, p) => a + p.gradedCount, 0);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-end gap-3 flex-wrap">
                <div className="min-w-[160px]">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">الشعبة</label>
                    <select value={className} onChange={e => setClassName(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        {test.classNames.map((c: string) => {
                            const p = progress?.find(x => x.className === c);
                            return (
                                <option key={c} value={c}>
                                    {c}{p ? ` — ${p.gradedCount}/${p.expected} مرصود` : ""}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الطالب..."
                        aria-label="بحث باسم الطالب"
                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                </div>
                <button type="button" onClick={clearThisClass}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black text-rose-600 bg-white border border-rose-200 hover:bg-rose-50">
                    <Eraser className="w-4 h-4"/>مسح درجات هذه الشعبة
                </button>
                <span className="text-[11px] font-black text-slate-400 pb-2">
                    الدرجة الكلية {test.totalMarks} · الخانة الفارغة تعني «لم يُرصد» وليست صفراً
                </span>
            </div>

            {/* Which classes actually hold marks — clearing a column only ever
                touches the class on screen, so this is where leftovers show up */}
            {progress && totalGraded > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black">
                    <span className="text-slate-400">الشعب التي بها درجات:</span>
                    {progress.filter(p => p.gradedCount > 0 || p.absentCount > 0).map(p => (
                        <button key={p.className} type="button" onClick={() => setClassName(p.className)}
                            className={`px-2.5 py-1 rounded-lg border transition-colors ${
                                p.className === className
                                    ? "bg-qatar-maroon text-white border-transparent"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-qatar-maroon"}`}>
                            {p.className} · {p.gradedCount}/{p.expected}
                            {p.absentCount > 0 && ` · ${p.absentCount} غائب`}
                        </button>
                    ))}
                </div>
            )}

            {(msg || pendingFills.length > 0) && (
                <div role="status" className="flex items-center gap-2 flex-wrap text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {msg && <span className="ml-1">{msg}</span>}
                    {pendingFills.map(snap => (
                        <button key={snap.n} type="button" onClick={() => undoColumn(snap)} disabled={undoing !== null}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
                            {undoing === snap.n
                                ? <span className="w-3 h-3 border-2 border-emerald-200 border-t-emerald-700 rounded-full animate-spin"/>
                                : <RotateCcw className="w-3 h-3"/>}
                            تراجع عن السؤال {snap.n}
                        </button>
                    ))}
                    <button type="button" onClick={() => { setMsg(""); setPendingFills([]); }}
                        aria-label="إخفاء الرسالة" className="mr-auto text-emerald-600 hover:text-emerald-900">
                        <X className="w-3.5 h-3.5"/>
                    </button>
                </div>
            )}

            {search.trim() && (
                <p className="text-[11px] font-bold text-amber-700">
                    البحث مُفعَّل — أزرار العمود تطبّق على الـ {filtered.length} طالب الظاهرين فقط.
                </p>
            )}

            {sheet === undefined ? <LoadingSpinner label="جاري تحميل الكشف"/> : !sheet ? null : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="grade-table-scroll overflow-auto max-h-[70vh]" tabIndex={0} role="region" aria-label="رصد درجات الاختبار التشخيصي">
                        <table className="grade-entry-table w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                {/* Which skill each question measures — the teacher needs this while entering */}
                                <tr>
                                    <th rowSpan={2} className="px-2 py-2 text-center font-semibold text-slate-500 border-l border-slate-200 w-10">#</th>
                                    <th rowSpan={2} className="sticky right-0 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-700 border-l border-slate-200 min-w-[180px]">الاسم</th>
                                    {skillBands.map((b, i) => (
                                        <th key={i} colSpan={b.span}
                                            className={`px-2 py-1.5 text-center text-[11px] font-black border-l-2 border-slate-300 ${
                                                b.skillId ? "text-qatar-maroon bg-rose-50/60" : "text-amber-700 bg-amber-50"}`}>
                                            {b.label}
                                        </th>
                                    ))}
                                    <th rowSpan={2} className="px-2 py-2 text-center font-semibold text-qatar-maroon border-l border-slate-200">المجموع</th>
                                    <th rowSpan={2} className="px-2 py-2 text-center font-semibold text-slate-500 w-14">غياب</th>
                                </tr>
                                <tr>
                                    {test.questions.map((q: any) => (
                                        <th key={q.n} className="px-1 py-1.5 text-center font-semibold text-slate-600 border-l border-slate-100 min-w-[56px]">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span>{q.n}</span>
                                                <span className="text-[9px] text-slate-400 font-bold">من {q.maxMark}</span>
                                                <div className="flex items-center gap-0.5">
                                                    <button type="button" disabled={busy !== null}
                                                        onClick={() => runColumn(q.n, q.maxMark, `الدرجة الكاملة للسؤال ${q.n}`, false)}
                                                        title={`إعطاء الدرجة الكاملة (${q.maxMark}) لمن لم يُرصد بعد`}
                                                        className="px-1 py-0.5 rounded text-[9px] font-black bg-white border border-slate-200 text-slate-500 hover:text-qatar-maroon hover:border-qatar-maroon/40 disabled:opacity-40">
                                                        <ArrowDownToLine className="w-3 h-3"/>
                                                    </button>
                                                    <button type="button" disabled={busy !== null}
                                                        onClick={() => runColumn(q.n, null, `مسح السؤال ${q.n}`, true)}
                                                        title={`مسح درجات السؤال ${q.n} للجميع`}
                                                        className="px-1 py-0.5 rounded text-[9px] font-black bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40">
                                                        <Eraser className="w-3 h-3"/>
                                                    </button>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={test.questions.length + 4} className="text-center py-8 text-slate-500 text-sm">
                                        لا يوجد طلاب مطابقون.
                                    </td></tr>
                                )}
                                {filtered.map((s: any, row: number) => {
                                    const rowTotal = test.questions.reduce((sum: number, q: any) => {
                                        const raw = localValues[`${s.studentId}|${q.n}`];
                                        const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
                                        return sum + (isNaN(n) ? 0 : n);
                                    }, 0);
                                    const anyAnswered = test.questions.some((q: any) => {
                                        const raw = localValues[`${s.studentId}|${q.n}`];
                                        return raw !== undefined && raw.trim() !== "";
                                    });
                                    return (
                                        <tr key={s.studentId} className={`border-t border-slate-100 ${s.isAbsent ? "bg-slate-50 opacity-60" : "hover:bg-slate-50"}`}>
                                            <td className="px-2 py-1 text-center font-bold text-slate-400 border-l border-slate-100">{row + 1}</td>
                                            <td className="sticky right-0 bg-white px-3 py-1 text-right font-bold text-slate-700 border-l border-slate-200 max-w-[210px] whitespace-normal">
                                                {s.fullName}
                                            </td>
                                            {test.questions.map((q: any, col: number) => {
                                                const key = `${s.studentId}|${q.n}`;
                                                return (
                                                    <td key={q.n} className="px-0.5 py-0.5 border-l border-slate-100">
                                                        <input
                                                            data-dcell={`${row}-${col}`}
                                                            value={localValues[key] ?? ""}
                                                            disabled={s.isAbsent}
                                                            onChange={e => setLocalValues(p => ({ ...p, [key]: e.target.value }))}
                                                            onKeyDown={e => moveFocus(e, row, col)}
                                                            onBlur={e => {
                                                                const before = s.scores[String(q.n)];
                                                                const now = e.target.value.trim();
                                                                const changed = now === "" ? before !== undefined : Number(now) !== before;
                                                                if (changed) saveCell(s.studentId, q.n, e.target.value);
                                                            }}
                                                            aria-label={`السؤال ${q.n} لـ ${s.fullName}`}
                                                            className="w-full text-center py-1.5 rounded-md border border-transparent hover:border-slate-200 focus:border-qatar-maroon focus:bg-white outline-none disabled:bg-transparent"/>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-2 py-1 text-center font-black text-qatar-maroon border-l border-slate-200">
                                                {anyAnswered ? num(rowTotal) : "—"}
                                            </td>
                                            <td className="px-2 py-1 text-center">
                                                <button type="button"
                                                    onClick={() => setAbsent({ testId: testId as any, studentId: s.studentId as any, isAbsent: !s.isAbsent })}
                                                    title={s.isAbsent ? "إلغاء الغياب" : "تعليم غائب"}
                                                    className={`p-1.5 rounded-lg border transition-colors ${
                                                        s.isAbsent ? "bg-slate-700 text-white border-slate-700"
                                                                   : "bg-white text-slate-300 border-slate-200 hover:text-slate-600"}`}>
                                                    <UserX className="w-4 h-4"/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Analysis dashboard ────────────────────────────────────────────────────
function AnalysisView({ testId }: { testId: string }) {
    const a = useQuery(api.diagnostics.getAnalysis, { testId: testId as any }) as any;
    const [skillId, setSkillId] = useState<string | null>(null);

    if (!a) return <LoadingSpinner label="جاري التحليل"/>;

    if (a.gradedCount === 0) {
        return <EmptyState icon={<BarChart3 className="w-6 h-6"/>} title="لم تُرصد أي درجات بعد"
            description="ارصد درجات الطلاب من تبويب «رصد الدرجات» وسيظهر التحليل هنا تلقائياً."/>;
    }

    const threshold = a.test.masteryThreshold;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="المرصودون" value={`${a.gradedCount} / ${a.expected}`} icon={<Users className="w-5 h-5"/>}/>
                <KPICard label="متوسط الدرجة" value={num(a.average)} subValue={pct(a.averagePercent)} icon={<Target className="w-5 h-5"/>}/>
                <KPICard label="نسبة الإتقان" value={pct(a.masteredPercent)} subValue={`${a.masteredCount} طالب`}
                    icon={<CheckCircle2 className="w-5 h-5"/>} color="#059669"/>
                <KPICard label="الانحراف المعياري" value={num(a.stdDev)} subValue={`أعلى ${num(a.highest)} · أدنى ${num(a.lowest)}`}
                    icon={<BarChart3 className="w-5 h-5"/>} color="#7c3aed"/>
            </div>

            {/* A combined test is really several tests in one — report each */}
            {a.bySubject && a.bySubject.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100">
                        <h3 className="font-bold text-slate-700 text-sm">النتائج حسب المادة</h3>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-right font-semibold text-slate-600">المادة</th>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-600">أسئلة</th>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-600">من</th>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-600">المتوسط</th>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-600">النسبة</th>
                                    <th className="px-2 py-2 text-center font-semibold text-slate-600">أتقنوها</th>
                                    <th className="px-2 py-2 text-right font-semibold text-slate-600">المهارات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {a.bySubject.map((sb: any) => (
                                    <tr key={sb.subject} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-right font-black text-slate-700">{sb.subject}</td>
                                        <td className="px-2 py-2 text-center text-slate-500 font-bold">{sb.questionCount}</td>
                                        <td className="px-2 py-2 text-center text-slate-500">{sb.maxMark}</td>
                                        <td className="px-2 py-2 text-center font-bold text-slate-600">{num(sb.averageMark)}</td>
                                        <td className="px-2 py-2 text-center font-black" style={{ color: bandColor(sb.averagePercent, threshold) }}>
                                            {pct(sb.averagePercent)}
                                        </td>
                                        <td className="px-2 py-2 text-center font-black" style={{ color: bandColor(sb.masteredPercent, threshold) }}>
                                            {sb.masteredCount} ({pct(sb.masteredPercent)})
                                        </td>
                                        <td className="px-2 py-2 text-right text-slate-500 font-bold text-[11px]">
                                            {sb.skills.join(" · ") || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Skills — weakest first */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm">المهارات — مرتّبة من الأضعف</h3>
                    <span className="text-[11px] font-black text-slate-400">حد الإتقان {pct(threshold)}</span>
                </div>
                <div className="p-4 space-y-3">
                    {a.bySkill.length === 0 && (
                        <p className="text-center text-slate-400 text-xs font-bold py-4">
                            لم تُربط الأسئلة بمهارات — اربطها من تبويب «إعداد الاختبار».
                        </p>
                    )}
                    {a.bySkill.map((s: any) => (
                        <button key={s.id} onClick={() => setSkillId(skillId === s.id ? null : s.id)}
                            className="w-full text-right space-y-1 hover:bg-slate-50 rounded-lg p-1.5 transition-colors">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-700">
                                    {s.label}
                                    <span className="text-slate-400 font-normal">
                                        {a.bySubject && a.bySubject.length > 1 && s.subjectName ? ` · ${s.subjectName}` : ""}
                                        {` · ${s.questionCount} سؤال · من ${s.maxMark}`}
                                    </span>
                                </span>
                                <span style={{ color: bandColor(s.averagePercent, threshold) }}>
                                    {pct(s.averagePercent)} · أتقنها {s.masteredCount}
                                </span>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                    style={{ width: `${s.averagePercent * 100}%`, background: bandColor(s.averagePercent, threshold) }}/>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {skillId && <RemediationList testId={testId} skillId={skillId} onClose={() => setSkillId(null)}/>}

            {/* Classes */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">النتائج حسب الشعبة</h3>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">مرصود</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">المتوسط</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">النسبة</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">أعلى</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">أدنى</th>
                                <th className="px-3 py-2 text-center font-semibold text-slate-600">نسبة الإتقان</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.byClass.map((c: any) => (
                                <tr key={c.className} className="border-t border-slate-100">
                                    <td className="px-3 py-2 text-center font-black text-slate-700">{c.className}</td>
                                    <td className="px-3 py-2 text-center font-bold text-slate-500">{c.gradedCount}</td>
                                    <td className="px-3 py-2 text-center font-bold text-slate-600">{num(c.average)}</td>
                                    <td className="px-3 py-2 text-center font-black" style={{ color: bandColor(c.percent, threshold) }}>{pct(c.percent)}</td>
                                    <td className="px-3 py-2 text-center text-slate-500">{num(c.highest)}</td>
                                    <td className="px-3 py-2 text-center text-slate-500">{num(c.lowest)}</td>
                                    <td className="px-3 py-2 text-center font-black" style={{ color: bandColor(c.masteredPercent, threshold) }}>{pct(c.masteredPercent)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Questions */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">النتائج حسب السؤال</h3>
                </div>
                <div className="overflow-auto max-h-[400px]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                            <tr>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">س</th>
                                {a.bySubject && a.bySubject.length > 1 && (
                                    <th className="px-3 py-2 text-right font-semibold text-slate-600">المادة</th>
                                )}
                                <th className="px-3 py-2 text-right font-semibold text-slate-600">المهارة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">من</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">المتوسط</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">نسبة النجاح</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">أتقنوه</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">صفر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.byQuestion.map((q: any) => (
                                <tr key={q.n} className="border-t border-slate-100">
                                    <td className="px-2 py-1.5 text-center font-black text-slate-500">{q.n}</td>
                                    {a.bySubject && a.bySubject.length > 1 && (
                                        <td className="px-3 py-1.5 text-right font-bold text-qatar-maroon">{q.subjectName}</td>
                                    )}
                                    <td className="px-3 py-1.5 text-right font-bold text-slate-600">{q.skillLabel}</td>
                                    <td className="px-2 py-1.5 text-center text-slate-500">{q.maxMark}</td>
                                    <td className="px-2 py-1.5 text-center font-bold text-slate-600">{num(q.average)}</td>
                                    <td className="px-2 py-1.5 text-center font-black" style={{ color: bandColor(q.successRate, threshold) }}>{pct(q.successRate)}</td>
                                    <td className="px-2 py-1.5 text-center text-slate-500">{q.masteredCount}</td>
                                    <td className="px-2 py-1.5 text-center font-bold text-rose-600">{q.zeroCount || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Level distribution */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">توزيع المستويات</h3>
                </div>
                <div className="p-4 space-y-2">
                    {a.bands.map((b: any) => (
                        <div key={b.label} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600 w-44 flex-shrink-0">{b.label}</span>
                            <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
                                <div className="h-full bg-qatar-maroon rounded-lg" style={{ width: `${b.percent * 100}%` }}/>
                            </div>
                            <span className="text-xs font-black text-slate-700 w-20 text-left">{b.count} ({pct(b.percent)})</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Students */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">نتائج الطلاب</h3>
                </div>
                <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                            <tr>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">#</th>
                                <th className="px-3 py-2 text-right font-semibold text-slate-600">الطالب</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">الدرجة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">النسبة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">الإتقان</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">تقرير</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.students.map((s: any, i: number) => (
                                <tr key={s.studentId} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-2 py-1.5 text-center text-slate-400 font-bold">{i + 1}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-slate-700">{s.studentName}</td>
                                    <td className="px-2 py-1.5 text-center text-slate-500 font-bold">{s.className}</td>
                                    <td className="px-2 py-1.5 text-center font-black text-slate-700">{num(s.total)}</td>
                                    <td className="px-2 py-1.5 text-center font-black" style={{ color: bandColor(s.percent, threshold) }}>{pct(s.percent)}</td>
                                    <td className="px-2 py-1.5 text-center">
                                        {s.mastered
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline"/>
                                            : <X className="w-4 h-4 text-rose-500 inline"/>}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <a href={`/diagnostics/print/${testId}/${s.studentId}`} target="_blank" rel="noopener noreferrer"
                                            title="تقرير الطالب" className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-qatar-maroon hover:bg-rose-50">
                                            <Printer className="w-3.5 h-3.5"/>
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function RemediationList({ testId, skillId, onClose }: { testId: string; skillId: string; onClose: () => void }) {
    const list = useQuery(api.diagnostics.getRemediationList, { testId: testId as any, skillId }) as any;
    if (!list) return null;

    const wa = (phone: string | undefined, name: string, skill: string, percent: number) => {
        if (!phone) return null;
        const clean = phone.replace(/[^\d]/g, "");
        const text = encodeURIComponent(
            `السلام عليكم، بخصوص الطالب ${name} — أظهر الاختبار التشخيصي حاجته للدعم في مهارة «${skill}» (${(percent * 100).toFixed(0)}%). سيتم وضع خطة علاجية. مدرسة ابن تيمية الثانوية للبنين.`
        );
        return `https://wa.me/974${clean}?text=${text}`;
    };

    return (
        <div className="bg-white rounded-2xl border-2 border-qatar-maroon/20 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-rose-50">
                <h3 className="font-bold text-qatar-maroon text-sm">
                    يحتاجون دعماً في «{list.skillLabel}» — {list.students.length} طالب
                </h3>
                <button onClick={onClose} aria-label="إغلاق" className="text-slate-400 hover:text-slate-700">
                    <X className="w-4 h-4"/>
                </button>
            </div>
            {list.students.length === 0 ? (
                <p className="text-center py-6 text-emerald-700 text-sm font-black">جميع الطلاب أتقنوا هذه المهارة ✓</p>
            ) : (
                <div className="overflow-auto max-h-[360px]">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-right font-semibold text-slate-600">الطالب</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">الدرجة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">النسبة</th>
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">تواصل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.students.map((s: any) => {
                                const link = wa(s.guardianPhone, s.studentName, list.skillLabel, s.percent);
                                return (
                                    <tr key={s.studentId} className="border-t border-slate-100">
                                        <td className="px-3 py-1.5 text-right font-bold text-slate-700">{s.studentName}</td>
                                        <td className="px-2 py-1.5 text-center text-slate-500 font-bold">{s.className}</td>
                                        <td className="px-2 py-1.5 text-center text-slate-600 font-bold">{num(s.score)} / {s.maxMark}</td>
                                        <td className="px-2 py-1.5 text-center font-black text-rose-600">{pct(s.percent)}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            {link ? (
                                                <a href={link} target="_blank" rel="noopener noreferrer" title="مراسلة ولي الأمر"
                                                    className="inline-flex p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
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
    );
}

// ── Pre/post comparison ───────────────────────────────────────────────────
function CompareView({ testId }: { testId: string }) {
    const tests = useQuery(api.diagnostics.listTests) as any[] | undefined;
    const [beforeId, setBeforeId] = useState<string>("");

    const cmp = useQuery(api.diagnostics.compareTests,
        beforeId ? { beforeId: beforeId as any, afterId: testId as any } : "skip" as any) as any;

    if (!tests) return <LoadingSpinner label="جاري التحميل"/>;
    const others = tests.filter(t => t._id !== testId);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    قارن هذا الاختبار بـ (الاختبار القبلي)
                </label>
                <select value={beforeId} onChange={e => setBeforeId(e.target.value)}
                    className="w-full sm:max-w-md border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                    <option value="">— اختر اختباراً سابقاً —</option>
                    {others.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}
                </select>
                <p className="text-[11px] text-slate-400 font-bold mt-2">
                    تُطابَق المهارات بالاسم، فالنسخة المكرّرة من الاختبار تُقارَن مباشرة.
                </p>
            </div>

            {!beforeId ? (
                <EmptyState icon={<TrendingUp className="w-6 h-6"/>} title="قارن قبلي ببعدي"
                    description="اختر اختباراً سابقاً لعرض التقدّم في كل مهارة ولكل طالب — وهو ما لا يمكن فعله في ملف إكسل واحد."/>
            ) : !cmp ? <LoadingSpinner label="جاري المقارنة"/> : (
                <>
                    {cmp.unmatchedSkills.length > 0 && (
                        <div className="flex items-start gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                            <span>مهارات لا مقابل لها في الاختبار الآخر: {cmp.unmatchedSkills.join("، ")}</span>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 text-sm">التقدّم حسب المهارة</h3>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                {cmp.before.title} ({cmp.before.gradedCount}) ← {cmp.after.title} ({cmp.after.gradedCount})
                            </p>
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-600">المهارة</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">قبلي</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">بعدي</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">الفرق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cmp.skills.map((s: any) => (
                                        <tr key={s.label} className="border-t border-slate-100">
                                            <td className="px-3 py-2 text-right font-bold text-slate-700">{s.label}</td>
                                            <td className="px-2 py-2 text-center text-slate-500 font-bold">{pct(s.before)}</td>
                                            <td className="px-2 py-2 text-center text-slate-700 font-black">{pct(s.after)}</td>
                                            <td className="px-2 py-2 text-center font-black"
                                                style={{ color: s.change === null ? "#94a3b8" : s.change >= 0 ? "#059669" : "#e11d48" }}>
                                                {s.change === null ? "—" : `${s.change >= 0 ? "▲" : "▼"} ${pct(Math.abs(s.change))}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 text-sm">
                                الطلاب — الأكثر تراجعاً أولاً ({cmp.students.length} طالب في الاختبارين)
                            </h3>
                        </div>
                        <div className="overflow-auto max-h-[420px]">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-600">الطالب</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">الشعبة</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">قبلي</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">بعدي</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-600">الفرق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cmp.students.map((s: any) => (
                                        <tr key={s.studentId} className="border-t border-slate-100">
                                            <td className="px-3 py-1.5 text-right font-bold text-slate-700">{s.studentName}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-500 font-bold">{s.className}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-500">{pct(s.before)}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-700 font-bold">{pct(s.after)}</td>
                                            <td className="px-2 py-1.5 text-center font-black"
                                                style={{ color: s.change >= 0 ? "#059669" : "#e11d48" }}>
                                                {s.change >= 0 ? "▲" : "▼"} {pct(Math.abs(s.change))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
