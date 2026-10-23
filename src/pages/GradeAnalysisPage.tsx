import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { useQuery, useMutation, usePlatformSession } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { BANDS, analyzeGrades, checkSheet, readGradeSheet, sectionsOf, type GradeSheet, type Mark } from "../lib/gradeSheet";
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

export function Report({ sheet }: { sheet: GradeSheet }) {
    const max = sheet.maxes[0] || 30;
    const [threshold, setThreshold] = useState(Math.round(max / 3));
    const [track, setTrack] = useState(""), [cls, setCls] = useState(""), [search, setSearch] = useState("");
    const sections = useMemo(() => sectionsOf(sheet), [sheet]);
    const tracks = [...new Set(sections.map(s => s.track))];
    const a = useMemo(() => analyzeGrades(sheet, { threshold, track, cls }), [sheet, threshold, track, cls]);
    const warnings = useMemo(() => checkSheet(sheet), [sheet]);
    const shown = a.subjects.filter(s => s.count > 0).sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0));
    const notEntered = a.subjects.filter(s => s.count === 0).map(s => s.name);
    const found = search.trim() ? a.students.filter(s => s.name.includes(search.trim()) || s.id === search.trim()).slice(0, 8) : [];

    return <div className="sv-report">
        <div className="sv-controls">
            {tracks.length > 1 && <label className="field-label">المسار<select value={track} onChange={e => { setTrack(e.target.value); setCls(""); }}>
                <option value="">كل المسارات</option>{tracks.map(t => <option key={t}>{t}</option>)}</select></label>}
            <label className="field-label">الشعبة<select value={cls} onChange={e => setCls(e.target.value)}>
                <option value="">كل الشعب</option>{sections.filter(s => !track || s.track === track).map(s => <option key={s.cls} value={s.cls}>{s.cls}{tracks.length > 1 ? ` (${s.track})` : ""}</option>)}</select></label>
            <label className="field-label">حد التعثّر (من {max})<input type="number" min={1} max={max} step={0.5} value={threshold} onChange={e => setThreshold(Number(e.target.value) || 1)}/></label>
            <div style={{ alignSelf: "end" }}><button className="button subtle" onClick={() => void exportSheet(sheet, a, threshold, track)}><Download size={16} aria-hidden="true"/>Excel ملوّن</button></div>
        </div>

        <div className="sv-tiles">
            <div><b>{a.students.length}</b><span>عدد الطلاب · الشعب: {a.sections.length}</span></div>
            <div><b>{fmt(a.mean)} <small style={{ fontSize: 13 }}>من {max}</small></b><span>المتوسط العام ({pct(a.mean === null ? null : a.mean / max)})</span></div>
            <div><b>{a.atRisk.length}</b><span>متعثرون: دون {threshold} في مادة أو أكثر</span></div>
            <div><b>{a.barred.length} · {a.absent.length}</b><span>محرومون · غائبون عن اختبار</span></div>
        </div>

        {(warnings.length > 0 || notEntered.length > 0 || a.noMarks.length > 0) && <section className="panel sv-q">
            <header><div><h3>قبل القراءة</h3><small>ما يحتاج مراجعة في الكشف</small></div></header>
            <ul className="sv-answers">
                {notEntered.length > 0 && <li>لم تُرصد درجاتها بعد: <b>{notEntered.join("، ")}</b></li>}
                {a.subjects.filter(s => s.count > 0 && s.partial.length).map(s => <li key={s.name}>«{s.name}» مرصودة لعدد قليل فقط في: {s.partial.join("، ")}</li>)}
                {a.noMarks.length > 0 && <li>طلاب بلا أي درجة ({a.noMarks.length}): {[...new Set(a.noMarks.map(s => s.cls))].map((c, k) => <span key={c}>{k ? "، " : ""}<bdi dir="ltr">{c}</bdi></span>)}</li>}
                {warnings.map(w => <li key={w}>درجة أعلى من الحد: {w}</li>)}
            </ul>
        </section>}

        <section className="panel sv-q">
            <header><div><h3>المواد</h3><small>درجة «{sheet.components[0]}» من {max} · مرتبة من الأعلى متوسطًا</small></div></header>
            <div className="sv-grid-wrap"><table className="sv-grid">
                <thead><tr><th>المادة</th><th>المرصود</th><th>المتوسط</th><th>النسبة</th><th>أعلى</th><th>أدنى</th><th style={{ minWidth: 160 }}>التوزيع</th><th>دون {threshold}</th><th>غائب</th><th>محروم</th></tr></thead>
                <tbody>{shown.map(s => <tr key={s.name}>
                    <th>{s.name}</th><td>{s.count}</td><td className={tone(s.mean === null ? null : s.mean / max)}>{fmt(s.mean)}</td><td>{pct(s.mean === null ? null : s.mean / max)}</td>
                    <td>{fmt(s.high)}</td><td>{fmt(s.low)}</td><td><Distribution bands={s.bands}/></td>
                    <td className={s.below ? "weak" : ""}>{s.below || "—"}</td><td>{s.absent || "—"}</td><td>{s.barred || "—"}</td>
                </tr>)}</tbody>
            </table></div>
            <p className="muted" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>{BANDS.map((b, k) => <span key={b.label}><i style={{ display: "inline-block", width: 10, height: 10, background: BAND_COLORS[k], borderRadius: 2, marginInlineEnd: 4 }}/>{b.label}</span>)}</p>
        </section>

        {a.sections.length > 1 && <section className="panel sv-q">
            <header><div><h3>الشعب حسب المواد</h3><small>متوسط كل شعبة في كل مادة من {max}</small></div></header>
            <div className="sv-grid-wrap"><table className="sv-grid">
                <thead><tr><th>الشعبة</th>{tracks.length > 1 && <th>المسار</th>}{a.subjects.filter(s => s.count > 0).map(s => <th key={s.name} style={{ whiteSpace: "normal", minWidth: 64 }}>{s.name}</th>)}<th>المتوسط</th></tr></thead>
                <tbody>{a.sections.map(sec => <tr key={sec.cls}>
                    <th>{sec.cls} <small className="muted">({sec.count})</small></th>{tracks.length > 1 && <td>{sec.track}</td>}
                    {a.subjects.map((s, k) => s.count > 0 && <td key={s.name} className={tone(sec.means[k] === null ? null : sec.means[k]! / max)}>{fmt(sec.means[k])}</td>)}
                    <td className={`sv-grid-mean ${tone(sec.mean === null ? null : sec.mean / max)}`}>{fmt(sec.mean)}</td>
                </tr>)}</tbody>
            </table></div>
        </section>}

        <StudentList title={`الطلاب المتعثرون (${a.atRisk.length})`} note={`دون ${threshold} من ${max} في مادة أو أكثر — الأكثر موادًا أولًا`} rows={a.atRisk} sheet={sheet} pick={s => s.below}/>
        {a.barred.length > 0 && <StudentList title={`المحرومون (${a.barred.length})`} note="محرومون من الاختبار في مادة أو أكثر" rows={a.barred} sheet={sheet} pick={s => s.barred}/>}
        {a.absent.length > 0 && <StudentList title={`الغائبون عن الاختبار (${a.absent.length})`} note="غابوا عن اختبار مادة أو أكثر" rows={a.absent} sheet={sheet} pick={s => s.absent}/>}

        <section className="panel sv-q">
            <header><div><h3>المتفوقون</h3><small>أعلى نسبة في كل المواد المرصودة (4 مواد على الأقل)</small></div></header>
            <ol className="sv-answers" style={{ listStyle: "none" }}>{a.top.map((s, k) => <li key={s.id + s.name}><b>{k + 1}.</b> {s.name} — {s.cls} — <b>{pct(s.percent)}</b></li>)}</ol>
        </section>

        <section className="panel sv-q">
            <header><div><h3>درجات طالب</h3><small>ابحث بالاسم أو الرقم الشخصي</small></div></header>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم الطالب أو رقمه" aria-label="بحث عن طالب"/>
            {found.map(s => <div key={s.id + s.name} style={{ marginTop: 12 }}>
                <p><b>{s.name}</b> · {s.cls}{s.track && tracks.length > 1 ? ` · ${s.track}` : ""} · النسبة {pct(s.percent)}</p>
                <div className="sv-grid-wrap"><table className="sv-grid">
                    <thead><tr><th>المادة</th>{sheet.components.map((c, k) => <th key={c}>{c} (من {sheet.maxes[k]})</th>)}</tr></thead>
                    <tbody>{sheet.subjects.map((name, si) => s.marks[si].some(m => m !== null) && <tr key={name}>
                        <th>{name}</th>{s.marks[si].map((m, k) => <td key={k} className={typeof m === "string" || (k === 0 && typeof m === "number" && m < threshold) ? "weak" : ""}>{markText(m) || "—"}</td>)}
                    </tr>)}</tbody>
                </table></div>
            </div>)}
        </section>
    </div>;
}

function Distribution({ bands }: { bands: number[] }) {
    const total = bands.reduce((a, b) => a + b, 0) || 1;
    return <span title={BANDS.map((b, k) => `${b.label}: ${bands[k]}`).join(" · ")} style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--ivory)" }}>
        {bands.map((n, k) => n > 0 && <i key={k} style={{ width: `${(n / total) * 100}%`, background: BAND_COLORS[k] }}/>)}
    </span>;
}

function StudentList({ title, note, rows, sheet, pick }: { title: string; note: string; rows: any[]; sheet: GradeSheet; pick: (s: any) => string[] }) {
    const [all, setAll] = useState(false);
    const list = all ? rows : rows.slice(0, 15);
    if (!rows.length) return null;
    return <section className="panel sv-q">
        <header><div><h3>{title}</h3><small>{note}</small></div>
            {rows.length > 15 && <button className="text-button" onClick={() => setAll(!all)}>{all ? "عرض أقل" : `الكل (${rows.length})`}</button>}</header>
        <div className="sv-grid-wrap"><table className="sv-grid">
            <thead><tr><th>الطالب</th><th>الشعبة</th><th>العدد</th><th style={{ textAlign: "right" }}>المواد</th></tr></thead>
            <tbody>{list.map(s => <tr key={s.id + s.name}>
                <th>{s.name}</th><td>{s.cls}</td><td>{pick(s).length}</td>
                <td style={{ textAlign: "right", whiteSpace: "normal" }}>{pick(s).map(name => {
                    const m = s.marks[sheet.subjects.indexOf(name)][0];
                    return `${name} (${markText(m)})`;
                }).join("، ")}</td>
            </tr>)}</tbody>
        </table></div>
    </section>;
}

// The sheets the deputy made by hand: one per track, the original columns,
// marks under the threshold and «غائب»/«محروم» in red — and a summary sheet.
async function exportSheet(sheet: GradeSheet, a: ReturnType<typeof analyzeGrades>, threshold: number, track: string) {
    const sections = sectionsOf(sheet);
    const tracks = [...new Set(sections.map(s => s.track))];
    const groups = (track ? [track] : tracks).map(t => ({ t, students: sheet.students.filter(st => sections.find(s => s.cls === st.cls)?.track === t) }));
    const sheets = groups.map(g => ({ ...g, subjects: sheet.subjects.map((name, s) => ({ name, s })).filter(x => g.students.some(st => st.marks[x.s].some(m => m !== null))) }))
        // a group with no marks at all (11/ESE) has nothing to show
        .filter(g => g.subjects.length).map(g => {
        const subjects = g.subjects;
        const width = sheet.components.length;
        return {
            name: tracks.length > 1 ? `${sheet.grade} (${g.t})` : String(sheet.grade || "الكشف"),
            title: `${sheet.title} — الصف ${sheet.grade}${tracks.length > 1 ? ` — ${g.t}` : ""}`,
            meta: [sheet.period ? `الفترة: ${sheet.period}` : "", `باللون الأحمر: دون ${threshold} في «${sheet.components[0]}»، والغائب والمحروم`].filter(Boolean),
            bands: [[{ label: "", span: 3 }, ...subjects.map(x => ({ label: x.name, span: width }))]],
            columns: [
                { header: "الرقم", width: 14, align: "center" as const },
                { header: "الاسم", width: 30, bold: true },
                { header: "الشعبة", width: 8, align: "center" as const },
                ...subjects.flatMap(() => sheet.components.map(c => ({ header: c, width: 9, align: "center" as const }))),
            ],
            rows: g.students.map(st => [st.id, st.name, st.cls, ...subjects.flatMap(x => st.marks[x.s].map(m => (m === null ? "" : m) as ExcelCell))]),
            tone: (row: ExcelCell[], i: number) => {
                if (i < 3) return undefined;
                const v = row[i];
                if (v === "غائب" || v === "محروم") return "bad" as const;
                return (i - 3) % width === 0 && typeof v === "number" && v < threshold ? "bad" as const : undefined;
            },
            freezeColumns: 2,
            orientation: "landscape" as const,
        };
    });
    const max = sheet.maxes[0] || 30;
    sheets.push({
        name: "ملخص المواد",
        title: `ملخص المواد — الصف ${sheet.grade}${track ? ` — ${track}` : ""}`,
        meta: [`«${sheet.components[0]}» من ${max}`],
        bands: undefined as any,
        columns: [
            { header: "المادة", width: 28, bold: true }, { header: "المرصود", width: 9, align: "center" }, { header: "المتوسط", width: 9, align: "center" },
            { header: "النسبة", width: 9, align: "center" }, { header: "أعلى", width: 8, align: "center" }, { header: "أدنى", width: 8, align: "center" },
            ...BANDS.map(b => ({ header: b.label, width: 9, align: "center" as const })),
            { header: `دون ${threshold}`, width: 9, align: "center" }, { header: "غائب", width: 8, align: "center" }, { header: "محروم", width: 8, align: "center" },
        ] as any,
        rows: a.subjects.filter(s => s.count > 0).map(s => [s.name, s.count, s.mean === null ? "" : Number(s.mean.toFixed(2)), s.mean === null ? "" : `${Math.round((s.mean / max) * 100)}%`, s.high, s.low, ...s.bands, s.below, s.absent, s.barred]),
        tone: ((row: ExcelCell[], i: number) => i === 11 && Number(row[i]) > 0 ? "bad" : undefined) as any,
        freezeColumns: 1,
        orientation: "landscape",
    });
    await downloadWorkbook(`تحليل درجات الصف ${sheet.grade}${track ? ` - ${track}` : ""} - ${sheet.period || "الكشف"}`, sheets as any);
}
