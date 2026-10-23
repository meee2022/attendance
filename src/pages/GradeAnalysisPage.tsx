import { Fragment, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { useQuery, useMutation, usePlatformSession } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { BANDS, STATUS_LABELS, analyzeGrades, checkSheet, readGradeSheet, sectionsOf, type GradeSheet, type Mark, type Status } from "../lib/gradeSheet";
import { downloadWorkbook, type ExcelCell } from "../lib/excelExport";
import "./surveyAnalysis.css";

// «تحليل الدرجات»: a ministry «كشف درجات الشعبة» read and analysed — by
// subject, by section and by student, split by track the way the deputy split
// grade 11 by hand, with marks under the threshold, absences and barred
// students picked out as the coloured sheets did.

const errorOf = (e: any) => typeof e?.data === "string" ? e.data : e?.message || "تعذّر الحفظ. أعد المحاولة.";
const fmt = (x: number | null | undefined, d = 1) => x === null || x === undefined ? "—" : x.toFixed(d).replace(/\.0+$/, "");
const pct = (x: number | null | undefined) => x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;
const tone = (ratio: number | null) => ratio === null ? "" : ratio >= 0.85 ? "good" : ratio >= 0.7 ? "" : ratio >= 0.55 ? "fair" : "weak";
const BAND_COLORS = ["#1f7a4d", "#5c9e74", "#8b8f5a", "#c08a2d", "#b42318"];
const markText = (m: Mark) => m === null ? "" : typeof m === "number" ? fmt(m, 1) : m;

export default function GradeAnalysisPage() {
    const user = usePlatformSession();
    if (user?.role !== "admin" && user?.role !== "deputy") return <p className="p-8 text-center">تحليل الدرجات متاح للنائب الأكاديمي ومسؤول المنصة فقط.</p>;
    return <Connected/>;
}

function Connected() {
    const [params, setParams] = useSearchParams();
    const id = params.get("id");
    const list = useQuery((api as any).gradeAnalyses.list) as any[] | undefined;
    const row = useQuery((api as any).gradeAnalyses.get, id ? { id } : "skip") as any;
    const save = useMutation((api as any).gradeAnalyses.save), remove = useMutation((api as any).gradeAnalyses.remove);
    const [draft, setDraft] = useState<{ sheet: GradeSheet; previous: any } | null>(null);
    const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const input = useRef<HTMLInputElement>(null), target = useRef<any>(null);
    const open = (next: string | null) => setParams(next ? { id: next } : {});

    async function upload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        setBusy(true); setMessage("");
        try {
            if (file.size > 10 * 1024 * 1024) throw new Error("الملف أكبر من 10 ميجابايت.");
            const XLSX = await import("xlsx");
            const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
            // a workbook may hold the whole grade and its tracks as extra sheets: the fullest one is the grade
            const tables = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }) as unknown[][]);
            const sheet = readGradeSheet(tables.sort((a, b) => b.length - a.length)[0], file.name);
            setDraft({ sheet, previous: target.current });
        } catch (err: any) { setMessage(err?.message || "تعذّر قراءة الملف."); }
        finally { setBusy(false); target.current = null; }
    }
    async function persist(sheet: GradeSheet, previous: any) {
        setBusy(true); setMessage("");
        try {
            const next = await save({ data: JSON.stringify(sheet), ...(previous ? { id: previous._id, expectedUpdatedAt: previous.updatedAt } : {}) });
            setDraft(null); open(next); setMessage("تم حفظ الكشف.");
        } catch (err) { setMessage(errorOf(err)); } finally { setBusy(false); }
    }
    const pick = (previous: any) => { target.current = previous; input.current?.click(); };
    const saved: GradeSheet | null = row ? JSON.parse(row.data) : null;

    return <div className="survey-analysis" dir="rtl">
        <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={upload} aria-label="ملف كشف الدرجات"/>
        <header className="page-heading">
            <div><h1>تحليل الدرجات</h1><p>ارفع «كشف درجات الشعبة» كما يُصدَّر من نظام الوزارة — صف كامل في ملف — لتحليله حسب المادة والشعبة والمسار والطالب.</p></div>
            <button className="button primary" disabled={busy} onClick={() => pick(null)}><Upload size={17} aria-hidden="true"/>{busy ? "جارٍ القراءة…" : "استيراد كشف"}</button>
        </header>
        {message && <p role="status" className="sv-message">{message}</p>}
        {draft ? <>
            <section className="panel" style={{ marginBottom: 16 }}>
                <p><b>{draft.sheet.title}</b> · {draft.sheet.period} · الصف {draft.sheet.grade} · {draft.sheet.students.length} طالب · {draft.sheet.subjects.length} مادة</p>
                <p className="muted">راجع التحليل أدناه ثم احفظه. {draft.previous ? "سيحل محل الكشف السابق." : ""}</p>
                <div className="heading-actions" style={{ marginTop: 10 }}>
                    <button className="button primary" disabled={busy} onClick={() => void persist(draft.sheet, draft.previous)}>{busy ? "جارٍ الحفظ…" : "حفظ الكشف"}</button>
                    <button className="button subtle" disabled={busy} onClick={() => setDraft(null)}>إلغاء</button>
                </div>
            </section>
            <Report sheet={draft.sheet}/>
        </> : id ? (row === undefined ? <p role="status">جارٍ التحميل…</p> : saved && <>
            <div className="heading-actions" style={{ marginBottom: 12 }}>
                <button className="text-button" onClick={() => open(null)}>كل الكشوف</button>
                <button className="button subtle" disabled={busy} onClick={() => pick(row)}><RefreshCw size={16} aria-hidden="true"/>تحديث بكشف أحدث</button>
            </div>
            <Report key={row._id + row.updatedAt} sheet={saved}/>
        </>) : list === undefined ? <p role="status">جارٍ التحميل…</p> : list.length ? <div className="sv-library">
            {list.map(s => <article key={s._id}>
                <div><h2><button className="text-button" onClick={() => open(s._id)}>الصف {s.grade} — {s.period || s.title}</button></h2>
                    <p>{s.fileName} · {s.studentCount} طالب · {s.subjectCount} مادة · {new Date(s.updatedAt).toLocaleDateString("ar-QA-u-nu-latn")}</p></div>
                <button className="button subtle" disabled={busy} aria-label={`حذف كشف الصف ${s.grade}`} onClick={async () => {
                    if (!window.confirm(`حذف كشف الصف ${s.grade}؟`)) return;
                    try { await remove({ id: s._id }); } catch (err) { setMessage(errorOf(err)); }
                }}><Trash2 size={16} aria-hidden="true"/></button>
            </article>)}
        </div> : <section className="panel sv-empty"><h2>ابدأ بكشف الدرجات</h2><p>من نظام الوزارة صدّر «كشف درجات الشعبة» للصف كاملًا (Excel)، ثم ارفعه هنا. ارفع ملفًا لكل صف.</p>
            <button className="button primary" disabled={busy} onClick={() => pick(null)}>استيراد أول كشف</button></section>}
    </div>;
}

type Analysis = ReturnType<typeof analyzeGrades>;
type Student = Analysis["students"][number];
type Tab = "overview" | "subjects" | "sections" | "students";
// what the students list shows: a status, optionally within one subject
type StudentFilter = { status: string; subject: string; search: string; sort: string };
const STATUS_TONE: Record<Status, string> = { barred: "weak", fail: "weak", edge: "fair", pass: "", excellent: "good", none: "" };
const STUDENT_FILTERS: [string, string][] = [
    ["", "كل الطلاب"], ["fail", "راسب في مادة أو أكثر"], ["fail2", "راسب في مادتين فأكثر"], ["edge", "على حافة النجاح"],
    ["barred", "محروم"], ["absent", "غائب عن اختبار"], ["passAll", "ناجح في كل المواد"], ["excellent", "متفوق (90% فأكثر)"], ["none", "بلا درجات"],
];

// a mark's colour on the screen and in Excel: under the pass mark, just above it, or not sat
const markTone = (m: Mark, k: number, a: { pass: number; edgeTop: number }) =>
    typeof m === "string" ? "weak" : k === 0 && typeof m === "number" ? (m < a.pass ? "weak" : m < a.edgeTop ? "fair" : "") : "";

export function Report({ sheet }: { sheet: GradeSheet }) {
    const max = sheet.maxes[0] || 30;
    const [pass, setPass] = useState(max / 2);
    const [track, setTrack] = useState(""), [cls, setCls] = useState("");
    const [tab, setTab] = useState<Tab>("overview");
    const [filter, setFilter] = useState<StudentFilter>({ status: "", subject: "", search: "", sort: "weakest" });
    const [openSubject, setOpenSubject] = useState(""), [openSection, setOpenSection] = useState("");
    const top = useRef<HTMLDivElement>(null);
    const sections = useMemo(() => sectionsOf(sheet), [sheet]);
    const tracks = [...new Set(sections.map(s => s.track))];
    const a = useMemo(() => analyzeGrades(sheet, { pass, track, cls }), [sheet, pass, track, cls]);
    const warnings = useMemo(() => checkSheet(sheet), [sheet]);
    // from any card or row straight to the list it names
    const go = (next: Tab, f?: Partial<StudentFilter>, open?: { subject?: string; section?: string }) => {
        setTab(next);
        if (f) setFilter(p => ({ ...p, search: "", subject: "", ...f }));
        if (open?.subject !== undefined) setOpenSubject(open.subject);
        if (open?.section !== undefined) setOpenSection(open.section);
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const counts: Record<Tab, string> = {
        overview: "", subjects: String(a.subjects.filter(s => s.count).length), sections: String(a.sections.length), students: String(a.students.length),
    };

    return <div className="sv-report" ref={top}>
        <div className="sv-controls">
            {tracks.length > 1 && <label className="field-label">المسار<select value={track} onChange={e => { setTrack(e.target.value); setCls(""); }}>
                <option value="">كل المسارات</option>{tracks.map(t => <option key={t}>{t}</option>)}</select></label>}
            <label className="field-label">الشعبة<select value={cls} onChange={e => setCls(e.target.value)}>
                <option value="">كل الشعب</option>{sections.filter(s => !track || s.track === track).map(s => <option key={s.cls} value={s.cls}>{s.cls}{tracks.length > 1 ? ` (${s.track})` : ""}</option>)}</select></label>
            <label className="field-label">حد النجاح (من {max})<input type="number" min={1} max={max} step={0.5} value={pass} onChange={e => setPass(Number(e.target.value) || 1)}/></label>
            <div style={{ alignSelf: "end" }}><button className="button subtle" onClick={() => void exportTracks(sheet, a, track)}><Download size={16} aria-hidden="true"/>Excel ملوّن بالمسارات</button></div>
        </div>
        <p className="muted" style={{ marginTop: -8 }}>
            راسب: دون {fmt(pass)} من {max} في «{sheet.components[0]}» · على حافة النجاح: من {fmt(pass)} إلى أقل من {fmt(a.edgeTop)} · {sheet.period}
        </p>

        <div className="sv-tabs" role="tablist" aria-label="أقسام التحليل">
            {([["overview", "نظرة عامة"], ["subjects", "المواد"], ["sections", "الشعب"], ["students", "الطلاب"]] as [Tab, string][]).map(([k, label]) =>
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-active" : ""} onClick={() => setTab(k)}>
                    {label}{counts[k] && <small>{counts[k]}</small>}
                </button>)}
        </div>

        {tab === "overview" && <Overview sheet={sheet} a={a} warnings={warnings} go={go}/>}
        {tab === "subjects" && <Subjects a={a} open={openSubject} setOpen={setOpenSubject} go={go}/>}
        {tab === "sections" && <Sections sheet={sheet} a={a} tracks={tracks} open={openSection} setOpen={setOpenSection} go={go}/>}
        {tab === "students" && <Students sheet={sheet} a={a} tracks={tracks} filter={filter} setFilter={setFilter}/>}
    </div>;
}

// ── نظرة عامة ────────────────────────────────────────────────────────────
function Overview({ sheet, a, warnings, go }: { sheet: GradeSheet; a: Analysis; warnings: string[]; go: any }) {
    const s = a.summary, max = a.max;
    const marked = a.subjects.filter(x => x.count);
    const bestSub = [...marked].sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0))[0];
    const worstSub = [...marked].sort((x, y) => (x.mean ?? 0) - (y.mean ?? 0))[0];
    const mostFail = [...marked].sort((x, y) => y.fail - x.fail)[0];
    const secs = a.sections.filter(x => x.mean !== null);
    const bestSec = [...secs].sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0))[0];
    const worstSec = [...secs].sort((x, y) => (x.mean ?? 0) - (y.mean ?? 0))[0];
    const notEntered = a.subjects.filter(x => !x.count).map(x => x.name);
    const card = (value: string | number, label: string, onClick?: () => void, t = "") =>
        <button className={`sv-card ${t}`} onClick={onClick} disabled={!onClick}><b>{value}</b><span>{label}</span></button>;
    return <>
        <div className="sv-cards">
            {card(s.students, `طالب في ${a.sections.length} شعبة`, () => go("students", { status: "" }))}
            {card(`${fmt(a.mean)} / ${max}`, `المتوسط العام · ${pct(a.mean === null ? null : a.mean / max)}`)}
            {card(`${s.passAll}`, `ناجحون في كل المواد · ${pct(s.rated ? s.passAll / s.rated : null)}`, () => go("students", { status: "passAll" }), "good")}
            {card(s.failAny, "راسبون في مادة أو أكثر", () => go("students", { status: "fail" }), "weak")}
            {card(s.failTwo, "راسبون في مادتين فأكثر", () => go("students", { status: "fail2" }), "weak")}
            {card(s.edge, "على حافة النجاح", () => go("students", { status: "edge" }), "fair")}
            {card(s.barred, "محرومون", () => go("students", { status: "barred" }), "weak")}
            {card(s.absent, "غائبون عن اختبار", () => go("students", { status: "absent" }), "fair")}
            {card(s.excellent, "متفوقون (90% فأكثر)", () => go("students", { status: "excellent" }), "good")}
        </div>

        <section className="panel sv-q">
            <header><div><h3>توزيع الطلاب حسب الحالة</h3><small>اضغط أي حالة لعرض طلابها</small></div></header>
            <div className="sv-bars" role="list">
                {(["excellent", "pass", "edge", "fail", "barred", "none"] as Status[]).map(st => {
                    const n = a.students.filter(x => x.status === st).length;
                    if (!n) return null;
                    return <button key={st} role="listitem" className="sv-bar" style={{ textAlign: "right" }} onClick={() => go("students", { status: st === "pass" ? "passAll" : st })}>
                        <span className="sv-bar-label">{STATUS_LABELS[st]}</span>
                        <span className="sv-bar-track"><i className={STATUS_TONE[st] === "weak" ? "weak" : STATUS_TONE[st] === "fair" ? "fair" : STATUS_TONE[st] === "good" ? "good" : ""} style={{ width: `${(n / a.students.length) * 100}%` }}/></span>
                        <span className="sv-bar-value"><b>{n}</b> <small>{pct(n / a.students.length)}</small></span>
                    </button>;
                })}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>كل طالب في حالة واحدة بالترتيب: محروم، ثم راسب، ثم على الحافة، ثم ناجح أو متفوق.</p>
        </section>

        {marked.length > 0 && <section className="panel sv-q">
            <header><div><h3>أبرز النتائج</h3><small>اضغط للانتقال إلى التفاصيل</small></div></header>
            <ul className="sv-findings">
                {mostFail?.fail > 0 && <li><button className="text-button" onClick={() => go("subjects", undefined, { subject: mostFail.name })}>
                    أكثر مادة رسوبًا: <b>{mostFail.name}</b> — {mostFail.fail} طالب ({pct(1 - (mostFail.passRate ?? 1))})</button></li>}
                <li><button className="text-button" onClick={() => go("subjects", undefined, { subject: worstSub.name })}>أدنى متوسط: <b>{worstSub.name}</b> — {fmt(worstSub.mean)} من {max}</button></li>
                <li><button className="text-button" onClick={() => go("subjects", undefined, { subject: bestSub.name })}>أعلى متوسط: <b>{bestSub.name}</b> — {fmt(bestSub.mean)} من {max}</button></li>
                {secs.length > 1 && <li><button className="text-button" onClick={() => go("sections", undefined, { section: worstSec.cls })}>أضعف شعبة: <b><bdi>{worstSec.cls}</bdi></b> — متوسط {fmt(worstSec.mean)} · راسبون {worstSec.failing}</button></li>}
                {secs.length > 1 && <li><button className="text-button" onClick={() => go("sections", undefined, { section: bestSec.cls })}>أقوى شعبة: <b><bdi>{bestSec.cls}</bdi></b> — متوسط {fmt(bestSec.mean)}</button></li>}
            </ul>
        </section>}

        {(warnings.length > 0 || notEntered.length > 0 || s.none > 0 || a.subjects.some(x => x.count && x.partial.length)) && <section className="panel sv-q">
            <header><div><h3>قبل القراءة</h3><small>ما يحتاج مراجعة في الكشف</small></div></header>
            <ul className="sv-answers">
                {notEntered.length > 0 && <li>لم تُرصد درجاتها بعد: <b>{notEntered.join("، ")}</b></li>}
                {a.subjects.filter(x => x.count && x.partial.length).map(x => <li key={x.name}>«{x.name}» مرصودة لعدد قليل فقط في: {x.partial.join("، ")}</li>)}
                {s.none > 0 && <li>طلاب بلا أي درجة: {s.none} — {[...new Set(a.students.filter(x => x.status === "none").map(x => x.cls))].map((c, k) => <span key={c}>{k ? "، " : ""}<bdi dir="ltr">{c}</bdi></span>)}</li>}
                {warnings.map(w => <li key={w}>درجة أعلى من الحد: {w}</li>)}
            </ul>
        </section>}
        <p className="muted">{sheet.title} · {sheet.fileName}</p>
    </>;
}

// ── المواد ───────────────────────────────────────────────────────────────
function Subjects({ a, open, setOpen, go }: { a: Analysis; open: string; setOpen: (s: string) => void; go: any }) {
    const max = a.max;
    const rows = a.subjects.filter(s => s.count).sort((x, y) => (y.fail - x.fail) || (x.mean ?? 0) - (y.mean ?? 0));
    return <section className="panel sv-q">
        <header><div><h3>المواد</h3><small>مرتبة من الأكثر رسوبًا · اضغط المادة لتفاصيل الشعب والراسبين</small></div></header>
        <div className="sv-grid-wrap"><table className="sv-grid">
            <thead><tr><th>المادة</th><th>المرصود</th><th>المتوسط</th><th>نسبة النجاح</th><th>راسب</th><th>على الحافة</th><th>غائب</th><th>محروم</th><th>أعلى</th><th>أدنى</th><th style={{ minWidth: 150 }}>التوزيع</th></tr></thead>
            <tbody>{rows.map(s => <Fragment key={s.name}>
                <tr className="sv-row" onClick={() => setOpen(open === s.name ? "" : s.name)} aria-expanded={open === s.name}>
                    <th>{open === s.name ? "▾" : "◂"} {s.name}</th><td>{s.count}</td>
                    <td className={tone(s.mean === null ? null : s.mean / max)}>{fmt(s.mean)}</td>
                    <td className={tone(s.passRate)}>{pct(s.passRate)}</td>
                    <td className={s.fail ? "weak" : ""}>{s.fail || "—"}</td><td className={s.edge ? "fair" : ""}>{s.edge || "—"}</td>
                    <td>{s.absent || "—"}</td><td>{s.barred || "—"}</td><td>{fmt(s.high)}</td><td>{fmt(s.low)}</td><td><Distribution bands={s.bands}/></td>
                </tr>
                {open === s.name && <tr><td colSpan={11} className="sv-detail">
                    <div className="sv-detail-grid">
                        <table className="sv-grid">
                            <thead><tr><th>الشعبة</th><th>المرصود</th><th>المتوسط</th><th>نسبة النجاح</th><th>راسب</th></tr></thead>
                            <tbody>{s.bySection.map(x => <tr key={x.cls}><th><bdi>{x.cls}</bdi></th><td>{x.count}</td><td className={tone(x.mean === null ? null : x.mean / max)}>{fmt(x.mean)}</td><td className={tone(x.passRate)}>{pct(x.passRate)}</td><td className={x.fail ? "weak" : ""}>{x.fail || "—"}</td></tr>)}</tbody>
                        </table>
                        <div>
                            <p><b>الراسبون في {s.name} ({s.fail})</b></p>
                            <ul className="sv-names">{a.students.flatMap(st => st.failed.filter(f => f.s === s.s).map(f => ({ st, mark: f.mark }))).sort((x, y) => (x.mark as number) - (y.mark as number))
                                .map(({ st, mark }) => <li key={st.index}>{st.name} <small>— <bdi>{st.cls}</bdi> — {fmt(mark as number)}</small></li>)}</ul>
                            {s.fail > 0 && <button className="text-button" onClick={() => go("students", { status: "fail", subject: s.name })}>فتحهم في قائمة الطلاب</button>}
                        </div>
                    </div>
                </td></tr>}
            </Fragment>)}</tbody>
        </table></div>
        <p className="muted" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>{BANDS.map((b, k) => <span key={b.label}><i style={{ display: "inline-block", width: 10, height: 10, background: BAND_COLORS[k], borderRadius: 2, marginInlineEnd: 4 }}/>{b.label}</span>)}</p>
    </section>;
}

// ── الشعب ────────────────────────────────────────────────────────────────
function Sections({ sheet, a, tracks, open, setOpen, go }: { sheet: GradeSheet; a: Analysis; tracks: string[]; open: string; setOpen: (s: string) => void; go: any }) {
    const max = a.max;
    const subs = a.subjects.map((s, k) => ({ s, k })).filter(x => x.s.count);
    return <section className="panel sv-q">
        <header><div><h3>الشعب</h3><small>متوسط كل شعبة في كل مادة من {max} · اضغط الشعبة لكشف طلابها</small></div></header>
        <div className="sv-grid-wrap"><table className="sv-grid">
            <thead><tr><th>الشعبة</th>{tracks.length > 1 && <th>المسار</th>}<th>الطلاب</th><th>المتوسط</th><th>نجاح الكل</th><th>راسبون</th><th>محرومون</th>
                {subs.map(({ s }) => <th key={s.name} style={{ whiteSpace: "normal", minWidth: 64 }}>{s.name}</th>)}</tr></thead>
            <tbody>{a.sections.map(sec => <Fragment key={sec.cls}>
                <tr className="sv-row" onClick={() => setOpen(open === sec.cls ? "" : sec.cls)} aria-expanded={open === sec.cls}>
                    <th>{open === sec.cls ? "▾" : "◂"} <bdi>{sec.cls}</bdi></th>{tracks.length > 1 && <td>{sec.track}</td>}<td>{sec.count}</td>
                    <td className={`sv-grid-mean ${tone(sec.mean === null ? null : sec.mean / max)}`}>{fmt(sec.mean)}</td>
                    <td className={tone(sec.passRate)}>{pct(sec.passRate)}</td><td className={sec.failing ? "weak" : ""}>{sec.failing || "—"}</td><td>{sec.barred || "—"}</td>
                    {subs.map(({ s, k }) => <td key={s.name} className={tone(sec.means[k] === null ? null : sec.means[k]! / max)}>{fmt(sec.means[k])}</td>)}
                </tr>
                {open === sec.cls && <tr><td colSpan={99} className="sv-detail">
                    <SectionSheet sheet={sheet} a={a} students={a.students.filter(st => st.cls === sec.cls)}/>
                    <button className="text-button" onClick={() => go("students", { status: "fail" }, {})}>الراسبون في كل الشعب</button>
                </td></tr>}
            </Fragment>)}</tbody>
        </table></div>
    </section>;
}

// One section's students and their marks, weakest first — the coloured sheet on the screen
function SectionSheet({ sheet, a, students }: { sheet: GradeSheet; a: Analysis; students: Student[] }) {
    const subs = sheet.subjects.map((name, s) => ({ name, s })).filter(x => students.some(st => st.marks[x.s][0] !== null));
    const rows = [...students].sort((x, y) => (y.failed.length - x.failed.length) || (x.percent ?? 2) - (y.percent ?? 2));
    return <div className="sv-grid-wrap"><table className="sv-grid">
        <thead><tr><th>الطالب</th><th>النسبة</th><th>الحالة</th>{subs.map(x => <th key={x.name} style={{ whiteSpace: "normal", minWidth: 60 }}>{x.name}</th>)}</tr></thead>
        <tbody>{rows.map(st => <tr key={st.index}>
            <th>{st.name}</th><td>{pct(st.percent)}</td><td className={STATUS_TONE[st.status]}>{STATUS_LABELS[st.status]}</td>
            {subs.map(x => { const m = st.marks[x.s][0]; return <td key={x.name} className={markTone(m, 0, a)}>{markText(m) || "—"}</td>; })}
        </tr>)}</tbody>
    </table></div>;
}

// ── الطلاب ───────────────────────────────────────────────────────────────
function Students({ sheet, a, tracks, filter, setFilter }: { sheet: GradeSheet; a: Analysis; tracks: string[]; filter: StudentFilter; setFilter: (f: StudentFilter) => void }) {
    const [open, setOpen] = useState<number | null>(null);
    const [limit, setLimit] = useState(60);
    const sub = filter.subject ? sheet.subjects.indexOf(filter.subject) : -1;
    const q = filter.search.trim();
    // within one subject the status is read from that subject's mark
    const inSubject = (st: Student) => {
        const m = st.marks[sub]?.[0] ?? null;
        if (m === null) return false;
        switch (filter.status) {
            case "fail": case "fail2": return typeof m === "number" && m < a.pass;
            case "edge": return typeof m === "number" && m >= a.pass && m < a.edgeTop;
            case "barred": return m === "محروم";
            case "absent": return m === "غائب";
            case "passAll": return typeof m === "number" && m >= a.pass;
            case "excellent": return typeof m === "number" && m / a.max >= 0.9;
            default: return true;
        }
    };
    const byStatus = (st: Student) => {
        switch (filter.status) {
            case "fail": return st.failed.length > 0;
            case "fail2": return st.failed.length >= 2;
            case "edge": return st.status === "edge";
            case "barred": return st.barred.length > 0;
            case "absent": return st.absent.length > 0;
            case "passAll": return st.status === "pass" || st.status === "edge" || st.status === "excellent";
            case "excellent": return st.status === "excellent";
            case "none": return st.status === "none";
            default: return true;
        }
    };
    const rows = a.students
        .filter(st => (sub >= 0 ? inSubject(st) : byStatus(st)) && (!q || st.name.includes(q) || st.id === q))
        .sort((x, y) => filter.sort === "name" ? x.name.localeCompare(y.name, "ar")
            : filter.sort === "best" ? (y.percent ?? -1) - (x.percent ?? -1)
            : filter.sort === "section" ? x.cls.localeCompare(y.cls, "ar", { numeric: true }) || x.name.localeCompare(y.name, "ar")
            : filter.sort === "mostFailed" ? y.failed.length - x.failed.length || (x.percent ?? 2) - (y.percent ?? 2)
            : sub >= 0 ? (Number(x.marks[sub][0]) || -1) - (Number(y.marks[sub][0]) || -1)
            : (x.percent ?? 2) - (y.percent ?? 2));
    const label = STUDENT_FILTERS.find(f => f[0] === filter.status)?.[1] ?? "";
    const set = (p: Partial<StudentFilter>) => { setFilter({ ...filter, ...p }); setLimit(60); };

    return <section className="panel sv-q">
        <div className="sv-controls" style={{ marginBottom: 12 }}>
            <label className="field-label">بحث<input value={filter.search} onChange={e => set({ search: e.target.value })} placeholder="اسم الطالب أو رقمه"/></label>
            <label className="field-label">الحالة<select value={filter.status} onChange={e => set({ status: e.target.value })}>
                {STUDENT_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field-label">في مادة<select value={filter.subject} onChange={e => set({ subject: e.target.value })}>
                <option value="">كل المواد</option>{a.subjects.filter(s => s.count).map(s => <option key={s.name}>{s.name}</option>)}</select></label>
            <label className="field-label">الترتيب<select value={filter.sort} onChange={e => set({ sort: e.target.value })}>
                <option value="weakest">الأضعف أولًا</option><option value="mostFailed">الأكثر رسوبًا</option><option value="best">الأعلى نسبة</option>
                <option value="section">حسب الشعبة</option><option value="name">الاسم</option></select></label>
        </div>
        <header><div><h3>{label}{filter.subject ? ` — ${filter.subject}` : ""} ({rows.length})</h3>
            <small>اضغط الطالب لعرض كل درجاته</small></div>
            <button className="button subtle" onClick={() => void exportList(sheet, a, rows, `${label}${filter.subject ? ` - ${filter.subject}` : ""}`)}><Download size={16} aria-hidden="true"/>Excel لهذه القائمة</button>
        </header>
        <div className="sv-grid-wrap"><table className="sv-grid">
            <thead><tr><th>#</th><th>الطالب</th><th>الشعبة</th>{tracks.length > 1 && <th>المسار</th>}{sub >= 0 && <th>{filter.subject}</th>}<th>النسبة</th><th>الحالة</th><th style={{ textAlign: "right" }}>الرسوب والملاحظات</th></tr></thead>
            <tbody>{rows.slice(0, limit).map((st, n) => <Fragment key={st.index}>
                <tr className="sv-row" onClick={() => setOpen(open === st.index ? null : st.index)} aria-expanded={open === st.index}>
                    <td>{n + 1}</td><th>{st.name}</th><td><bdi>{st.cls}</bdi></td>{tracks.length > 1 && <td>{st.track}</td>}
                    {sub >= 0 && <td className={markTone(st.marks[sub][0], 0, a)}>{markText(st.marks[sub][0])}</td>}
                    <td>{pct(st.percent)}</td><td className={STATUS_TONE[st.status]}>{STATUS_LABELS[st.status]}</td>
                    <td style={{ textAlign: "right", whiteSpace: "normal" }}>
                        {st.failed.length > 0 && <span className="sv-tag weak">راسب: {st.failed.map(f => `${f.name} (${fmt(f.mark as number)})`).join("، ")}</span>}
                        {st.edge.length > 0 && <span className="sv-tag fair">على الحافة: {st.edge.map(f => `${f.name} (${fmt(f.mark as number)})`).join("، ")}</span>}
                        {st.barred.length > 0 && <span className="sv-tag weak">محروم: {st.barred.map(f => f.name).join("، ")}</span>}
                        {st.absent.length > 0 && <span className="sv-tag fair">غائب: {st.absent.map(f => f.name).join("، ")}</span>}
                    </td>
                </tr>
                {open === st.index && <tr><td colSpan={99} className="sv-detail">
                    <p>الرقم الشخصي: <bdi>{st.id}</bdi> · عدد المواد المرصودة {st.entered}</p>
                    <div className="sv-grid-wrap"><table className="sv-grid">
                        <thead><tr><th>المادة</th>{sheet.components.map((c, k) => <th key={c}>{c} (من {sheet.maxes[k]})</th>)}</tr></thead>
                        <tbody>{sheet.subjects.map((name, si) => st.marks[si].some(m => m !== null) && <tr key={name}>
                            <th>{name}</th>{st.marks[si].map((m, k) => <td key={k} className={markTone(m, k, a)}>{markText(m) || "—"}</td>)}</tr>)}</tbody>
                    </table></div>
                </td></tr>}
            </Fragment>)}</tbody>
        </table></div>
        {rows.length > limit && <button className="text-button" onClick={() => setLimit(limit + 100)}>عرض المزيد ({rows.length - limit})</button>}
        {!rows.length && <p className="muted">لا يوجد طلاب بهذه الحالة.</p>}
    </section>;
}

function Distribution({ bands }: { bands: number[] }) {
    const total = bands.reduce((a, b) => a + b, 0) || 1;
    return <span title={BANDS.map((b, k) => `${b.label}: ${bands[k]}`).join(" · ")} style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--ivory)" }}>
        {bands.map((n, k) => n > 0 && <i key={k} style={{ width: `${(n / total) * 100}%`, background: BAND_COLORS[k] }}/>)}
    </span>;
}

// ── Excel ────────────────────────────────────────────────────────────────
const excelTone = (a: Analysis) => (row: ExcelCell[], i: number, width: number, from: number) => {
    if (i < from) return undefined;
    const v = row[i];
    if (v === "غائب" || v === "محروم") return "bad" as const;
    if ((i - from) % width !== 0 || typeof v !== "number") return undefined;
    return v < a.pass ? "bad" as const : v < a.edgeTop ? "warn" as const : undefined;
};

// The sheets the deputy made by hand: one per track in the original columns,
// failing and missed marks in red and marks just above the pass mark in amber
async function exportTracks(sheet: GradeSheet, a: Analysis, track: string) {
    const sections = sectionsOf(sheet);
    const tracks = [...new Set(sections.map(s => s.track))];
    const width = sheet.components.length;
    const paint = excelTone(a);
    const sheets: any[] = (track ? [track] : tracks)
        .map(t => {
            const students = sheet.students.filter(st => sections.find(s => s.cls === st.cls)?.track === t);
            return { t, students, subjects: sheet.subjects.map((name, s) => ({ name, s })).filter(x => students.some(st => st.marks[x.s].some(m => m !== null))) };
        })
        // a group with no marks at all (11/ESE) has nothing to show
        .filter(g => g.subjects.length)
        .map(g => ({
            name: tracks.length > 1 ? `${sheet.grade} (${g.t})` : String(sheet.grade || "الكشف"),
            title: `${sheet.title} — الصف ${sheet.grade}${tracks.length > 1 ? ` — ${g.t}` : ""}`,
            meta: [sheet.period ? `الفترة: ${sheet.period}` : "", `الأحمر: راسب (دون ${fmt(a.pass)}) وغائب ومحروم · البرتقالي: على حافة النجاح`].filter(Boolean),
            bands: [[{ label: "", span: 3 }, ...g.subjects.map(x => ({ label: x.name, span: width }))]],
            columns: [
                { header: "الرقم", width: 14, align: "center" }, { header: "الاسم", width: 30, bold: true }, { header: "الشعبة", width: 8, align: "center" },
                ...g.subjects.flatMap(() => sheet.components.map(c => ({ header: c, width: 9, align: "center" }))),
            ],
            rows: g.students.map(st => [st.id, st.name, st.cls, ...g.subjects.flatMap(x => st.marks[x.s].map(m => (m === null ? "" : m) as ExcelCell))]),
            tone: (row: ExcelCell[], i: number) => paint(row, i, width, 3),
            freezeColumns: 2, orientation: "landscape",
        }));
    sheets.push({
        name: "ملخص المواد", title: `ملخص المواد — الصف ${sheet.grade}${track ? ` — ${track}` : ""}`, meta: [`«${sheet.components[0]}» من ${a.max} · حد النجاح ${fmt(a.pass)}`],
        columns: [
            { header: "المادة", width: 28, bold: true }, { header: "المرصود", width: 9, align: "center" }, { header: "المتوسط", width: 9, align: "center" },
            { header: "نسبة النجاح", width: 10, align: "center" }, { header: "راسب", width: 8, align: "center" }, { header: "على الحافة", width: 9, align: "center" },
            { header: "غائب", width: 8, align: "center" }, { header: "محروم", width: 8, align: "center" }, { header: "أعلى", width: 8, align: "center" }, { header: "أدنى", width: 8, align: "center" },
            ...BANDS.map(b => ({ header: b.label, width: 9, align: "center" })),
        ],
        rows: a.subjects.filter(s => s.count).map(s => [s.name, s.count, s.mean === null ? "" : Number(s.mean.toFixed(2)), pct(s.passRate), s.fail, s.edge, s.absent, s.barred, s.high, s.low, ...s.bands]),
        tone: (row: ExcelCell[], i: number) => i === 4 && Number(row[i]) > 0 ? "bad" : i === 5 && Number(row[i]) > 0 ? "warn" : undefined,
        freezeColumns: 1, orientation: "landscape",
    });
    sheets.push({
        name: "الشعب", title: `الشعب — الصف ${sheet.grade}`, meta: [`المتوسط من ${a.max}`],
        columns: [
            { header: "الشعبة", width: 10, bold: true, align: "center" }, { header: "المسار", width: 10, align: "center" }, { header: "الطلاب", width: 8, align: "center" },
            { header: "المتوسط", width: 9, align: "center" }, { header: "نجاح الكل", width: 10, align: "center" }, { header: "راسبون", width: 9, align: "center" }, { header: "محرومون", width: 9, align: "center" },
            ...a.subjects.filter(s => s.count).map(s => ({ header: s.name, width: 11, align: "center" })),
        ],
        rows: a.sections.map(sec => [sec.cls, sec.track, sec.count, sec.mean === null ? "" : Number(sec.mean.toFixed(2)), pct(sec.passRate), sec.failing, sec.barred,
            ...a.subjects.map((s, k) => s.count ? (sec.means[k] === null ? "" : Number(sec.means[k]!.toFixed(1))) : undefined).filter(x => x !== undefined)]),
        tone: (row: ExcelCell[], i: number) => i === 5 && Number(row[i]) > 0 ? "bad" : undefined,
        freezeColumns: 1, orientation: "landscape",
    });
    await downloadWorkbook(`تحليل درجات الصف ${sheet.grade}${track ? ` - ${track}` : ""} - ${sheet.period || "الكشف"}`, sheets);
}

// The list on the screen — the failing students, the barred… — for follow-up
async function exportList(sheet: GradeSheet, a: Analysis, rows: Student[], label: string) {
    const width = sheet.components.length;
    const subjects = sheet.subjects.map((name, s) => ({ name, s })).filter(x => rows.some(st => st.marks[x.s].some(m => m !== null)));
    const paint = excelTone(a);
    await downloadWorkbook(`${label} - الصف ${sheet.grade}`, [{
        name: label.slice(0, 31) || "القائمة",
        title: `${label} — الصف ${sheet.grade} — ${sheet.period}`,
        meta: [`${rows.length} طالب · حد النجاح ${fmt(a.pass)} من ${a.max}`],
        bands: [[{ label: "", span: 6 }, ...subjects.map(x => ({ label: x.name, span: width }))]],
        columns: [
            { header: "الرقم", width: 14, align: "center" }, { header: "الاسم", width: 30, bold: true }, { header: "الشعبة", width: 8, align: "center" },
            { header: "النسبة", width: 8, align: "center" }, { header: "الحالة", width: 12, align: "center" }, { header: "مواد الرسوب", width: 30 },
            ...subjects.flatMap(() => sheet.components.map(c => ({ header: c, width: 9, align: "center" as const }))),
        ],
        rows: rows.map(st => [st.id, st.name, st.cls, pct(st.percent), STATUS_LABELS[st.status], st.failed.map(f => f.name).join("، "),
            ...subjects.flatMap(x => st.marks[x.s].map(m => (m === null ? "" : m) as ExcelCell))]),
        tone: (row: ExcelCell[], i: number) => i === 4 && (row[i] === "راسب" || row[i] === "محروم") ? "bad" : paint(row, i, width, 6),
        freezeColumns: 2, orientation: "landscape",
    } as any]);
}
