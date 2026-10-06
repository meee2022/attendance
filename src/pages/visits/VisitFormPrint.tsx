import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, DependencyList } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSupervisionQuery as useQuery, SupervisionBoundary } from "../../lib/supervisionSession";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import { DOMAINS, dayName, formatDate, type Domain, type Rating, type VisitorRole } from "../../../convex/visitMath";
import { STAGE_LABELS, stageOf } from "../../lib/visitStats";

// «استمارة الإشراف على أداء المعلّم» as the ministry prints it in
// «النماذج المعتمدة للنائب 2026-2027» (pages 10 and 11), on one sheet. The two
// pages are the document itself, exported from Word as vector drawings with
// the text turned into outlines — so the lines, shading, fonts and wording are
// the ministry's own and do not depend on what is installed on the printing
// machine. Page 2's rows are joined under page 1's table, the whole is scaled
// to fit one A4 page, and the visit's details are written into the cells.
//
// Every position below is in PDF points, read from the document's own table
// borders: page 1 as is, page 2 moved down by P2_SHIFT.

const PAGE_W = 595.32;
const PAGE_H = 841.92;
const P1_SRC = "/forms/visit-form-2-p1.svg";
const P2_SRC = "/forms/visit-form-3-p2.svg";
const FORM_FONT = `"Sakkal Majalla", "Traditional Arabic", "Amiri", "Noto Naskh Arabic", serif`;

// Web-font loading and print media can change Arabic line wrapping after the
// first render. Refit the text before measuring the complete sheet.
function usePrintLayout(fit: () => void, deps?: DependencyList) {
    useLayoutEffect(() => {
        let active = true;
        fit();
        void document.fonts.ready.then(() => { if (active) fit(); });
        document.fonts.addEventListener("loadingdone", fit);
        window.addEventListener("beforeprint", fit);
        window.addEventListener("visit-form-layout", fit);
        return () => {
            active = false;
            document.fonts.removeEventListener("loadingdone", fit);
            window.removeEventListener("beforeprint", fit);
            window.removeEventListener("visit-form-layout", fit);
        };
    }, deps);
}

export async function prepareOfficialForm(root: HTMLElement) {
    await document.fonts.ready;
    await Promise.all([...root.querySelectorAll("img")].map(img => img.decode()));
    window.dispatchEvent(new Event("visit-form-layout"));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

type Box = [x0: number, x1: number, y0: number, y1: number];

// المعلومات الأساسيّة
const INFO = {
    school: [404.1, 496.7, 111.3, 131.3],
    date: [26.5, 285.9, 111.3, 131.3],
    subject: [404.1, 496.7, 131.3, 151.3],
    className: [26.5, 285.9, 131.3, 151.3],
    topic: [404.1, 496.7, 151.3, 190.9],
    visitorLabel: [285.9, 404.1, 151.3, 190.9],
    visitor: [26.5, 285.9, 151.3, 190.9],
    teacher: [404.1, 496.7, 190.9, 231.1],
    field: [215.0, 245.6, 190.9, 211.0],
    remote: [148.0, 172.9, 190.9, 211.0],
    partial: [81.1, 113.8, 190.9, 211.0],
    full: [26.5, 50.4, 190.9, 211.0],
    merged: [148.0, 215.0, 211.0, 231.1],
    unmerged: [26.5, 50.4, 211.0, 231.1],
} satisfies Record<string, Box>;

// The five rating columns, as printed from right to left
const RATING_X: [Rating, number, number][] = [
    [3, 301.0, 321.7], [2, 280.3, 301.0], [1, 259.6, 280.3], [0, 238.8, 259.6], ["not_measured", 218.2, 238.8],
];
const REC_X: [number, number] = [24.7, 218.2];

// The criteria rows: page 1 holds التخطيط, تنفيذ الدرس and the first two of
// التقويم; page 2 repeats the heading and continues with the third criterion
// of التقويم and الإدارة الصفية.
const P1_ROWS = [352.4, 386.3, 407.2, 428.0, 449.0, 469.7, 490.5, 511.4, 545.3, 566.1, 587.0, 607.8, 628.5,
    649.4, 670.2, 690.9, 711.8, 732.7, 753.6];
const P2_ROWS = [153.3, 174.0, 195.0, 215.8, 236.7, 257.4];
// page 2's first criterion row starts where page 1's table ends
const P2_SHIFT = P1_ROWS[P1_ROWS.length - 1] - P2_ROWS[0];
const p2 = (y: number) => y + P2_SHIFT;
const EXPECTED: Record<Domain, number> = { planning: 3, execution: 13, evaluation: 3, management: 4 };

// The end of page 2 — general notes, the signature row, the note in red — is
// drawn here rather than taken from the page, so the notes grow with their
// text as the Word table row does, and everything below moves down with them.
const TABLE_X: [number, number] = [24.5, 570.1];
const NOTES_TOP = 277.7;
const NOTES_MIN = 47.2;
// the vision and mission lines at the foot of the page
const FOOTER: [number, number] = [770, 810];
const SHEET_MARGIN = 10;

type Row = { page: 1 | 2; y0: number; y1: number };

function criterionRows(): Row[] {
    const rows: Row[] = [];
    for (let i = 0; i + 1 < P1_ROWS.length; i++) rows.push({ page: 1, y0: P1_ROWS[i], y1: P1_ROWS[i + 1] });
    for (let i = 0; i + 1 < P2_ROWS.length; i++) rows.push({ page: 2, y0: p2(P2_ROWS[i]), y1: p2(P2_ROWS[i + 1]) });
    return rows;
}

// A box drawn just inside a cell's borders, to cover a printed label
const inside = ([x0, x1, y0, y1]: Box, d = 0.8): Box => [x0 + d, x1 - d, y0 + d, y1 - d];

const at = ([x0, x1, y0, y1]: Box): CSSProperties => ({
    position: "absolute", left: `${x0}pt`, width: `${x1 - x0}pt`, top: `${y0}pt`, height: `${y1 - y0}pt`,
});

// A slice [y0, y1] of one of the two Word pages, shown at `top` on the sheet
function PageSlice({ src, y0, y1, top }: { src: string; y0: number; y1: number; top: number }) {
    return (
        <div style={{ position: "absolute", left: 0, top: `${top}pt`, width: `${PAGE_W}pt`, height: `${y1 - y0}pt`, overflow: "hidden" }}>
            <img src={src} alt="" style={{ position: "absolute", left: 0, top: `${-y0}pt`, width: `${PAGE_W}pt`, height: `${PAGE_H}pt`, display: "block" }}/>
        </div>
    );
}

// Text centred in a cell, as the form's own labels are; a long name or lesson
// title steps down in size until it fits inside the cell's lines
function Cell({ box, size = 13, children, style }: { box: Box; size?: number; children: ReactNode; style?: CSSProperties }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLSpanElement>(null);
    usePrintLayout(() => {
        const o = outer.current, i = inner.current;
        if (!o || !i) return;
        let s = size;
        i.style.fontSize = `${s}pt`;
        const css = getComputedStyle(o);
        const availableHeight = o.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
        const availableWidth = o.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
        while (s > 5 && (i.scrollHeight > availableHeight + 0.5 || i.scrollWidth > availableWidth + 0.5)) {
            s -= 0.5;
            i.style.fontSize = `${s}pt`;
        }
    });
    return (
        <div ref={outer} style={{
            ...at(box), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: FORM_FONT, fontWeight: 700, lineHeight: 1.2, padding: "1pt 3pt", boxSizing: "border-box",
            overflow: "hidden", overflowWrap: "anywhere", color: "#000", ...style,
        }}><span ref={inner} style={{ fontSize: `${size}pt`, display: "block", width: "100%", flexShrink: 0 }}>{children}</span></div>
    );
}

// The ministry's logo in place of the guide's running header
const LOGO: Box = [374, 568, 8, 46];
const Logo = () => (
    <img src="/forms/moe-logo.png" alt="وزارة التربية والتعليم والتعليم العالي"
        style={{ ...at(LOGO), objectFit: "contain", objectPosition: "right center" }}/>
);

const Tick = ({ box }: { box: Box }) => (
    <Cell box={box} size={12} style={{ fontFamily: `"Segoe UI Symbol", "DejaVu Sans", Arial, sans-serif`, padding: 0 }}>✓</Cell>
);

// A cell of free text that shrinks until it fits, the way «تقليص للملاءمة»
// does, instead of spilling over the lines of the form
function FitText({ box, text, max = 15, min = 6 }: { box: Box; text: string; max?: number; min?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    usePrintLayout(() => {
        const el = ref.current;
        if (!el) return;
        let size = max;
        el.style.fontSize = `${size}pt`;
        while (size > min && el.scrollHeight > el.clientHeight + 1) {
            size -= 0.5;
            el.style.fontSize = `${size}pt`;
        }
    }, [text, max, min]);
    if (!text.trim()) return null;
    return (
        <div ref={ref} style={{
            ...at(box), fontFamily: FORM_FONT, fontSize: `${max}pt`, lineHeight: 1.15, padding: "2pt 4pt",
            textAlign: "right", whiteSpace: "pre-line", overflow: "hidden", overflowWrap: "anywhere", boxSizing: "border-box", color: "#000", direction: "rtl",
        }}>{text}</div>
    );
}

function FormEnd({ role, notes, signatureUrl, teacherSignatureUrl, deputyApproval, deputySignatureUrl }: { role: VisitorRole; notes: string; signatureUrl: string | null; teacherSignatureUrl?: string | null; deputyApproval?: { name: string; at: number }; deputySignatureUrl?: string | null }) {
    const line = "0.5pt solid #000";
    const label: CSSProperties = { background: "#DDDDDD", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FORM_FONT, fontSize: "14pt", color: "#000" };
    return (
        <div style={{ position: "relative", marginRight: `${PAGE_W - TABLE_X[1]}pt`, width: `${TABLE_X[1] - TABLE_X[0]}pt`, direction: "rtl" }}>
            <div style={{
                borderInline: line, borderBottom: line, minHeight: `${NOTES_MIN}pt`, overflowWrap: "anywhere",
                padding: "3pt 6pt", fontFamily: FORM_FONT, fontSize: "13pt", lineHeight: 1.25, whiteSpace: "pre-line", textAlign: "right", color: "#000",
            }}>{notes}</div>
            <div style={{ display: "grid", gridTemplateColumns: "119.7fr 159.5fr 159.1fr 105.6fr", height: "20pt", borderInline: line, borderBottom: line }}>
                <div style={label}>توقيع المعلم</div>
                <div style={{ borderInlineStart: line, position: "relative" }}>
                    {teacherSignatureUrl && (
                        <div style={{ position: "absolute", inset: "-9pt 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img src={teacherSignatureUrl} alt="" style={{ maxWidth: "88%", maxHeight: "100%", objectFit: "contain", display: "block" }}/>
                        </div>
                    )}
                </div>
                <div style={{ ...label, borderInlineStart: line }}>توقيع {VISITOR_TITLE[role]}</div>
                <div style={{ borderInlineStart: line, position: "relative" }}>
                    {signatureUrl && (
                        // a signature is taller than the row: centred on the cell, it crosses its lines as a pen would
                        <div style={{ position: "absolute", inset: "-9pt 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img src={signatureUrl} alt="" style={{ maxWidth: "88%", maxHeight: "100%", objectFit: "contain", display: "block" }}/>
                        </div>
                    )}
                </div>
            </div>
            {role === "coordinator" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "32pt", borderInline: line, borderBottom: line, color: "#000", fontFamily: FORM_FONT }}>
                <div style={{ ...label, fontSize: "12pt" }}>اعتماد وتوقيع النائب الأكاديمي</div>
                <div style={{ borderInlineStart: line, padding: "2pt 5pt", textAlign: "center", fontSize: "10pt" }}>
                    {deputyApproval ? <>
                        <div>{deputyApproval.name} · {new Date(deputyApproval.at).toLocaleDateString("ar-QA", { timeZone: "Asia/Qatar" })}</div>
                        {deputySignatureUrl && <img src={deputySignatureUrl} alt="توقيع النائب الأكاديمي" style={{ height: "24pt", maxWidth: "90%", margin: "0 auto", objectFit: "contain" }}/>}
                    </> : "بانتظار اعتماد النائب الأكاديمي"}
                </div>
            </div>}
            <p style={{ margin: 0, paddingInlineStart: "28.6pt", fontFamily: FORM_FONT, fontSize: "11.04pt", lineHeight: 1.3, color: "#C00000", textAlign: "right" }}>
                يستخدم هذا النموذج من قبل نائب المدير للشؤون الأكاديمية مرة واحدة على الأقل لكل معلم خلال العام الدراسي.
            </p>
        </div>
    );
}

const VISITOR_TITLE: Record<VisitorRole, string> = {
    deputy: "نائب المدير للشؤون الأكاديمية",
    coordinator: "المنسّق",
    supervisor: "الموجّه",
};

export default function VisitFormPrint() { return <SupervisionBoundary><VisitFormPrintContent/></SupervisionBoundary>; }
function VisitFormPrintContent() {
    const { id } = useParams();
    const [params] = useSearchParams();
    // @ts-ignore
    const data = useQuery(api.visits.getVisitForm, id ? { id } : "skip") as any;

    useEffect(() => {
        if (!data?.visit) return;
        const v = data.visit;
        const role = ({ coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" } as Record<string, string>)[v.visitorRole];
        document.title = `${v.recordNo ?? ""} - ${v.subjectName}    ${v.teacherName} زيارة رقم ${v.visitNumber || ""} من قبل ${role}`.trim();
    }, [data]);

    if (data === undefined) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الاستمارة…</p>;
    if (!data) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">الزيارة غير موجودة.</p>;

    return <OfficialVisitForm data={data} autoPrint={params.get("autoprint") === "1"}/>;
}

export function OfficialVisitForm({ data, toolbar = true, autoPrint = false }: { data: any; toolbar?: boolean; autoPrint?: boolean }) {
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const root = useRef<HTMLDivElement>(null);
    const printed = useRef(false);
    const printForm = async () => {
        try {
            if (root.current) await prepareOfficialForm(root.current);
            window.print();
        } catch { setDownloadError("تعذّر تحميل الاستمارة بالكامل. أعد المحاولة قبل الطباعة."); }
    };
    useEffect(() => {
        if (!autoPrint || !root.current || printed.current) return;
        let active = true;
        void prepareOfficialForm(root.current).then(() => {
            if (active && !printed.current) { printed.current = true; window.print(); }
        }).catch(() => { if (active) setDownloadError("تعذّر تحميل الاستمارة بالكامل. أعد المحاولة قبل الطباعة."); });
        return () => { active = false; };
    }, [autoPrint, data]);
    const { visit, criteria, form } = data;
    const downloadPdf = async () => {
        if (downloading) return;
        setDownloading(true);
        setDownloadError("");
        try {
            const { createVisitPdf } = await import("../../lib/visitPdf");
            const url = URL.createObjectURL(await createVisitPdf(data));
            const link = document.createElement("a");
            link.href = url;
            link.download = `استمارة زيارة ${visit.teacherName} ${visit.visitDate}.pdf`.replace(/[<>:"/\\|?*]/g, "-");
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
            setDownloadError("تعذّر تجهيز ملف PDF. تأكد من الاتصال ثم حاول مرة أخرى.");
        } finally {
            setDownloading(false);
        }
    };
    const role: VisitorRole = visit.visitorRole;
    const visitorName = role === "deputy" ? (form.deputyName || visit.visitorName) : visit.visitorName;

    // Criteria in the form's order, each on its printed row
    const ordered = DOMAINS.flatMap(d => criteria
        .filter((c: any) => c.domain === d)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)));
    const rows = criterionRows();
    const standard = DOMAINS.every(d => criteria.filter((c: any) => c.domain === d).length === EXPECTED[d]);
    const placed = ordered.slice(0, rows.length).map((c: any, i: number) => ({ c, row: rows[i] }));

    // Recommendations: one merged cell per domain. Visits recorded before the
    // form had a separate box for الإدارة الصفية keep their joint text under التقويم.
    const recs = {
        planning: String(visit.planningRec ?? ""),
        execution: String(visit.executionRec ?? ""),
        evaluation: String(visit.evalMgmtRec ?? ""),
        management: String(visit.managementRec ?? ""),
    };
    const ticks = placed.flatMap(({ c, row }) => {
        const r = visit.ratings[c._id];
        const col = RATING_X.find(([v]) => v === r);
        return col ? [<Tick key={c._id} box={[col[1], col[2], row.y0, row.y1]}/>] : [];
    });

    const delivery = visit.deliveryMode ?? "field";
    const tableEnd = P1_ROWS[P1_ROWS.length - 1];

    // The joined sheet is taller than A4; it is scaled down to fit one page
    const sheet = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = sheet.current;
        if (!el) return;
        const fit = () => {
            const height = el.scrollHeight * 72 / 96; // px → pt
            const k = Math.min(1, (PAGE_H - 2 * SHEET_MARGIN) / height);
            // Keep centering independent of percentage translations in RTL
            // print layout and in the cloned DOM used for PDF generation.
            el.style.left = `${(PAGE_W * (1 - k)) / 2}pt`;
            el.style.transform = `scale(${k})`;
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        let active = true;
        void document.fonts.ready.then(() => { if (active) fit(); });
        window.addEventListener("beforeprint", fit);
        window.addEventListener("visit-form-layout", fit);
        return () => {
            active = false;
            observer.disconnect();
            window.removeEventListener("beforeprint", fit);
            window.removeEventListener("visit-form-layout", fit);
        };
    });

    return (
        <div ref={root} dir="rtl" className="vfp">
            <style>{`
                @page { size: A4 portrait; margin: 0; }
                @media print {
                    .no-print, .skip-link { display: none !important; }
                    html, body { background: #fff !important; margin: 0 !important; }
                    /* the app frame keeps a full-height padded shell around print routes */
                    #main-content { padding: 0 !important; margin: 0 !important; max-width: none !important; }
                    .min-h-screen { min-height: 0 !important; }
                    .vfp { background: #fff !important; min-height: 0 !important; padding: 0 !important; }
                    .form-page { margin: 0 !important; box-shadow: none !important; }
                }
                .vfp { background: #e2e8f0; min-height: 100vh; padding-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .form-page { position: relative; width: 210mm; height: 297mm; margin: 16px auto; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.12); overflow: hidden; break-after: page; page-break-after: always; }
                .form-page:last-child { break-after: auto; page-break-after: auto; }
                .form-sheet { position: absolute; left: 0; right: auto; top: ${SHEET_MARGIN}pt; width: ${PAGE_W}pt; transform-origin: top left; }
            `}</style>

            {toolbar && <div className="no-print p-3 flex gap-2 items-center justify-center flex-wrap">
                <button onClick={downloadPdf} disabled={downloading} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm disabled:opacity-60">
                    {downloading ? "جاري تجهيز PDF…" : "تنزيل PDF"}
                </button>
                <button onClick={printForm} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة
                </button>
                {downloadError && <p role="alert" className="w-full text-center text-sm text-red-700">{downloadError}</p>}
                {visit.status !== "submitted" && (
                    <span className="text-xs font-bold text-amber-700">{stageOf(visit) === "draft" ? "مسودة — لم تُعتمد بعد" : STAGE_LABELS[stageOf(visit)]}</span>
                )}
                {!standard && (
                    <span className="text-xs font-bold text-amber-700">
                        عدد المعايير في هذه الزيارة يختلف عن النموذج المعتمد (3 · 13 · 3 · 4) — راجع المعايير من الإعدادات.
                    </span>
                )}
            </div>}

            <div className="form-page">
                <div className="form-sheet" ref={sheet}>
                    <PageSlice src={P1_SRC} y0={0} y1={tableEnd + 0.5} top={0}/>
                    <PageSlice src={P2_SRC} y0={P2_ROWS[0] - 0.5} y1={NOTES_TOP + 0.2} top={tableEnd - 0.5}/>
                    {/* page 1's closing line and page 2's opening line inside the merged
                        cells of التقويم — the domain and its recommendation — make them one cell again */}
                    <div style={{ ...at([REC_X[0] + 0.4, REC_X[1] - 0.4, tableEnd - 1.2, tableEnd + 1.2]), background: "#fff", zIndex: 1 }}/>
                    <div style={{ ...at([533.5, 569.5, tableEnd - 1.2, tableEnd + 1.2]), background: "#DDDDDD", zIndex: 1 }}/>
                    {/* the booklet's section tab at the page edge is not part of the form */}
                    <div style={{ ...at([570.4, 582, 574, 602]), background: "#fff" }}/>
                    <Logo/>

                    {/* the cell is already labelled «المدرسة» */}
                    <Cell box={INFO.school}>{String(form.schoolName ?? "").replace(/^\s*مدرسة\s+/, "")}</Cell>
                    <Cell box={INFO.date}>
                        <span>{dayName(visit.visitDate)}</span>&nbsp;&nbsp;<bdi dir="ltr">{formatDate(visit.visitDate)}</bdi>
                    </Cell>
                    <Cell box={INFO.subject}>{visit.subjectName}</Cell>
                    <Cell box={INFO.className}>{visit.className}</Cell>
                    <Cell box={INFO.topic}>{visit.lessonTopic}</Cell>
                    {role !== "deputy" && (
                        <Cell box={inside(INFO.visitorLabel)} size={14} style={{ background: "#ECE9E3", fontWeight: 400 }}>
                            {VISITOR_TITLE[role]}
                        </Cell>
                    )}
                    <Cell box={INFO.visitor}>{visitorName}</Cell>
                    <Cell box={INFO.teacher}>{visit.teacherName}</Cell>

                    {delivery === "field" ? <Tick box={INFO.field}/> : <Tick box={INFO.remote}/>}
                    {visit.followUpType === "partial" ? <Tick box={INFO.partial}/> : <Tick box={INFO.full}/>}
                    {delivery === "remote" && visit.streamMode === "merged" && <Tick box={INFO.merged}/>}
                    {delivery === "remote" && visit.streamMode === "unmerged" && <Tick box={INFO.unmerged}/>}

                    {ticks}

                    <FitText box={[...REC_X, P1_ROWS[0], P1_ROWS[3]]} text={recs.planning}/>
                    <FitText box={[...REC_X, P1_ROWS[3], P1_ROWS[16]]} text={recs.execution}/>
                    <FitText box={[...REC_X, P1_ROWS[16], p2(P2_ROWS[1])]} text={recs.evaluation}/>
                    <FitText box={[...REC_X, p2(P2_ROWS[1]), p2(P2_ROWS[5])]} text={recs.management}/>

                    {/* in the flow from here, so the notes can grow */}
                    <div style={{ height: `${p2(NOTES_TOP)}pt` }}/>
                    <FormEnd role={role} notes={String(visit.notes ?? "")} signatureUrl={role !== "supervisor" ? form.signatureUrl : null} teacherSignatureUrl={form.teacherSignatureUrl} deputyApproval={visit.deputyApproval} deputySignatureUrl={form.deputyApprovalSignatureUrl}/>
                    <div style={{ position: "relative", height: `${FOOTER[1] - FOOTER[0]}pt`, marginTop: "14pt" }}>
                        <PageSlice src={P1_SRC} y0={FOOTER[0]} y1={FOOTER[1]} top={0}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
