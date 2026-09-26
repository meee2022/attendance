import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSupervisionQuery as useQuery, SupervisionBoundary } from "../../lib/supervisionSession";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import { DOMAINS, dayName, formatDate, type Domain, type Rating, type VisitorRole } from "../../../convex/visitMath";

// «استمارة الإشراف على أداء المعلّم» exactly as the ministry prints it in
// «النماذج المعتمدة للنائب 2026-2027» (pages 10 and 11). The two pages are the
// document itself, exported from Word as vector drawings with the text turned
// into outlines — so the lines, shading, fonts and wording are the ministry's
// own and do not depend on what is installed on the printing machine. The
// visit's details are written into the cells on top of them.
//
// Every position below is in PDF points on an A4 page (595.32 × 841.92), read
// from the document's own table borders.

const PAGE_W = 595.32;
const PAGE_H = 841.92;
const FORM_FONT = `"Sakkal Majalla", "Traditional Arabic", "Amiri", "Noto Naskh Arabic", serif`;

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
const EXPECTED: Record<Domain, number> = { planning: 3, execution: 13, evaluation: 3, management: 4 };

const NOTES: Box = [24.7, 569.9, 277.5, 325.1];
const SIGN_LABEL: Box = [130.3, 290.0, 325.1, 345.2];
const SIGNATURE: Box = [24.7, 130.3, 325.1, 345.2];
const PAGE_NO: Box = [50, 68, 756, 775];

type Row = { page: 1 | 2; y0: number; y1: number };

function criterionRows(): Row[] {
    const rows: Row[] = [];
    for (let i = 0; i + 1 < P1_ROWS.length; i++) rows.push({ page: 1, y0: P1_ROWS[i], y1: P1_ROWS[i + 1] });
    for (let i = 0; i + 1 < P2_ROWS.length; i++) rows.push({ page: 2, y0: P2_ROWS[i], y1: P2_ROWS[i + 1] });
    return rows;
}

// A box drawn just inside a cell's borders, to cover a printed label
const inside = ([x0, x1, y0, y1]: Box, d = 0.8): Box => [x0 + d, x1 - d, y0 + d, y1 - d];

const at = ([x0, x1, y0, y1]: Box): CSSProperties => ({
    position: "absolute",
    left: `${(x0 / PAGE_W) * 100}%`, width: `${((x1 - x0) / PAGE_W) * 100}%`,
    top: `${(y0 / PAGE_H) * 100}%`, height: `${((y1 - y0) / PAGE_H) * 100}%`,
});

// Text centred in a cell, as the form's own labels are
function Cell({ box, size = 13, children, style }: { box: Box; size?: number; children: ReactNode; style?: CSSProperties }) {
    return (
        <div style={{
            ...at(box), display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: FORM_FONT, fontSize: `${size}pt`, fontWeight: 700, lineHeight: 1.1, padding: "0 3pt",
            overflow: "hidden", color: "#000", ...style,
        }}>{children}</div>
    );
}

const Tick = ({ box }: { box: Box }) => (
    <Cell box={box} size={12} style={{ fontFamily: `"Segoe UI Symbol", "DejaVu Sans", Arial, sans-serif`, padding: 0 }}>✓</Cell>
);

// A cell of free text that shrinks until it fits, the way «تقليص للملاءمة»
// does, instead of spilling over the lines of the form
function FitText({ box, text, max = 12, min = 6 }: { box: Box; text: string; max?: number; min?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
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
            textAlign: "right", whiteSpace: "pre-line", overflow: "hidden", color: "#000", direction: "rtl",
        }}>{text}</div>
    );
}

// The recommendation of التقويم sits in a cell the page break cuts in two, as
// in the Word document: what does not fit in the part on page 1 carries on in
// the part on page 2, at the same size.
function useSplit(text: string, first: Box, size = 11) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const [cut, setCut] = useState(words.length);
    useLayoutEffect(() => {
        const probe = document.createElement("div");
        const [x0, x1, y0, y1] = first;
        // measured at print size: 1pt = 96/72 px
        Object.assign(probe.style, {
            position: "fixed", left: "-9999px", top: "0", visibility: "hidden", boxSizing: "border-box",
            width: `${(x1 - x0) * 96 / 72}px`, fontFamily: FORM_FONT, fontSize: `${size}pt`, lineHeight: "1.15",
            padding: "2pt 4pt", whiteSpace: "pre-line", direction: "rtl",
        });
        document.body.appendChild(probe);
        const room = (y1 - y0) * 96 / 72;
        let lo = 0, hi = words.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            probe.textContent = words.slice(0, mid).join(" ");
            if (probe.scrollHeight <= room + 1) lo = mid; else hi = mid - 1;
        }
        probe.remove();
        setCut(lo);
    }, [text]);
    return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")] as const;
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

    const printed = useRef(false);
    useEffect(() => {
        if (!data?.visit) return;
        const v = data.visit;
        const role = ({ coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" } as Record<string, string>)[v.visitorRole];
        document.title = `${v.recordNo ?? ""} - ${v.subjectName}    ${v.teacherName} زيارة رقم ${v.visitNumber || ""} من قبل ${role}`.trim();
        if (params.get("autoprint") === "1" && !printed.current) {
            printed.current = true;
            setTimeout(() => window.print(), 800);
        }
    }, [data]);

    if (data === undefined) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الاستمارة…</p>;
    if (!data) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">الزيارة غير موجودة.</p>;

    return <OfficialVisitForm data={data}/>;
}

export function OfficialVisitForm({ data, toolbar = true }: { data: any; toolbar?: boolean }) {
    const { visit, criteria, form } = data;
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
    const ticks = (page: 1 | 2) => placed.filter(p => p.row.page === page).flatMap(({ c, row }) => {
        const r = visit.ratings[c._id];
        const col = RATING_X.find(([v]) => v === r);
        return col ? [<Tick key={c._id} box={[col[1], col[2], row.y0, row.y1]}/>] : [];
    });

    const delivery = visit.deliveryMode ?? "field";
    const evalBox1: Box = [...REC_X, P1_ROWS[16], P1_ROWS[18]];
    const evalBox2: Box = [...REC_X, P2_ROWS[0], P2_ROWS[1]];
    // Line breaks typed by the visitor are kept only when it all fits on page 1
    const [evalHead, evalTail] = useSplit(recs.evaluation, evalBox1);

    return (
        <div dir="rtl" className="vfp">
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
                .form-page > img.form-bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
            `}</style>

            {toolbar && <div className="no-print p-3 flex gap-2 items-center justify-center flex-wrap">
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة / حفظ PDF
                </button>
                {visit.status !== "submitted" && (
                    <span className="text-xs font-bold text-amber-700">مسودة — لم تُعتمد بعد</span>
                )}
                {!standard && (
                    <span className="text-xs font-bold text-amber-700">
                        عدد المعايير في هذه الزيارة يختلف عن النموذج المعتمد (3 · 13 · 3 · 4) — راجع المعايير من الإعدادات.
                    </span>
                )}
            </div>}

            {/* Page 1 */}
            <div className="form-page">
                <img className="form-bg" src="/forms/visit-form-p1.svg" alt=""/>

                <Cell box={INFO.school}>{form.schoolName}</Cell>
                <Cell box={INFO.date}>
                    <span>{dayName(visit.visitDate)}</span>&nbsp;&nbsp;<bdi dir="ltr">{formatDate(visit.visitDate)}</bdi>
                </Cell>
                <Cell box={INFO.subject}>{visit.subjectName}</Cell>
                <Cell box={INFO.className}>{visit.className}</Cell>
                <Cell box={INFO.topic} size={visit.lessonTopic?.length > 28 ? 11 : 13}>{visit.lessonTopic}</Cell>
                {role !== "deputy" && (
                    <Cell box={inside(INFO.visitorLabel)} size={14} style={{ background: "#ECE9E3", fontWeight: 400 }}>
                        {VISITOR_TITLE[role]}
                    </Cell>
                )}
                <Cell box={INFO.visitor}>{visitorName}</Cell>
                <Cell box={INFO.teacher} size={visit.teacherName?.length > 24 ? 11 : 13}>{visit.teacherName}</Cell>

                {delivery === "field" ? <Tick box={INFO.field}/> : <Tick box={INFO.remote}/>}
                {visit.followUpType === "partial" ? <Tick box={INFO.partial}/> : <Tick box={INFO.full}/>}
                {delivery === "remote" && visit.streamMode === "merged" && <Tick box={INFO.merged}/>}
                {delivery === "remote" && visit.streamMode === "unmerged" && <Tick box={INFO.unmerged}/>}

                {ticks(1)}

                {/* التخطيط · تنفيذ الدرس · التقويم (its first two rows) */}
                <FitText box={[...REC_X, P1_ROWS[0], P1_ROWS[3]]} text={recs.planning}/>
                <FitText box={[...REC_X, P1_ROWS[3], P1_ROWS[16]]} text={recs.execution}/>
                {evalTail
                    ? <FitText box={evalBox1} text={evalHead} max={11}/>
                    : <FitText box={evalBox1} text={recs.evaluation}/>}

                <Cell box={PAGE_NO} size={12}>1</Cell>
            </div>

            {/* Page 2 */}
            <div className="form-page">
                <img className="form-bg" src="/forms/visit-form-p2.svg" alt=""/>

                {ticks(2)}
                <FitText box={evalBox2} text={evalTail} max={11}/>
                <FitText box={[...REC_X, P2_ROWS[1], P2_ROWS[5]]} text={recs.management}/>
                <FitText box={NOTES} text={String(visit.notes ?? "")} max={13}/>

                {role !== "deputy" && (
                    <Cell box={inside(SIGN_LABEL)} size={14} style={{ background: "#DDDDDD", fontWeight: 400 }}>
                        توقيع {VISITOR_TITLE[role]}
                    </Cell>
                )}

                {role === "deputy" && form.signatureUrl && (
                    // A signature is taller than the row: it sits centred on the
                    // cell and crosses its lines, as a pen signature would
                    <div style={{ ...at([SIGNATURE[0], SIGNATURE[1], SIGNATURE[2] - 9, SIGNATURE[3] + 9]), display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={form.signatureUrl} alt=""
                            style={{ maxWidth: "88%", maxHeight: "100%", objectFit: "contain", display: "block" }}/>
                    </div>
                )}

                <Cell box={PAGE_NO} size={12}>2</Cell>
            </div>
        </div>
    );
}
