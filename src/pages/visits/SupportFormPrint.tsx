import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { dayName, formatDate } from "../../../convex/visitMath";
import { SUPPORT_DOMAIN_LABELS } from "../../../convex/visitCriteria";

// «استمارة الإشراف على أداء معلم التربية الخاصة/ معلم الدعم الإضافي» as the
// Word file «12 - استمارات متابعة قسم التربية الخاصة» lays it out: the school's
// letterhead behind two pages, the same table split where the Word file splits
// it, with the visit written into the cells. Widths are the Word table's own
// (fiftieths of a percent of a 509pt table), fonts and colours its own.

const FONT = `"Sakkal Majalla", "Traditional Arabic", "Amiri", "Noto Naskh Arabic", serif`;
const MAROON = "#8A1538";
const BEIGE = "#ECE9E3";
const LINE = "0.75pt solid #000";
const TABLE_W = 509;
const w = (fiftieths: number) => `${(fiftieths / 5000) * TABLE_W}pt`;

// right to left: المجال, معايير الأداء, 1…5, التوصيات
const COLS = [710, 1797, 169, 184, 171, 184, 184, 1601];
const SCORES = [1, 2, 3, 4, 5];
// page 1 ends after «استثمار وقت الحصة بفاعلية», as in the Word file
const PAGE_ONE_ROWS = 13;
// rows the Word file holds taller than one line
const MIN_HEIGHT: Record<string, number> = { sp11: 32.3, sp13: 30.85, sp14: 30.85, sp15: 26.15, sp16: 32.35, sp17: 32.35, sp18: 44.6 };

// where the letterhead leaves room for the form, on an A4 page in points
const BODY_TOP = 92;
const BODY_HEIGHT = 700;
// A page may shrink this far to keep the Word file's split; past it, rows
// carry on to the next page so long recommendations stay readable
const MIN_SCALE = 0.9;

const cell: CSSProperties = { border: LINE, padding: "0 4pt", fontFamily: FONT, fontSize: "14pt", lineHeight: 1.42, color: "#000", verticalAlign: "middle" };
const label: CSSProperties = { ...cell, background: BEIGE };
const band: CSSProperties = { ...cell, background: MAROON, color: "#fff", textAlign: "center" };

type Criterion = { _id: string; domain: string; text: string; order?: number };

export default function SupportVisitPages({ data }: { data: any }) {
    const { visit, criteria, form } = data;
    const ordered = [...criteria as Criterion[]].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const recs: Record<string, string> = visit.criterionRecs ?? {};
    const role = visit.visitorRole;
    const coordinatorSignature = role === "coordinator" ? form.signatureUrl : null;
    const deputySignature = role === "deputy" ? form.signatureUrl : form.deputyApprovalSignatureUrl;

    // Each page holds items [starts[p], starts[p + 1]): the criteria rows, then
    // one last item for the notes and signatures. A page too tall even at
    // MIN_SCALE hands its last item to the next page, until everything fits.
    const tail = ordered.length;
    const [starts, setStarts] = useState([0, PAGE_ONE_ROWS]);
    const bodies = useRef<(HTMLDivElement | null)[]>([]);
    useLayoutEffect(() => {
        for (let p = 0; p < starts.length; p++) {
            const el = bodies.current[p];
            const end = starts[p + 1] ?? tail + 1;
            if (!el || el.scrollHeight * 72 / 96 <= BODY_HEIGHT / MIN_SCALE || end - starts[p] < 2) continue;
            setStarts(p + 1 < starts.length ? starts.map((s, i) => (i === p + 1 ? s - 1 : s)) : [...starts, end - 1]);
            return;
        }
    });
    // fonts arriving can change every row's height: lay the pages out again
    useLayoutEffect(() => {
        const reset = () => setStarts([0, PAGE_ONE_ROWS]);
        void document.fonts.ready.then(reset);
        window.addEventListener("visit-form-layout", reset);
        return () => window.removeEventListener("visit-form-layout", reset);
    }, []);

    const rows = (list: Criterion[]) => list.map((c, i) => {
        // the domain cell spans its rows on each page; a domain carried over
        // from the page before continues in an empty cell, as in the Word file
        const startsDomain = i === 0 || list[i - 1].domain !== c.domain;
        const span = startsDomain ? list.slice(i).findIndex(x => x.domain !== c.domain) : 0;
        const carried = i === 0 && ordered.indexOf(c) > 0 && ordered[ordered.indexOf(c) - 1].domain === c.domain;
        return (
            <tr key={c._id} style={{ height: `${MIN_HEIGHT[c._id] ?? 20}pt` }}>
                {startsDomain && (
                    <td rowSpan={span === -1 ? list.length - i : span} style={{ ...label, textAlign: "center", padding: "2pt 0" }}>
                        {!carried && <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "inline-block" }}>
                            {SUPPORT_DOMAIN_LABELS[c.domain as keyof typeof SUPPORT_DOMAIN_LABELS] ?? ""}
                        </span>}
                    </td>
                )}
                <td style={{ ...cell, textAlign: "right" }}>{c.text}</td>
                {SCORES.map(s => (
                    <td key={s} style={{ ...cell, padding: 0, textAlign: "center", fontFamily: `"Segoe UI Symbol", "DejaVu Sans", Arial, sans-serif`, fontSize: "11pt" }}>
                        {visit.ratings[c._id] === s ? "✓" : ""}
                    </td>
                ))}
                <td style={{ ...cell, fontSize: "11pt", lineHeight: 1.25, textAlign: "right", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{recs[c._id] ?? ""}</td>
            </tr>
        );
    });

    const colgroup = <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: w(c) }}/>)}</colgroup>;
    const table: CSSProperties = { width: `${TABLE_W}pt`, margin: "0 auto", borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl" };
    const ticked = (on: boolean, text: string) => <>{on && <span style={{ fontFamily: `"Segoe UI Symbol", Arial, sans-serif`, fontSize: "11pt" }}>✓ </span>}{text}</>;

    const pageItems = (p: number) => {
        const from = starts[p], to = starts[p + 1] ?? tail + 1;
        return { list: ordered.slice(from, Math.min(to, tail)), hasTail: to > tail };
    };
    const ending = <>
        <table style={{ ...table, marginTop: "-0.75pt" }}>
            {colgroup}
            <tbody>
                <tr><td colSpan={8} style={{ ...band, textAlign: "right", fontSize: "16pt" }}>ملاحظات وتوصيات عامة</td></tr>
                <tr style={{ height: "39.25pt" }}>
                    <td colSpan={8} style={{ ...cell, fontSize: "13pt", lineHeight: 1.3, whiteSpace: "pre-line", textAlign: "right", verticalAlign: "top", padding: "2pt 6pt", overflowWrap: "anywhere" }}>{visit.notes ?? ""}</td>
                </tr>
            </tbody>
        </table>
        {/* the signature rows, with the Word file's own widths: 1946 · 1602 · 1452 */}
        <table style={{ ...table, marginTop: "-0.75pt" }}>
            <colgroup><col style={{ width: w(1946) }}/><col style={{ width: w(1602) }}/><col style={{ width: w(1452) }}/></colgroup>
            <tbody>
                <tr>{["معلم التربية الخاصة", "منسق التربية الخاصة", "النائب الأكاديمي"].map(t => <td key={t} style={band}>{t}</td>)}</tr>
                <tr style={{ height: "36pt" }}>
                    {[form.teacherSignatureUrl, coordinatorSignature, deputySignature].map((url: string | null, i) => (
                        <td key={i} style={{ ...cell, padding: "2pt 4pt", position: "relative" }}>
                            {url && <img src={url} alt="توقيع" style={{ display: "block", margin: "0 auto", height: "32pt", maxWidth: "100%", objectFit: "contain" }}/>}
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>
        <p style={{ margin: "18pt 0 0", direction: "rtl", textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: "11pt", color: "#000", wordSpacing: "2pt" }}>
            5: ممتاز&emsp;&emsp;&emsp;4: جيد جداً&emsp;&emsp;&emsp;3: جيد&emsp;&emsp;&emsp;2: مقبول&emsp;&emsp;&emsp;1: ضعيف
        </p>
    </>;

    return <>
        <Page bodyRef={el => { bodies.current[0] = el; }}>
            <table style={{ width: "487pt", margin: "0 auto", borderCollapse: "collapse" }}>
                <tbody><tr><td style={{ ...band, fontSize: "20pt", padding: "1pt 4pt" }}>12 - استمارات متابعة قسم التربية الخاصة</td></tr></tbody>
            </table>
            <p style={{ margin: "12pt 0 6pt", textAlign: "center", fontFamily: FONT, fontSize: "14pt", color: "#000" }}>
                استمارة الإشراف على أداء معلم التربية الخاصة/ معلم الدعم الإضافي
            </p>
            {/* المعلومات الأساسية: 1210 · 1650 · 661 · 642 · 837 */}
            <table style={table}>
                <colgroup>{[1210, 1650, 661, 642, 837].map((c, i) => <col key={i} style={{ width: w(c) }}/>)}</colgroup>
                <tbody>
                    <tr style={{ height: "17.7pt" }}><td colSpan={5} style={{ ...band, fontSize: "16pt" }}>المعلومات الأساسية</td></tr>
                    <Info label="اسم المعلم" value={visit.teacherName} label2="اليوم/ التاريخ"
                        value2={<>{dayName(visit.visitDate)}&nbsp;&nbsp;<bdi dir="ltr">{formatDate(visit.visitDate)}</bdi></>}/>
                    <Info label="المادة" value={visit.subjectName} label2="الموضوع" value2={visit.lessonTopic}/>
                    <tr>
                        <td style={label}>الصف</td>
                        <td style={cell}>{visit.className}</td>
                        <td style={label}>نوع الزيارة</td>
                        <td style={label}>{ticked(visit.followUpType === "partial", "جزئية")}</td>
                        <td style={label}>{ticked(visit.followUpType !== "partial", "كلية")}</td>
                    </tr>
                </tbody>
            </table>
            <table style={{ ...table, marginTop: "-0.75pt" }}>
                {colgroup}
                <tbody>
                    <tr><td colSpan={8} style={band}>مجالات الأداء</td></tr>
                    <tr>
                        <td style={{ ...label, textAlign: "center" }}>المجال</td>
                        <td style={{ ...label, textAlign: "center" }}>معايير الأداء</td>
                        {SCORES.map(s => <td key={s} style={{ ...label, padding: 0, textAlign: "center" }}>{s}</td>)}
                        <td style={{ ...label, textAlign: "center" }}>التوصيات</td>
                    </tr>
                    {rows(pageItems(0).list)}
                </tbody>
            </table>
            {pageItems(0).hasTail && ending}
        </Page>
        {starts.slice(1).map((_, i) => {
            const { list, hasTail } = pageItems(i + 1);
            return (
                <Page key={i} bodyRef={el => { bodies.current[i + 1] = el; }}>
                    {list.length > 0 && <table style={table}>{colgroup}<tbody>{rows(list)}</tbody></table>}
                    {hasTail && ending}
                </Page>
            );
        })}
    </>;
}

function Info({ label: l1, value, label2, value2 }: { label: string; value: ReactNode; label2: string; value2: ReactNode }) {
    return (
        <tr>
            <td style={label}>{l1}</td>
            <td style={cell}>{value}</td>
            <td style={label}>{label2}</td>
            <td colSpan={2} style={cell}>{value2}</td>
        </tr>
    );
}

// One A4 page on the letterhead, scaled down a little when its rows run long
// (rarely past MIN_SCALE: only when a single row could not fit a page)
function Page({ children, bodyRef }: { children: ReactNode; bodyRef: (el: HTMLDivElement | null) => void }) {
    const body = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
        const el = body.current;
        if (!el) return;
        const fit = () => {
            el.style.transform = "";
            const height = el.scrollHeight * 72 / 96;
            const k = Math.min(1, BODY_HEIGHT / height);
            el.style.transform = k < 1 ? `scale(${k})` : "";
        };
        fit();
        void document.fonts.ready.then(fit);
        window.addEventListener("beforeprint", fit);
        window.addEventListener("visit-form-layout", fit);
        return () => {
            window.removeEventListener("beforeprint", fit);
            window.removeEventListener("visit-form-layout", fit);
        };
    });
    return (
        <div className="form-page">
            <img src="/forms/support-letterhead.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}/>
            <div ref={el => { body.current = el; bodyRef(el); }} style={{ position: "absolute", top: `${BODY_TOP}pt`, left: 0, right: 0, transformOrigin: "top center" }}>
                {children}
            </div>
        </div>
    );
}
