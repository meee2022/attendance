import { useMemo, useState } from "react";
import { ArrowRight, Award, CheckCircle2, Download, FileSpreadsheet, Link2, Loader2, Pencil, Printer, RotateCcw, Save, Search, Send, Trash2 } from "lucide-react";
import { useSupervisionQuery as useQuery, useSupervisionMutation as useMutation } from "../../lib/supervisionSession";
import { api } from "../../../convex/_generated/api";
import { EmptyState, LoadingSpinner, StatusChip } from "../../components/ui";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { EVALUATION_DOMAINS, INDICATORS, domainTotal, levelOf, scoredCount, totalOf, type Scores } from "../../../convex/evaluationForm";
import { pct, scoreTone, submittedOnly, type VisitRow } from "../../lib/visitStats";
import "./evaluations.css";

// «تقييم الأداء السنوي»: the list of teachers this visitor evaluates, and the
// form. The server decides who is on the list; this page only shows it.

const A = (api as any).teacherEvaluations;
const STATUS: Record<string, { label: string; chip: "neutral" | "warning" | "info" | "success" }> = {
    none: { label: "لم يبدأ", chip: "neutral" },
    draft: { label: "مسودة", chip: "warning" },
    sent: { label: "عند النائب للمراجعة", chip: "info" },
    approved: { label: "معتمد", chip: "success" },
};
const errorText = (e: any, fallback: string) => (typeof e?.data === "string" ? e.data : fallback);
const inputCls = "w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-qatar-maroon disabled:bg-slate-50 disabled:text-slate-500";
const btn = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0";
const primary = `${btn} bg-qatar-maroon text-white hover:shadow-md`;
const ghost = `${btn} border-2 border-slate-200 text-slate-700 hover:border-qatar-maroon`;

export default function Evaluations({ visits, onDirtyChange }: { visits: VisitRow[]; onDirtyChange?: (dirty: boolean) => void }) {
    const data = useQuery(A.list) as any;
    const [teacherId, setTeacherId] = useState("");
    if (!data) return <LoadingSpinner label="جاري تحميل التقييمات…"/>;
    return teacherId
        ? <Editor teacherId={teacherId} visits={visits} onDirtyChange={onDirtyChange} onBack={() => setTeacherId("")}/>
        : <List data={data} onOpen={setTeacherId}/>;
}

function List({ data, onOpen }: { data: any; onOpen: (id: string) => void }) {
    const [department, setDepartment] = useState("");
    const [search, setSearch] = useState("");
    const departments: string[] = useMemo(() => [...new Set<string>(data.rows.map((r: any) => r.department))], [data.rows]);
    const rows = data.rows.filter((r: any) => (!department || r.department === department) && r.teacherName.includes(search.trim()));
    const count = (s: string) => data.rows.filter((r: any) => r.status === s).length;
    const printable = department || (departments.length === 1 ? departments[0] : "");

    const exportExcel = async () => {
        const { downloadWorkbook } = await import("../../lib/excelExport");
        await downloadWorkbook(`تقييم أداء المعلمين ${data.academicYear}`, [{
            name: "التقييم", title: `تقييم أداء المعلمين · العام الأكاديمي ${data.academicYear}`,
            columns: [{ header: "القسم", width: 22 }, { header: "المعلم", width: 34 }, { header: "الحالة", width: 20 },
                { header: "درجة المنسق", width: 12, align: "center" }, { header: "الدرجة", width: 10, align: "center", bold: true },
                { header: "المستوى", width: 12, align: "center" }, { header: "العام السابق", width: 12, align: "center" },
                { header: "الفرق", width: 9, align: "center" }, { header: "توقيع المعلم", width: 13, align: "center" }],
            rows: rows.map((r: any) => [r.department, r.teacherName, STATUS[r.status].label, r.sentTotal, r.total, r.level, r.previousTotal,
                r.total !== null && r.previousTotal !== null && r.level ? r.total - r.previousTotal : null, r.signed ? "وقّع" : ""]),
            freezeColumns: 2,
        }]);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["none", "draft", "sent", "approved"] as const).map((s, i) => (
                    <div key={s} className="ev-rise bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,.04),0_6px_18px_rgba(92,21,35,.06)]" style={{ animationDelay: `${i * 50}ms` }}>
                        <p className="text-xs font-bold text-slate-500">{STATUS[s].label}</p>
                        <p className="text-3xl font-black text-qatar-maroon tabular-nums mt-1">{count(s)}</p>
                    </div>
                ))}
            </div>

            <div className="ev-rise bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] overflow-hidden" style={{ animationDelay: "120ms" }}>
                <div className="p-4 flex items-center gap-2 flex-wrap border-b border-slate-100">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 ml-auto"><Award className="w-5 h-5 text-qatar-maroon"/>استمارة تقييم أداء المعلم · {data.academicYear}</h3>
                    <label className="relative">
                        <span className="sr-only">بحث باسم المعلم</span>
                        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المعلم" className={`${inputCls} pr-9! w-48!`}/>
                    </label>
                    {departments.length > 1 && (
                        <select value={department} onChange={e => setDepartment(e.target.value)} aria-label="القسم" className={`${inputCls} w-52!`}>
                            <option value="">كل الأقسام</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    )}
                    <button className={ghost} disabled={!printable} title={printable ? "" : "اختر قسماً أولاً"}
                        onClick={() => window.open(`/supervision/evaluation/print/department?d=${encodeURIComponent(printable)}`, "_blank")}>
                        <Printer className="w-4 h-4"/>استمارات القسم
                    </button>
                    {data.manager && <button className={ghost} onClick={exportExcel}><FileSpreadsheet className="w-4 h-4"/>Excel</button>}
                </div>
                {rows.length === 0 ? (
                    <EmptyState icon={<Award className="w-6 h-6"/>} title="لا يوجد معلمون للتقييم"
                        description={search || department ? "غيّر البحث أو القسم." : "يظهر هنا معلمو قسمك. منسق القسم يقيّمه النائب الأكاديمي."}/>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-qatar-maroon/5 text-qatar-maroon text-xs sticky top-0">
                                <tr>
                                    <th scope="col" className="p-3 font-black">المعلم</th>
                                    {departments.length > 1 && <th scope="col" className="p-3 font-black">القسم</th>}
                                    <th scope="col" className="p-3 font-black">الحالة</th>
                                    <th scope="col" className="p-3 font-black text-center">الدرجة</th>
                                    <th scope="col" className="p-3 font-black text-center">المستوى</th>
                                    <th scope="col" className="p-3 font-black text-center">العام السابق</th>
                                    <th scope="col" className="p-3 font-black text-center">توقيع المعلم</th>
                                    <th scope="col" className="p-3"><span className="sr-only">إجراء</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any, i: number) => {
                                    const changed = r.status === "approved" && r.sentTotal !== null && r.sentTotal !== r.total;
                                    return (
                                        <tr key={r.teacherId} className={`border-t border-slate-100 transition-colors hover:bg-qatar-maroon/5 ${i % 2 ? "bg-slate-50/60" : ""}`}>
                                            <th scope="row" className="p-3 font-bold text-slate-800">
                                                {r.teacherName}
                                                {r.isCoordinator && <span className="block text-[11px] font-bold text-slate-500">منسق القسم</span>}
                                            </th>
                                            {departments.length > 1 && <td className="p-3 text-slate-600">{r.department}</td>}
                                            <td className="p-3"><StatusChip status={STATUS[r.status].chip} label={STATUS[r.status].label}/></td>
                                            <td className="p-3 text-center font-black tabular-nums">
                                                {r.level ? r.total : r.status === "none" ? "" : <span className="text-xs font-bold text-slate-500">{r.scored} من {INDICATORS.length}</span>}
                                                {changed && <span className="block text-[11px] font-bold text-slate-500">المنسق: {r.sentTotal}</span>}
                                            </td>
                                            <td className="p-3 text-center font-bold">{r.level}</td>
                                            <td className="p-3 text-center tabular-nums text-slate-600">{r.previousTotal ?? ""}</td>
                                            <td className="p-3 text-center">{r.signed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" aria-label="وقّع"/> : ""}</td>
                                            <td className="p-3 text-left">
                                                <button className={`${r.status === "none" ? primary : ghost} px-3! py-1.5!`} onClick={() => onOpen(r.teacherId)}>
                                                    {r.status === "none" ? "تقييم" : "فتح"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

type Penalty = { type: string; reason: string; date: string };
type Course = { name: string; place: string; duration: string; date: string };
const three = <T,>(rows: T[], empty: T): T[] => [0, 1, 2].map(i => rows[i] ?? { ...empty });
const filled = <T extends Record<string, string>>(rows: T[]) => rows.filter(r => Object.values(r).some(v => v.trim()));

function Editor({ teacherId, visits, onBack, onDirtyChange }: { teacherId: string; visits: VisitRow[]; onBack: () => void; onDirtyChange?: (dirty: boolean) => void }) {
    const data = useQuery(A.get, { teacherId }) as any;
    if (!data) return <LoadingSpinner label="جاري فتح الاستمارة…"/>;
    // a save brings a new version from the server: start again from it
    return <Form key={data.evaluation?.updatedAt ?? "new"} data={data} teacherId={teacherId} visits={visits} onBack={onBack} onDirtyChange={onDirtyChange}/>;
}

function Form({ data, teacherId, visits, onBack, onDirtyChange }: { data: any; teacherId: string; visits: VisitRow[]; onBack: () => void; onDirtyChange?: (dirty: boolean) => void }) {
    const e = data.evaluation, editable: boolean = data.editable;
    const initial = useMemo(() => ({
        scores: (e?.scores ?? {}) as Scores,
        penalties: three<Penalty>(e?.penalties ?? [], { type: "", reason: "", date: "" }),
        courses: three<Course>(e?.courses ?? [], { name: "", place: "", duration: "", date: "" }),
        note: (e?.review?.note ?? "") as string, notes: (e?.review?.items ?? {}) as Record<string, string>,
    }), [e]);
    const [scores, setScores] = useState<Scores>(initial.scores);
    const [penalties, setPenalties] = useState(initial.penalties);
    const [courses, setCourses] = useState(initial.courses);
    // the deputy's notes to the coordinator: on the whole form, and beside each changed mark
    const [note, setNote] = useState(initial.note);
    const [notes, setNotes] = useState(initial.notes);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [link, setLink] = useState("");
    const [copied, setCopied] = useState(false);
    const save = useMutation(A.save), approve = useMutation(A.approve), reopen = useMutation(A.reopen), createLink = useMutation(A.createLink), remove = useMutation(A.remove);

    const dirty = editable && JSON.stringify({ scores, penalties, courses, note, notes }) !== JSON.stringify(initial);
    useUnsavedChanges(dirty, onDirtyChange);
    const done = scoredCount(scores), total = totalOf(scores), complete = done === INDICATORS.length;
    const level = complete ? levelOf(total) : "";
    const status = e?.status ?? "none";
    // before and after: the deputy sees it while reviewing, the coordinator once approved
    const compare = !!e?.sent && (data.manager || status === "approved");
    const changedIds = e?.sent ? INDICATORS.filter(i => e.sent.scores[i.id] !== undefined && scores[i.id] !== undefined && e.sent.scores[i.id] !== scores[i.id]).map(i => i.id) : [];

    // the teacher's classroom visits this year, as evidence beside the form
    const mine = submittedOnly(visits).filter(v => v.teacherId === teacherId && v.averageScore !== null);
    const visitAverage = mine.length ? mine.reduce((s, v) => s + (v.averageScore ?? 0), 0) / mine.length : null;

    const run = async (name: string, work: () => Promise<unknown>) => {
        setBusy(name); setError("");
        try { await work(); } catch (err) { setError(errorText(err, "تعذّر الحفظ؛ تحقق من الاتصال وأعد المحاولة")); } finally { setBusy(""); }
    };
    const doSave = (send: boolean) => save({ teacherId, scores: JSON.stringify(scores), penalties: filled(penalties), courses: filled(courses), send, expectedUpdatedAt: e?.updatedAt,
        review: data.manager && e?.sent ? { note, items: JSON.stringify(Object.fromEntries(changedIds.filter(id => notes[id]?.trim()).map(id => [id, notes[id]]))) } : undefined });
    const back = () => { if (!dirty || window.confirm("يوجد تعديل لم يُحفظ. هل تريد العودة للقائمة؟")) onBack(); };

    return (
        <div className="space-y-4 pb-56 lg:pb-28">
            <div className="ev-rise bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] space-y-4">
                <div className="flex items-start gap-3 flex-wrap">
                    <button onClick={back} className={`${ghost} px-3!`}><ArrowRight className="w-4 h-4"/>القائمة</button>
                    <div className="ml-auto">
                        <h3 className="text-lg font-black text-slate-800">{data.teacherName}</h3>
                        <p className="text-xs font-bold text-slate-500">{data.department} · استمارة تقييم أداء المعلم · {data.academicYear}</p>
                    </div>
                    <StatusChip status={STATUS[status].chip} label={STATUS[status].label}/>
                </div>

                {!data.manager && status === "sent" && <p className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs font-bold text-blue-900 leading-6">
                    أرسلت هذه الاستمارة للنائب الأكاديمي. ما تراه هنا هو نسختك كما أرسلتها، وتبقى عندك؛ النائب يراجع الاستمارة ويعدّلها ثم يعتمدها.
                </p>}
                {status === "approved" && e.sent && e.sent.total !== e.total && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-bold text-amber-900 leading-6">
                    درجة المنسق {e.sent.name ? `(${e.sent.name}) ` : ""}كانت {e.sent.total}، وبعد مراجعة النائب الأكاديمي أصبحت {e.total}. المؤشرات التي تغيّرت مبيّنة أمامها.
                </p>}
                {data.manager && status === "sent" && e.sent && <p className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs font-bold text-blue-900 leading-6">
                    أرسلها {e.sent.name} بدرجة {e.sent.total}. عدّل ما تراه ثم اعتمد؛ نسخة المنسق تبقى محفوظة عنده كما أرسلها.
                </p>}

                <Profile data={data} teacherId={teacherId}/>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">الزيارات الصفية المعتمدة هذا العام</p>
                        <p className="font-black text-slate-800 mt-1">
                            {mine.length ? <>{mine.length} زيارة · متوسط <span style={{ color: scoreTone(visitAverage) }}>{pct(visitAverage, 1)}</span></> : "لا توجد زيارات معتمدة بعد"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">للاستئناس فقط؛ لا تدخل في حساب الدرجة.</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">تقييم العام السابق</p>
                        <p className="font-black text-slate-800 mt-1">{data.previous ? `${data.previous.total} من 100 · ${levelOf(data.previous.total)}` : "لا يوجد تقييم محفوظ"}</p>
                        {data.previous && complete && <p className="text-[11px] font-bold mt-1" style={{ color: total >= data.previous.total ? "#047857" : "#b91c1c" }}>
                            الفرق {total - data.previous.total > 0 ? "+" : ""}{total - data.previous.total} درجة
                        </p>}
                    </div>
                </div>
            </div>

            {compare && <Compare sent={e.sent} scores={scores} penalties={filled(penalties)} courses={filled(courses)} approved={status === "approved"}
                note={note} setNote={editable && data.manager ? setNote : null} notes={notes} changedIds={changedIds} teacherId={teacherId}/>}

            <Section title="الجزاءات التأديبية التي وقعت على الموظف خلال سنة التقييم">
                <Rows rows={penalties} set={setPenalties} disabled={!editable} labels={{ type: "نوع الجزاء", reason: "سبب الجزاء", date: "تاريخ الجزاء" }}/>
            </Section>
            <Section title="الدورات التدريبية التي حصل عليها الموظف خلال سنة التقييم">
                <Rows rows={courses} set={setCourses} disabled={!editable} labels={{ name: "اسم الدورة", place: "مكان الانعقاد", duration: "المدة", date: "التاريخ" }}/>
            </Section>

            {/* Fill every indicator at once, then change the few that differ */}
            {editable && (
                <div className="ev-rise bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800 ml-auto">تعبئة سريعة<span className="block text-[11px] font-bold text-slate-500">تملأ المؤشرات التي لم تُقدَّر بعد، ثم عدّل أي درجة تريدها.</span></p>
                    <button type="button" className={primary} disabled={complete}
                        onClick={() => setScores(s => ({ ...Object.fromEntries(INDICATORS.map(i => [i.id, i.max])), ...s }))}>
                        <CheckCircle2 className="w-4 h-4"/>الدرجة الكاملة للكل
                    </button>
                    {data.previous && <button type="button" className={ghost} disabled={complete}
                        onClick={() => setScores(s => ({ ...data.previous.scores, ...s }))}>درجات العام السابق</button>}
                    <button type="button" className={ghost} disabled={!done}
                        onClick={() => { if (window.confirm("مسح كل الدرجات المدخلة في هذه الاستمارة؟")) setScores({}); }}>
                        <RotateCcw className="w-4 h-4"/>مسح الدرجات
                    </button>
                </div>
            )}

            {EVALUATION_DOMAINS.map((d, di) => (
                <Section key={d.title} title={`${di + 1}. ${d.title}`}
                    right={<span className="text-sm font-black text-qatar-maroon tabular-nums whitespace-nowrap">{domainTotal(scores, di + 1)} من {d.percent}</span>}>
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                        {INDICATORS.filter(i => i.domain === di + 1).map((ind, idx) => {
                            const current = scores[ind.id], sent = e?.sent?.scores?.[ind.id], before = data.previous?.scores?.[ind.id];
                            return (
                                <div key={ind.id} className={`grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 items-center px-3 py-2.5 ${idx ? "border-t border-slate-100" : ""} ${current === undefined ? "bg-white" : "bg-slate-50"}`}>
                                    <div>
                                        <p className="text-sm text-slate-800 leading-relaxed"><span className="text-slate-400 font-bold ml-1">{ind.id}</span>{ind.text}</p>
                                        <p className="text-[11px] font-bold text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                                            <span>الدرجة المقررة {ind.max}</span>
                                            {before !== undefined && <span>العام السابق {before}</span>}
                                            {sent !== undefined && current !== undefined && sent !== current && (data.manager || status === "approved") && <span className="text-amber-700">درجة المنسق {sent}</span>}
                                        </p>
                                        {compare && changedIds.includes(ind.id) && (editable && data.manager
                                            ? <input value={notes[ind.id] ?? ""} maxLength={300} onChange={ev => setNotes(n => ({ ...n, [ind.id]: ev.target.value }))}
                                                placeholder="سبب تعديل الدرجة (اختياري، يراه المنسق بعد الاعتماد)" aria-label={`سبب تعديل درجة المؤشر ${ind.id}`}
                                                className={`${inputCls} mt-1.5 py-1.5! text-xs border-amber-200 bg-amber-50/40`}/>
                                            : notes[ind.id] && <p className="text-xs font-bold text-amber-800 mt-1 leading-5">ملاحظة النائب: {notes[ind.id]}</p>)}
                                    </div>
                                    {/* whole marks, and «+0.5» to add half a mark (2 then +0.5 = 2.5) */}
                                    <div className="flex gap-1 items-center">
                                        <div className="flex gap-1" role="radiogroup" aria-label={`درجة المؤشر ${ind.id}`}>
                                            {Array.from({ length: ind.max + 1 }, (_, v) => (
                                                <button key={v} type="button" role="radio" aria-checked={current !== undefined && Math.floor(current) === v} disabled={!editable}
                                                    onClick={() => setScores(s => ({ ...s, [ind.id]: v }))}
                                                    className={`w-11 h-10 rounded-lg border text-sm font-black tabular-nums transition-colors disabled:cursor-default ${current !== undefined && Math.floor(current) === v
                                                        ? "bg-qatar-maroon border-qatar-maroon text-white" : "bg-white border-slate-200 text-slate-600 enabled:hover:border-qatar-maroon"}`}>
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                        <button type="button" aria-pressed={current !== undefined && current % 1 !== 0} aria-label={`نصف درجة للمؤشر ${ind.id}`} title="نصف درجة"
                                            disabled={!editable || current === undefined || current >= ind.max}
                                            onClick={() => setScores(s => ({ ...s, [ind.id]: current! % 1 ? Math.floor(current!) : current! + 0.5 }))}
                                            className={`w-14 h-10 rounded-lg border text-xs font-black tabular-nums transition-colors disabled:opacity-40 disabled:cursor-default ${current !== undefined && current % 1
                                                ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-dashed border-slate-300 text-slate-600 enabled:hover:border-qatar-maroon"}`}>
                                            <span dir="ltr">+0.5</span>
                                        </button>
                                        <span className="w-9 text-center text-sm font-black text-qatar-maroon tabular-nums">{current ?? ""}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            ))}

            {(level === "ممتاز" || level === "جيد جداً") && filled(penalties).length > 0 && <p role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-bold text-amber-900 leading-7">
                على المعلم جزاء مسجّل والمستوى «{level}». راجع شروط الاستمارة: لا يجوز هذا المستوى لمن وقع عليه جزاء بالخصم أو الوقف يتجاوز الحد المذكور فيها، أو انقطع عن العمل بدون عذر، أو تخلف عن دورة أتيحت له.
            </p>}

            {status === "approved" && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] space-y-3">
                    <h4 className="font-black text-slate-800">توقيع المعلم واستلامه</h4>
                    {e.signedAt
                        ? <p className="text-sm font-bold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>وقّع المعلم واستلم نسخته في {new Date(e.signedAt).toLocaleDateString("ar-QA", { timeZone: "Asia/Qatar" })}{e.signComment ? ` · ملاحظته: ${e.signComment}` : ""}</p>
                        : <>
                            <p className="text-xs text-slate-600 leading-6">أنشئ رابطًا خاصًا وأرسله للمعلم: يفتح استمارته وحدها ويوقّع عليها. الرابط صالح 15 يومًا، وإنشاء رابط جديد يلغي السابق.</p>
                            <button className={ghost} disabled={!!busy} onClick={() => run("link", async () => {
                                const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
                                await createLink({ id: e._id, token });
                                setCopied(false); setLink(`${window.location.origin}/supervision/evaluation-sign#${token}`);
                            })}><Link2 className="w-4 h-4"/>{link ? "رابط جديد" : "إنشاء رابط التوقيع"}</button>
                            {link && <div className="flex gap-2 flex-wrap">
                                <input readOnly dir="ltr" value={link} onFocus={ev => ev.target.select()} aria-label="رابط توقيع المعلم" className={`${inputCls} flex-1 min-w-56 text-xs`}/>
                                <button className={primary} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("حدّد الرابط وانسخه يدويًا"); } }}>{copied ? "تم النسخ" : "نسخ"}</button>
                            </div>}
                        </>}
                </div>
            )}

            <div className="fixed bottom-[104px] lg:bottom-0 inset-x-3 lg:inset-x-0 z-30 bg-white border border-slate-200 lg:border-x-0 lg:border-b-0 rounded-2xl lg:rounded-none shadow-lg lg:shadow-none">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-3 text-xs font-black text-slate-600">
                        <span>{done}/{INDICATORS.length} مؤشر</span>
                        <span className="text-xl text-qatar-maroon tabular-nums">{total}<span className="text-xs text-slate-500"> من 100</span></span>
                        {level && <span className="px-2.5 py-1 rounded-full bg-qatar-maroon/10 text-qatar-maroon">{level}</span>}
                    </div>
                    <div className="flex gap-2 mr-auto flex-wrap">
                        {e && <button className={ghost} onClick={() => window.open(`/supervision/evaluation/print/${teacherId}`, "_blank")}><Printer className="w-4 h-4"/>الاستمارة (PDF)</button>}
                        {editable && <button className={ghost} disabled={!!busy || !dirty} onClick={() => run("save", () => doSave(false))}>
                            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}{data.manager ? "حفظ" : "حفظ مسودة"}
                        </button>}
                        {editable && !data.manager && <button className={primary} disabled={!!busy || !complete}
                            onClick={() => { if (window.confirm("إرسال الاستمارة للنائب الأكاديمي؟ بعد الإرسال لا تعدّلها، وتبقى نسختك ظاهرة عندك.")) void run("send", () => doSave(true)); }}>
                            {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}إرسال للنائب الأكاديمي
                        </button>}
                        {editable && data.manager && <button className={primary} disabled={!!busy || !complete}
                            onClick={() => { if (window.confirm("اعتماد الاستمارة؟ بعد الاعتماد تُقفل ويستلمها المعلم للتوقيع.")) void run("approve", async () => { const r: any = await doSave(false); await approve({ id: r.id }); }); }}>
                            {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}حفظ واعتماد
                        </button>}
                        {data.manager && status === "approved" && <button className={ghost} disabled={!!busy} onClick={() => {
                            const reason = window.prompt("سبب إعادة فتح الاستمارة (يُلغى توقيع المعلم إن وُجد):");
                            if (reason?.trim()) void run("reopen", () => reopen({ id: e._id, reason }));
                        }}><RotateCcw className="w-4 h-4"/>إعادة فتح للتعديل</button>}
                        {data.manager && e && <button className={`${ghost} text-rose-700! hover:border-rose-400!`} disabled={!!busy} onClick={() => {
                            if (window.confirm(`حذف تقييم ${data.teacherName} نهائيًا؟ تُمسح درجاته وتوقيع المعلم إن وُجد، ويعود «لم يبدأ». لا يمكن التراجع.`))
                                void run("remove", async () => { await remove({ id: e._id }); onBack(); });
                        }}><Trash2 className="w-4 h-4"/>حذف التقييم</button>}
                    </div>
                </div>
                {error && <p role="alert" className="max-w-7xl mx-auto px-4 pb-2 text-xs font-bold text-rose-700">{error}</p>}
            </div>
        </div>
    );
}

const signed = (n: number) => <bdi dir="ltr">{n > 0 ? `+${n}` : n}</bdi>;
const rowText = (rows: Record<string, string>[]) => rows.length ? rows.map(r => Object.values(r).filter(Boolean).join(" · ")).join("؛ ") : "لا يوجد";
const pdfOf = (teacherId: string, coordinator: boolean) => window.open(`/supervision/evaluation/print/${teacherId}?${coordinator ? "v=coordinator&" : ""}download=1`, "_blank");

// The coordinator's form beside the reviewed one: domain by domain, the marks
// that changed and why, and both versions as PDF files
function Compare({ sent, scores, penalties, courses, approved, note, setNote, notes, changedIds, teacherId }: {
    sent: any; scores: Scores; penalties: Penalty[]; courses: Course[]; approved: boolean;
    note: string; setNote: ((s: string) => void) | null; notes: Record<string, string>; changedIds: string[]; teacherId: string;
}) {
    const after = approved ? "بعد الاعتماد" : "بعد المراجعة";
    const total = totalOf(scores);
    const otherRows = JSON.stringify(sent.penalties ?? []) !== JSON.stringify(penalties) || JSON.stringify(sent.courses ?? []) !== JSON.stringify(courses);
    return (
        <section className="ev-rise bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] space-y-4">
            <div className="flex items-start gap-2 flex-wrap">
                <div className="ml-auto">
                    <h4 className="font-black text-slate-800 text-sm">قبل وبعد مراجعة النائب الأكاديمي</h4>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">نسخة المنسق: {sent.name} · أرسلها {new Date(sent.at).toLocaleDateString("ar-QA", { timeZone: "Asia/Qatar" })}</p>
                </div>
                <button className={`${ghost} px-3! py-1.5! text-xs`} onClick={() => pdfOf(teacherId, true)}><Download className="w-4 h-4"/>نسخة المنسق (PDF)</button>
                <button className={`${ghost} px-3! py-1.5! text-xs`} onClick={() => pdfOf(teacherId, false)}><Download className="w-4 h-4"/>{approved ? "النسخة المعتمدة (PDF)" : "النسخة الحالية (PDF)"}</button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-xs font-black text-slate-500">
                        <tr><th className="text-start px-2 sm:px-3 py-2">المجال</th><th className="px-2 sm:px-3 py-2">نسخة المنسق</th><th className="px-2 sm:px-3 py-2">{after}</th><th className="px-2 sm:px-3 py-2">الفرق</th></tr>
                    </thead>
                    <tbody className="tabular-nums">
                        {EVALUATION_DOMAINS.map((d, di) => {
                            const a = domainTotal(sent.scores, di + 1), b = domainTotal(scores, di + 1);
                            return (
                                <tr key={d.title} className={`border-t border-slate-100 ${a !== b ? "bg-amber-50/60" : ""}`}>
                                    <td className="px-2 sm:px-3 py-2 font-bold text-slate-700">{di + 1}. {d.title}</td>
                                    <td className="px-2 sm:px-3 py-2 text-center font-bold text-slate-600">{a}</td>
                                    <td className="px-2 sm:px-3 py-2 text-center font-black text-slate-800">{b}</td>
                                    <td className={`px-2 sm:px-3 py-2 text-center font-black ${b < a ? "text-rose-700" : b > a ? "text-emerald-700" : "text-slate-400"}`}>{signed(b - a)}</td>
                                </tr>
                            );
                        })}
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-black">
                            <td className="px-2 sm:px-3 py-2 text-slate-800">المجموع من 100</td>
                            <td className="px-2 sm:px-3 py-2 text-center text-slate-700">{sent.total}</td>
                            <td className="px-2 sm:px-3 py-2 text-center text-qatar-maroon">{total}</td>
                            <td className={`px-2 sm:px-3 py-2 text-center ${total < sent.total ? "text-rose-700" : total > sent.total ? "text-emerald-700" : "text-slate-400"}`}>{signed(total - sent.total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {changedIds.length > 0
                ? <div className="space-y-1.5">
                    <p className="text-xs font-black text-slate-600">المؤشرات التي تغيّرت ({changedIds.length})</p>
                    {INDICATORS.filter(i => changedIds.includes(i.id)).map(i => (
                        <div key={i.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5">
                            <div className="flex gap-2 items-start">
                                <span className="font-black text-slate-400">{i.id}</span>
                                <span className="flex-1 text-slate-700 line-clamp-2">{i.text}</span>
                                <span className="font-black tabular-nums whitespace-nowrap text-slate-500">من {sent.scores[i.id]} إلى <span className="text-qatar-maroon">{scores[i.id]}</span></span>
                            </div>
                            {notes[i.id]?.trim() && <p className="font-bold text-amber-800 mt-1">ملاحظة النائب: {notes[i.id]}</p>}
                        </div>
                    ))}
                </div>
                : <p className="text-xs font-bold text-slate-500">لم تتغيّر أي درجة عن نسخة المنسق.</p>}

            {otherRows && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 leading-6">
                تغيّرت الجزاءات أو الدورات. في نسخة المنسق: الجزاءات: {rowText(sent.penalties ?? [])}. الدورات: {rowText(sent.courses ?? [])}.
            </p>}

            {setNote
                ? <label className="block text-xs font-black text-slate-600">ملاحظات النائب للمنسق (يراها بعد الاعتماد)
                    <textarea value={note} maxLength={1000} rows={3} onChange={ev => setNote(ev.target.value)} placeholder="مثال: خُفّضت درجات التخطيط لعدم وجود أدلة في ملف الإنجاز."
                        className={`${inputCls} mt-1 font-normal leading-6 resize-y`}/>
                </label>
                : note.trim() && <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                    <p className="text-xs font-black text-amber-900">ملاحظات النائب الأكاديمي</p>
                    <p className="text-sm text-amber-900 leading-7 whitespace-pre-line mt-0.5">{note}</p>
                </div>}
        </section>
    );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="ev-rise bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] space-y-3">
            <div className="flex items-center justify-between gap-3"><h4 className="font-black text-slate-800 text-sm leading-6">{title}</h4>{right}</div>
            {children}
        </section>
    );
}

// The three rows the form has for penalties, and for courses
function Rows<T extends Record<string, string>>({ rows, set, labels, disabled }: { rows: T[]; set: (rows: T[]) => void; labels: Record<keyof T & string, string>; disabled: boolean }) {
    const keys = Object.keys(labels) as (keyof T & string)[];
    return (
        <div className="space-y-2">
            {rows.map((row, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: `1.5rem repeat(${keys.length}, minmax(0, 1fr))` }}>
                    <span className="text-xs font-black text-slate-400 text-center">{i + 1}</span>
                    {keys.map(k => <input key={k} value={row[k]} disabled={disabled} placeholder={labels[k]} aria-label={`${labels[k]} ${i + 1}`} maxLength={200}
                        onChange={ev => set(rows.map((r, j) => (j === i ? { ...r, [k]: ev.target.value } : r)))} className={inputCls}/>)}
                </div>
            ))}
        </div>
    );
}

const PROFILE: [key: string, label: string][] = [["employeeNo", "الرقم الوظيفي"], ["personalNo", "الرقم الشخصي"], ["hireDate", "تاريخ التعيين"], ["jobTitle", "المسمى الوظيفي"], ["nationality", "الجنسية"]];

// The teacher's details as the form prints them; the deputy keeps them up to date
function Profile({ data, teacherId }: { data: any; teacherId: string }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState<Record<string, string>>(data.profile);
    const [error, setError] = useState("");
    const saveProfile = useMutation(A.saveProfile);
    const missing = PROFILE.filter(([k]) => !data.profile[k]).map(([, l]) => l);
    return (
        <div className="rounded-xl border border-slate-100 p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PROFILE.map(([k, label]) => (
                    <label key={k} className="block text-xs font-bold text-slate-500">{label}
                        {editing
                            ? <input value={value[k]} maxLength={60} onChange={ev => setValue(v => ({ ...v, [k]: ev.target.value }))} className={`${inputCls} mt-1`}/>
                            : <span className="block text-sm font-black text-slate-800 mt-1" dir="auto">{data.profile[k] || "غير مسجل"}</span>}
                    </label>
                ))}
            </div>
            {missing.length > 0 && !editing && <p className="text-[11px] font-bold text-amber-700">ينقص الاستمارة: {missing.join("، ")}{data.manager ? "" : " (يضيفها النائب الأكاديمي)"}.</p>}
            {data.manager && data.evaluation?.status !== "approved" && (editing
                ? <div className="flex gap-2 items-center">
                    <button className={`${primary} px-3! py-1.5!`} onClick={async () => { setError(""); try { await saveProfile({ teacherId, ...value }); setEditing(false); } catch (err) { setError(errorText(err, "تعذّر حفظ البيانات")); } }}>حفظ البيانات</button>
                    <button className={`${ghost} px-3! py-1.5!`} onClick={() => { setValue(data.profile); setEditing(false); }}>إلغاء</button>
                    {error && <span role="alert" className="text-xs font-bold text-rose-700">{error}</span>}
                </div>
                : <button className="text-xs font-black text-qatar-maroon inline-flex items-center gap-1 hover:underline" onClick={() => { setValue(data.profile); setEditing(true); }}><Pencil className="w-3.5 h-3.5"/>تعديل بيانات الموظف</button>)}
        </div>
    );
}
