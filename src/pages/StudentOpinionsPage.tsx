import { useMemo, useState } from "react";
import { Check, Download, ExternalLink, Link2, Loader2, UserCheck } from "lucide-react";
import { useQuery, useMutation, usePlatformSession } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../components/ui";
import { downloadWorkbook } from "../lib/excelExport";

// «رأي المعلمين في الطلاب»: the teacher rates each student of a section; the
// deputy follows progress, publishes, and sends every guardian a private link
// to one report gathering all subjects.

export const LEVELS: Record<number, string> = { 5: "ممتاز", 4: "جيد جداً", 3: "جيد", 2: "مقبول", 1: "ضعيف" };
export const DISTRACTION: Record<string, string> = { no: "لا", sometimes: "أحياناً", yes: "نعم" };
const ADVICE = [
    "متابعة حل الواجبات والمذاكرة اليومية في المنزل",
    "تشجيعه على المشاركة داخل الصف",
    "الحد من استخدام الجوال وتنظيم وقت النوم",
    "متابعة مستواه في المادة بالتواصل مع المعلم",
    "الالتزام بالحضور وعدم التأخر",
    "الاستمرار على مستواه المتميز",
];
const input = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:outline-qatar-maroon";
const errorOf = (e: any) => typeof e?.data === "string" ? e.data : "تعذّر الحفظ — تحقق من الاتصال وأعد المحاولة";
const remember = (key: string, value?: string) => {
    try { if (value === undefined) return localStorage.getItem(key) ?? ""; localStorage.setItem(key, value); } catch { /* private mode */ }
    return "";
};

export default function StudentOpinionsPage() {
    const user = usePlatformSession();
    const staff = user?.role === "admin" || user?.role === "deputy";
    const rounds = useQuery((api as any).studentOpinions.rounds) as any[] | undefined;
    const [roundId, setRoundId] = useState("");
    const [tab, setTab] = useState<"entry" | "follow" | "guardians">("entry");
    const round = rounds?.find(r => r._id === roundId) ?? rounds?.[0];

    return <div className="max-w-6xl mx-auto space-y-5" dir="rtl">
        <PageHeader title="رأي المعلمين في الطلاب" icon={<UserCheck className="w-5 h-5"/>}
            subtitle="المستوى الأكاديمي والسلوك والمشتتات، ونصيحة المعلم لولي الأمر"/>
        {rounds === undefined ? <p role="status">جاري التحميل…</p> : <>
            <div className="flex flex-wrap gap-3 items-end">
                {rounds.length > 1 && <label className="text-sm text-slate-700 min-w-64">الاستطلاع
                    <select className={input} value={round?._id ?? ""} onChange={e => setRoundId(e.target.value)}>
                        {rounds.map(r => <option key={r._id} value={r._id}>{r.title}{r.open ? "" : " (مغلق)"}</option>)}
                    </select></label>}
                {staff && <div className="flex gap-1.5 flex-wrap" role="group" aria-label="أقسام الصفحة">
                    {([["entry", "الإدخال"], ["follow", "المتابعة"], ["guardians", "أولياء الأمور"]] as const).map(([k, label]) =>
                        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border ${tab === k ? "bg-qatar-maroon text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}>{label}</button>)}
                </div>}
            </div>
            {staff && <NewRound onCreated={setRoundId}/>}
            {!round ? <p className="p-8 text-center text-slate-600 bg-white rounded-xl border border-slate-200">
                {staff ? "لا يوجد استطلاع بعد — أنشئه من «استطلاع جديد»." : "لا يوجد استطلاع مفتوح حاليًا."}</p>
                : !staff || tab === "entry" ? <Entry round={round}/>
                : tab === "follow" ? <FollowUp round={round}/>
                : <Guardians round={round}/>}
        </>}
    </div>;
}

function NewRound({ onCreated }: { onCreated: (id: string) => void }) {
    const create = useMutation((api as any).studentOpinions.createRound);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("استطلاع رأي المدرسين في طلاب الصف الثاني عشر");
    const [grade, setGrade] = useState(12);
    const [error, setError] = useState("");
    if (!open) return <button className="text-sm font-bold text-qatar-maroon underline underline-offset-4" onClick={() => setOpen(true)}>+ استطلاع جديد</button>;
    return <form className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end" onSubmit={async e => {
        e.preventDefault(); setError("");
        try { onCreated(await create({ title, grade })); setOpen(false); } catch (err) { setError(errorOf(err)); }
    }}>
        <label className="text-sm text-slate-700 flex-1 min-w-64">العنوان<input className={input} value={title} maxLength={160} onChange={e => setTitle(e.target.value)}/></label>
        <label className="text-sm text-slate-700">الصف<select className={input} value={grade} onChange={e => setGrade(Number(e.target.value))}>{[10, 11, 12].map(g => <option key={g} value={g}>{g}</option>)}</select></label>
        <button className="px-4 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-bold">إنشاء وفتح للمعلمين</button>
        <button type="button" className="px-3 py-2 text-sm text-slate-500" onClick={() => setOpen(false)}>إلغاء</button>
        {error && <p role="alert" className="w-full text-sm text-rose-700">{error}</p>}
    </form>;
}

// ── The teacher's sheet ──────────────────────────────────────────────────
function Entry({ round }: { round: any }) {
    const setup = useQuery((api as any).studentOpinions.setup, { roundId: round._id }) as any;
    const [teacherId, setTeacherId] = useState(() => remember("opinion-teacher"));
    const [subject, setSubject] = useState(() => remember("opinion-subject"));
    const [classId, setClassId] = useState("");
    if (!setup) return <p role="status">جاري التحميل…</p>;
    const teacher = setup.teachers.find((t: any) => t._id === teacherId);
    const pickTeacher = (id: string) => {
        setTeacherId(id); remember("opinion-teacher", id);
        const dept = setup.teachers.find((t: any) => t._id === id)?.department ?? "";
        setSubject(dept); remember("opinion-subject", dept);
    };
    return <div className="space-y-4">
        {!round.open && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">الاستطلاع مغلق: يمكن الاطلاع دون تعديل.</p>}
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-700">اسمك
                <select className={input} value={teacher ? teacherId : ""} onChange={e => pickTeacher(e.target.value)}>
                    <option value="">— اختر اسمك —</option>
                    {setup.teachers.map((t: any) => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                </select></label>
            <label className="text-sm text-slate-700">المادة
                <input className={input} value={subject} maxLength={80} onChange={e => { setSubject(e.target.value); remember("opinion-subject", e.target.value); }}/></label>
            <label className="text-sm text-slate-700">الشعبة
                <select className={input} value={classId} onChange={e => setClassId(e.target.value)}>
                    <option value="">— اختر الشعبة —</option>
                    {setup.classes.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select></label>
        </div>
        {teacher && subject.trim() && classId
            ? <Sheet key={`${teacherId}|${subject.trim()}|${classId}`} round={round} teacherId={teacherId} subject={subject.trim()} classId={classId}/>
            : <p className="text-sm text-slate-500">اختر اسمك والمادة والشعبة لتظهر قائمة الطلاب.</p>}
    </div>;
}

function Sheet({ round, teacherId, subject, classId }: { round: any; teacherId: string; subject: string; classId: string }) {
    const data = useQuery((api as any).studentOpinions.sheet, { roundId: round._id, classId, teacherId, subjectName: subject }) as any;
    const save = useMutation((api as any).studentOpinions.save);
    // what was typed or picked here, shown until the server has it
    const [local, setLocal] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    if (!data) return <p role="status">جاري تحميل الطلاب…</p>;
    const byStudent = new Map(data.opinions.map((o: any) => [o.studentId, o]));
    const value = (sid: string, field: string) => {
        const k = `${sid}:${field}`;
        return k in local ? local[k] : (byStudent.get(sid) as any)?.[field] ?? (field === "advice" ? "" : null);
    };
    const put = async (sid: string, field: string, v: any) => {
        const k = `${sid}:${field}`;
        setLocal(p => ({ ...p, [k]: v })); setErrors(p => { const n = { ...p }; delete n[sid]; return n; });
        try {
            await save({ roundId: round._id, studentId: sid, teacherId, subjectName: subject, [field]: v === "" ? null : v });
            setSaved(p => ({ ...p, [sid]: true })); setTimeout(() => setSaved(p => ({ ...p, [sid]: false })), 1500);
        } catch (e) { setErrors(p => ({ ...p, [sid]: errorOf(e) })); }
    };
    const done = data.students.filter((s: any) => value(s._id, "academic") && value(s._id, "behavior") && value(s._id, "distraction")).length;
    const ro = !round.open;
    const select = (sid: string, field: string, options: Record<string, string>, label: string, numeric: boolean) =>
        <select aria-label={label} disabled={ro} className={input} value={value(sid, field) ?? ""}
            onChange={e => void put(sid, field, e.target.value === "" ? "" : numeric ? Number(e.target.value) : e.target.value)}>
            <option value="">{label}</option>
            {Object.entries(options).sort((a, b) => numeric ? Number(b[0]) - Number(a[0]) : 0).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>;

    return <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-bold text-slate-700">{data.students.length} طالب · اكتمل {done}</p>
            <div className="h-2 w-40 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                <div className="h-full bg-qatar-maroon" style={{ width: `${data.students.length ? (done / data.students.length) * 100 : 0}%` }}/>
            </div>
        </div>
        <datalist id="opinion-advice">{ADVICE.map(a => <option key={a} value={a}/>)}</datalist>
        <div className="hidden lg:grid grid-cols-[1.6fr_1fr_1fr_0.8fr_2.2fr] gap-2 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50">
            <span>الطالب</span><span>المستوى الأكاديمي</span><span>السلوك</span><span>مشتتات داخل الصف</span><span>نصيحة لولي الأمر</span>
        </div>
        <ul className="divide-y divide-slate-100">
            {data.students.map((s: any, i: number) => <li key={s._id} className="px-4 py-3 grid gap-2 lg:grid-cols-[1.6fr_1fr_1fr_0.8fr_2.2fr] lg:items-center">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5">{i + 1}</span>{s.fullName}
                    {saved[s._id] && <Check className="w-4 h-4 text-emerald-600" aria-label="حُفظ"/>}
                </p>
                {select(s._id, "academic", LEVELS, "المستوى الأكاديمي", true)}
                {select(s._id, "behavior", LEVELS, "السلوك", true)}
                {select(s._id, "distraction", DISTRACTION, "المشتتات", false)}
                <input aria-label={`نصيحة لولي أمر ${s.fullName}`} list="opinion-advice" disabled={ro} className={input} maxLength={600}
                    placeholder="نصيحة لولي الأمر (اختياري)" defaultValue={value(s._id, "advice")}
                    onBlur={e => { if (e.target.value.trim() !== (value(s._id, "advice") ?? "").trim()) void put(s._id, "advice", e.target.value); }}/>
                {errors[s._id] && <p role="alert" className="lg:col-span-5 text-xs font-bold text-rose-700">{errors[s._id]}</p>}
            </li>)}
        </ul>
    </div>;
}

// ── The deputy's follow-up ───────────────────────────────────────────────
function useOverview(round: any) {
    return useQuery((api as any).studentOpinions.overview, { roundId: round._id }) as any;
}
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const flagged = (o: any) => (o.academic != null && o.academic <= 2) || (o.behavior != null && o.behavior <= 2) || o.distraction === "yes";

function FollowUp({ round }: { round: any }) {
    const data = useOverview(round);
    const setRound = useMutation((api as any).studentOpinions.setRound);
    const [classId, setClassId] = useState("");
    const [open, setOpen] = useState("");
    const [onlyFlagged, setOnlyFlagged] = useState(false);
    const byStudent = useMemo(() => {
        const m = new Map<string, any[]>();
        for (const o of data?.opinions ?? []) m.set(o.studentId, [...(m.get(o.studentId) ?? []), o]);
        return m;
    }, [data]);
    if (!data) return <p role="status">جاري التحميل…</p>;
    // per section: each teacher-subject and how many of its students they rated
    const progress = data.classes.map((c: any) => {
        const n = data.students.filter((s: any) => s.classId === c._id).length;
        const groups = new Map<string, number>();
        for (const o of data.opinions) if (o.classId === c._id) groups.set(`${o.subjectName} — ${o.teacherName}`, (groups.get(`${o.subjectName} — ${o.teacherName}`) ?? 0) + 1);
        return { ...c, n, groups: [...groups].sort((a, b) => a[0].localeCompare(b[0], "ar")) };
    });
    const students = data.students.filter((s: any) => (!classId || s.classId === classId) && (!onlyFlagged || (byStudent.get(s._id) ?? []).some(flagged)));
    return <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
            <p className="text-sm font-bold text-slate-700 flex-1">{round.title} · {round.open ? "مفتوح للمعلمين" : "مغلق"} · {round.published ? "التقارير منشورة لأولياء الأمور" : "التقارير غير منشورة"}</p>
            <button className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold" onClick={() => void setRound({ id: round._id, open: !round.open })}>{round.open ? "إغلاق الإدخال" : "فتح الإدخال"}</button>
        </div>
        <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-800 mb-3">المعلمون في كل شعبة</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {progress.map((c: any) => <div key={c._id} className="rounded-lg border border-slate-100 p-3">
                    <p className="font-bold text-slate-800 text-sm">{c.name} <span className="text-slate-400 font-normal">· {c.n} طالب</span></p>
                    {c.groups.length ? <ul className="mt-2 space-y-1 text-xs">{c.groups.map(([k, count]: any) => <li key={k} className="flex justify-between gap-2">
                        <span className="text-slate-600">{k}</span><span className={count >= c.n ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>{count}/{c.n}</span></li>)}</ul>
                        : <p className="mt-2 text-xs text-slate-400">لم يبدأ أحد بعد.</p>}
                </div>)}
            </div>
        </section>
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 flex flex-wrap gap-3 items-end border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex-1">الطلاب</h2>
                <label className="text-sm text-slate-700">الشعبة<select className={input} value={classId} onChange={e => setClassId(e.target.value)}>
                    <option value="">كل الشعب</option>{data.classes.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
                <label className="text-sm text-slate-700 flex items-center gap-2 pb-2"><input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)}/>يحتاجون متابعة فقط</label>
            </div>
            <ul className="divide-y divide-slate-100">
                {students.map((s: any) => {
                    const rows = byStudent.get(s._id) ?? [];
                    const ac = mean(rows.map((o: any) => o.academic).filter((x: any) => x != null));
                    const be = mean(rows.map((o: any) => o.behavior).filter((x: any) => x != null));
                    const flags = rows.filter(flagged).map((o: any) => o.subjectName);
                    return <li key={s._id}>
                        <button className="w-full px-4 py-3 grid gap-1 sm:grid-cols-[2fr_0.6fr_1fr_1fr_2fr] text-right text-sm hover:bg-slate-50" onClick={() => setOpen(open === s._id ? "" : s._id)} aria-expanded={open === s._id}>
                            <span className="font-bold text-slate-800">{s.fullName}</span>
                            <span className="text-slate-500">{s.className}</span>
                            <span className="text-slate-600">{rows.length} مادة</span>
                            <span className="text-slate-600">أكاديمي {ac?.toFixed(1) ?? "—"} · سلوك {be?.toFixed(1) ?? "—"}</span>
                            <span className={flags.length ? "text-rose-700 font-bold" : "text-slate-400"}>{flags.length ? `متابعة: ${flags.join("، ")}` : "—"}</span>
                        </button>
                        {open === s._id && <div className="px-4 pb-4 overflow-x-auto">
                            {rows.length ? <table className="w-full text-xs border-collapse">
                                <thead><tr className="bg-slate-50 text-slate-500">{["المادة", "المعلم", "الأكاديمي", "السلوك", "المشتتات", "النصيحة"].map(h => <th key={h} className="p-2 text-right font-bold">{h}</th>)}</tr></thead>
                                <tbody>{rows.map((o: any) => <tr key={o.teacherId + o.subjectName} className="border-t border-slate-100">
                                    <td className="p-2 font-bold">{o.subjectName}</td><td className="p-2">{o.teacherName}</td>
                                    <td className="p-2">{LEVELS[o.academic] ?? "—"}</td><td className="p-2">{LEVELS[o.behavior] ?? "—"}</td>
                                    <td className="p-2">{DISTRACTION[o.distraction] ?? "—"}</td><td className="p-2">{o.advice || "—"}</td></tr>)}</tbody>
                            </table> : <p className="text-xs text-slate-400">لم يكتب أي معلم عن هذا الطالب بعد.</p>}
                        </div>}
                    </li>;
                })}
            </ul>
        </section>
    </div>;
}

// ── Links for the guardians ──────────────────────────────────────────────
export const reportUrl = (token: string) => `${window.location.origin}/guardian-report#${token}`;
export const guardianMessage = (s: any, title: string, url: string) =>
    `السلام عليكم ولي أمر الطالب ${s.fullName}\nنضع بين أيديكم تقرير آراء معلمي ابنكم (${s.className}) — ${title}:\n${url}\nمع تحيات مدرسة ابن تيمية الثانوية للبنين`;

function Guardians({ round }: { round: any }) {
    const data = useOverview(round);
    const issue = useMutation((api as any).studentOpinions.issueLinks);
    const setRound = useMutation((api as any).studentOpinions.setRound);
    const [days, setDays] = useState(30);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState("");
    if (!data) return <p role="status">جاري التحميل…</p>;
    const now = Date.now();
    const linkOf = new Map(data.links.filter((l: any) => l.expiresAt > now).map((l: any) => [l.studentId, l]));
    const rated = new Set(data.opinions.map((o: any) => o.studentId));
    const opened = data.links.filter((l: any) => l.openCount > 0).length;
    const exportExcel = () => downloadWorkbook(`روابط أولياء الأمور - ${round.title}`, [{
        name: "الرسائل",
        title: "",
        columns: [
            { header: "اسم الطالب", width: 32, bold: true },
            { header: "الشعبة", width: 9, align: "center" },
            { header: "الرقم الشخصي", width: 15, align: "center" },
            { header: "رقم ولي الأمر", width: 15, align: "center" },
            { header: "نص الرسالة", width: 70 },
            { header: "رابط التقرير", width: 50 },
            { header: "آراء المعلمين", width: 10, align: "center" },
        ],
        rows: data.students.map((s: any) => {
            const l: any = linkOf.get(s._id);
            const url = l ? reportUrl(l.token) : "";
            return [s.fullName, s.className, s.nationalId, s.guardianPhone, url ? guardianMessage(s, round.title, url) : "", url,
                data.opinions.filter((o: any) => o.studentId === s._id).length];
        }),
        freezeColumns: 1,
        orientation: "landscape",
    } as any]);

    return <div className="space-y-4">
        {!round.published && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex flex-wrap items-center gap-3">
            <span className="flex-1">الروابط لا تفتح لأولياء الأمور حتى تنشر التقارير.{round.open ? " أغلق الإدخال أولاً حتى لا يرى ولي الأمر تقريرًا ناقصًا." : ""}</span>
            <button className="px-4 py-2 rounded-lg bg-qatar-maroon text-white font-bold" onClick={() => { if (window.confirm("نشر التقارير؟ سيرى كل ولي أمر يفتح رابطه تقرير ابنه.")) void setRound({ id: round._id, published: true }); }}>نشر التقارير</button>
        </div>}
        {round.published && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
            التقارير منشورة. <button className="underline" onClick={() => void setRound({ id: round._id, published: false })}>إيقاف النشر</button></p>}
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid gap-4 sm:grid-cols-3">
            <p className="text-sm"><b className="text-2xl text-qatar-maroon block">{linkOf.size} / {data.students.length}</b>روابط صالحة</p>
            <p className="text-sm"><b className="text-2xl text-qatar-maroon block">{opened}</b>ولي أمر فتح التقرير</p>
            <p className="text-sm"><b className="text-2xl text-qatar-maroon block">{data.students.filter((s: any) => !rated.has(s._id)).length}</b>طالب بلا أي رأي بعد</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
            <label className="text-sm text-slate-700">صلاحية الرابط (أيام)<input type="number" min={1} max={120} className={input} value={days} onChange={e => setDays(Number(e.target.value) || 30)}/></label>
            <button disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-bold disabled:opacity-50" onClick={async () => {
                setBusy(true); setNote("");
                try { const n = await issue({ roundId: round._id, days }); setNote(n ? `روابط جديدة: ${n}` : "كل الطلاب لهم روابط صالحة."); }
                catch (e) { setNote(errorOf(e)); } finally { setBusy(false); }
            }}>{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Link2 className="w-4 h-4"/>}إنشاء الروابط</button>
            <button disabled={!linkOf.size} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-qatar-maroon text-qatar-maroon text-sm font-bold disabled:opacity-40" onClick={() => void exportExcel()}>
                <Download className="w-4 h-4"/>Excel للإرسال</button>
            {note && <p role="status" className="w-full text-sm text-slate-600">{note}</p>}
            <p className="w-full text-xs text-slate-500">الملف فيه لكل طالب: الاسم والشعبة والرقم الشخصي ورقم ولي الأمر ونص الرسالة بالرابط. الطلاب الجدد أو الروابط المنتهية يأخذون رابطًا جديدًا عند الضغط مرة أخرى.</p>
        </div>
        <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {data.students.map((s: any) => {
                const l: any = linkOf.get(s._id);
                return <li key={s._id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="font-bold text-slate-800 flex-1">{s.fullName}</span>
                    <span className="text-slate-500 w-16">{s.className}</span>
                    <span className="text-xs text-slate-500 w-24">{l ? (l.openCount ? `فُتح ${l.openCount}×` : "لم يُفتح") : "بلا رابط"}</span>
                    {l && <a className="text-qatar-maroon" href={reportUrl(l.token)} target="_blank" rel="noreferrer" aria-label={`فتح تقرير ${s.fullName}`}><ExternalLink className="w-4 h-4"/></a>}
                </li>;
            })}
        </ul>
    </div>;
}
