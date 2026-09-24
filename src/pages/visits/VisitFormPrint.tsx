import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import { DOMAINS, DOMAIN_LABELS, RATING_SCALE, dayName, formatDate, type VisitorRole } from "../../../convex/visitMath";

// «استمارة الإشراف على أداء المعلّم» as the ministry workbook prints it
// (print area B1:P40 of the «<subject> - coordinator» sheets): the same rows,
// the same merged cells, the rating columns written vertically, the
// recommendations merged per domain, and the signature row that differs by
// visitor type. Column widths and row heights are the workbook's own.
//
// The wording, the school, the academic year and the deputy's name come from
// the snapshot frozen when the visit was submitted, so a later change in the
// settings never rewrites an old form.

// Excel column widths (characters) → pixels, B..O
const COL_WIDTHS = [6, 5, 36.45, 14.54, 5.18, 5.18, 5.18, 5.18, 5.18, 5.82, 8.43, 5.82, 8.43, 7.54]
    .map(w => Math.round(w * 7 + 5));
const COLS = "BCDEFGHIJKLMNO".split("");
const col = (letter: string) => COLS.indexOf(letter);
const span = (from: string, to: string) => col(to) - col(from) + 1;

// Row heights in points, as set in the sheet
const ROW_PT: Record<number, number> = {
    1: 15, 2: 15, 3: 15, 4: 15, 5: 23.25, 6: 25.5, 7: 24, 8: 21, 9: 12, 10: 120, 11: 33.75,
    34: 27, 35: 18, 36: 18, 37: 18, 38: 17.15, 39: 21.75, 40: 36,
};
const rowPt = (r: number) => ROW_PT[r] ?? 23.25;

const FORM_FONT = `"Sakkal Majalla", "Traditional Arabic", "Amiri", "Noto Naskh Arabic", serif`;
const CALIBRI = `Calibri, "Segoe UI", Arial, sans-serif`;
const HEADING = `"PT Bold Heading", "Sakkal Majalla", "Traditional Arabic", serif`;

const cell: CSSProperties = { border: "1px solid #000", padding: "0 4px", verticalAlign: "middle", textAlign: "center" };
const bold = (size: number, family = FORM_FONT): CSSProperties => ({ fontFamily: family, fontSize: `${size}pt`, fontWeight: 700 });
const vertical: CSSProperties = { writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "normal", margin: "0 auto" };

// Long recommendations shrink inside their cell instead of breaking the page,
// the way «تقليص للملاءمة» does in Excel
function fitText(text: string, rows: number): CSSProperties {
    const perRow = 26;                                  // characters a row holds at 14pt
    const room = Math.max(1, rows) * perRow * 3;
    const size = text.length <= room ? 14 : Math.max(8, Math.floor(14 * Math.sqrt(room / text.length)));
    return { fontFamily: CALIBRI, fontSize: `${size}pt`, textAlign: "right", verticalAlign: "top", whiteSpace: "pre-line", lineHeight: 1.25, padding: "4px 6px" };
}

export default function VisitFormPrint() {
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

    const { visit, criteria, form } = data;
    const role: VisitorRole = visit.visitorRole;
    const rows = 11;                                   // first criterion row
    const byDomain = DOMAINS.map(d => ({ domain: d, list: criteria.filter((c: any) => c.domain === d) }));

    // Row numbers per criterion and the merged ranges of the domain/recommendation columns
    let r = rows;
    const layout = byDomain.map(({ domain, list }) => {
        const start = r;
        r += list.length;
        return { domain, list, start, end: r - 1 };
    });
    const lastCriterionRow = r - 1;
    const recGroups = [
        { key: "planningRec", start: layout[0].start, end: layout[0].end },
        { key: "executionRec", start: layout[1].start, end: layout[1].end },
        { key: "evalMgmtRec", start: layout[2].start, end: lastCriterionRow },
    ];

    const tick = (on: boolean) => (on ? <span style={{ fontFamily: "Segoe UI Symbol, Arial", fontWeight: 700, fontSize: "14pt" }}>✓</span> : null);
    const signatureName = role === "deputy" ? (form.deputyName || visit.visitorName) : visit.visitorName;

    return (
        <div dir="rtl" className="vfp">
            <style>{`
                @page { size: A4 portrait; margin: 6mm 12mm 6mm 12mm; }
                @media print {
                    .no-print, .skip-link { display: none !important; }
                    html, body { background: #fff !important; }
                    /* the app frame keeps a full-height padded shell around print routes */
                    #main-content { padding: 0 !important; margin: 0 !important; max-width: none !important; }
                    .min-h-screen { min-height: 0 !important; }
                    .vfp { background: #fff; min-height: 0 !important; }
                    .sheet { zoom: 0.69; box-shadow: none !important; margin: 0 !important; break-after: avoid; }
                }
                .vfp { background: #e2e8f0; min-height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .sheet { background: #fff; width: ${COL_WIDTHS.reduce((a, b) => a + b, 0) + 24}px; margin: 16px auto; padding: 8px 12px; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
                .sheet table { border-collapse: collapse; table-layout: fixed; width: ${COL_WIDTHS.reduce((a, b) => a + b, 0)}px; color: #000; }
            `}</style>

            <div className="no-print p-3 flex gap-2 items-center justify-center">
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة / حفظ PDF
                </button>
                {visit.status !== "submitted" && (
                    <span className="text-xs font-bold text-amber-700">مسودة — لم تُعتمد بعد</span>
                )}
            </div>

            <div className="sheet">
                {/* Header — the school's official band, replaceable from the settings */}
                {form.headerUrl ? (
                    <img src={form.headerUrl} alt="" style={{ width: "100%", display: "block", marginBottom: 6 }}/>
                ) : (
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", marginBottom: 6,
                        background: "linear-gradient(90deg,#5C1523,#8a3a48 60%,#e8d6d9)", color: "#fff", borderRadius: 6,
                    }}>
                        <div style={bold(15)}>{form.schoolName}</div>
                        <div style={{ ...bold(11), textAlign: "left", lineHeight: 1.3 }}>
                            وزارة التربية والتعليم والتعليم العالي<br/>
                            <span style={{ fontFamily: CALIBRI, fontSize: "8pt", fontWeight: 400 }}>Ministry of Education and Higher Education</span>
                        </div>
                    </div>
                )}

                <table>
                    <colgroup>{COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }}/>)}</colgroup>
                    <tbody>
                        <tr style={{ height: `${rowPt(1) + rowPt(2)}pt` }}>
                            <td colSpan={14} style={{ ...bold(26), textAlign: "center" }}>
                                استمارة الإشراف على أداء المعلّم - العام الأكاديميّ {form.academicYear}
                            </td>
                        </tr>
                        <tr style={{ height: `${rowPt(3) + rowPt(4)}pt` }}>
                            <td colSpan={14} style={{ ...bold(20), textAlign: "center" }}>المعلومات الأساسية</td>
                        </tr>

                        {/* Row 5: school · day/date · visit number */}
                        <tr style={{ height: `${rowPt(5)}pt` }}>
                            <td colSpan={2} style={{ ...cell, ...bold(14) }}>المدرسة</td>
                            <td style={{ ...cell, ...bold(14) }}>{form.schoolName}</td>
                            <td style={{ ...cell, ...bold(14) }}>اليوم/التاريخ</td>
                            <td colSpan={2} style={{ ...cell, ...bold(14) }}>{dayName(visit.visitDate)}</td>
                            <td colSpan={span("H", "K")} style={{ ...cell, ...bold(14), direction: "ltr" }}>{formatDate(visit.visitDate)}</td>
                            <td colSpan={span("L", "N")} style={{ ...cell, ...bold(14) }}>رقم الزيارة</td>
                            <td style={{ ...cell, ...bold(14) }}>{visit.visitNumber || ""}</td>
                        </tr>
                        {/* Row 6: subject · lesson */}
                        <tr style={{ height: `${rowPt(6)}pt` }}>
                            <td colSpan={2} style={{ ...cell, ...bold(14) }}>المادة</td>
                            <td style={{ ...cell, ...bold(14) }}>{visit.subjectName}</td>
                            <td style={{ ...cell, ...bold(14) }}>الموضوع</td>
                            <td colSpan={10} style={{ ...cell, ...bold(14) }}>{visit.lessonTopic}</td>
                        </tr>
                        {/* Row 7: class · teacher */}
                        <tr style={{ height: `${rowPt(7)}pt` }}>
                            <td colSpan={2} style={{ ...cell, ...bold(14) }}>الصف</td>
                            <td style={{ ...cell, ...bold(14) }}>{visit.className}</td>
                            <td style={{ ...cell, ...bold(14) }}>المعلم</td>
                            <td colSpan={10} style={{ ...cell, ...bold(14) }}>{visit.teacherName}</td>
                        </tr>
                        {/* Row 8: visitor · follow-up type */}
                        <tr style={{ height: `${rowPt(8)}pt` }}>
                            <td colSpan={2} style={{ ...cell, ...bold(14) }}>الزائر</td>
                            <td style={{ ...cell, ...bold(14) }}>{signatureName}</td>
                            <td style={{ ...cell, ...bold(14) }}>نوع المتابعة</td>
                            <td colSpan={5} style={{ ...cell, ...bold(14) }}>كليّة</td>
                            <td style={{ ...cell }}>{tick(visit.followUpType !== "partial")}</td>
                            <td colSpan={3} style={{ ...cell, ...bold(14) }}>جزئيّة</td>
                            <td style={{ ...cell }}>{tick(visit.followUpType === "partial")}</td>
                        </tr>
                        <tr style={{ height: `${rowPt(9)}pt` }}><td colSpan={14}/></tr>

                        {/* Row 10: column heads, rating columns written vertically */}
                        <tr style={{ height: `${rowPt(10)}pt` }}>
                            <td style={{ ...cell, fontFamily: HEADING, fontSize: "14pt" }}><div style={vertical}>المجال</div></td>
                            <td colSpan={3} style={{ ...cell, fontFamily: HEADING, fontSize: "16pt" }}>معايير الأداء</td>
                            {RATING_SCALE.map(s => (
                                <td key={String(s.value)} style={{ ...cell, ...bold(12, CALIBRI), padding: "2px 0" }}>
                                    <div style={vertical}>{s.label}</div>
                                </td>
                            ))}
                            <td colSpan={5} style={{ ...cell, fontFamily: CALIBRI, fontSize: "16pt" }}>التوصيات</td>
                        </tr>

                        {layout.flatMap(({ domain, list, start, end }) => list.map((c: any, i: number) => {
                            const row = start + i;
                            const rating = visit.ratings[c._id];
                            const rec = recGroups.find(g => g.start === row);
                            return (
                                <tr key={c._id} style={{ height: `${rowPt(row)}pt` }}>
                                    {i === 0 && (
                                        <td rowSpan={end - start + 1} style={{ ...cell, fontFamily: HEADING, fontSize: "14pt", fontWeight: 700 }}>
                                            <div style={vertical}>{DOMAIN_LABELS[domain]}</div>
                                        </td>
                                    )}
                                    <td colSpan={3} style={{ ...cell, fontFamily: CALIBRI, fontSize: "13pt", textAlign: "right", lineHeight: 1.15 }}>
                                        {c.text}
                                    </td>
                                    {RATING_SCALE.map(s => <td key={String(s.value)} style={cell}>{tick(rating === s.value)}</td>)}
                                    {rec && (
                                        <td colSpan={5} rowSpan={rec.end - rec.start + 1}
                                            style={{ ...cell, ...fitText(String(visit[rec.key] ?? ""), rec.end - rec.start + 1) }}>
                                            {visit[rec.key] ?? ""}
                                        </td>
                                    )}
                                </tr>
                            );
                        }))}

                        {/* Rows 34-38: general notes */}
                        <tr style={{ height: `${rowPt(34)}pt` }}>
                            <td colSpan={14} style={{ ...cell, fontFamily: HEADING, fontSize: "14pt" }}>ملاحظات وتوصيات عامّة</td>
                        </tr>
                        <tr style={{ height: `${rowPt(35) + rowPt(36) + rowPt(37) + rowPt(38)}pt` }}>
                            <td colSpan={14} style={{ ...cell, ...fitText(visit.notes ?? "", 8), fontFamily: FORM_FONT }}>
                                {visit.notes ?? ""}
                            </td>
                        </tr>

                        <Signatures role={role} teacherName={visit.teacherName} visitorName={signatureName}
                            deputyName={form.deputyName}/>
                    </tbody>
                </table>

                {/* Footer */}
                {form.footerUrl ? (
                    <img src={form.footerUrl} alt="" style={{ width: "100%", display: "block", marginTop: 8 }}/>
                ) : (
                    <div style={{ marginTop: 8, borderTop: "3px solid #5C1523", paddingTop: 4, display: "flex", justifyContent: "space-between", fontFamily: CALIBRI, fontSize: "9pt", color: "#333" }}>
                        <span>تاريخ الطباعة: {formatDate(new Date().toISOString().slice(0, 10))}</span>
                        <span>نظام الإشراف على أداء المعلم{visit.recordNo ? ` · رقم السجل ${visit.recordNo}` : ""}</span>
                        <span>صفحة 1 من 1</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// Rows 39-40 — three blocks for a coordinator's visit (teacher · coordinator ·
// academic deputy), two for a supervisor's or the deputy's own visit.
function Signatures({ role, teacherName, visitorName, deputyName }: {
    role: VisitorRole; teacherName: string; visitorName: string; deputyName: string;
}) {
    const label = (size = 14): CSSProperties => ({ ...cell, fontFamily: CALIBRI, fontSize: `${size}pt`, fontWeight: 700 });
    const name: CSSProperties = { ...cell, fontFamily: FORM_FONT, fontSize: "16pt", fontWeight: 700 };
    const line: CSSProperties = { ...cell, height: "36pt" };

    if (role === "coordinator") {
        return (
            <>
                <tr style={{ height: `${rowPt(39)}pt` }}>
                    <td colSpan={2} rowSpan={2} style={label()}>المعلم</td>
                    <td style={name}>{teacherName}</td>
                    <td rowSpan={2} style={label()}>المنسق</td>
                    <td colSpan={5} style={name}>{visitorName}</td>
                    <td colSpan={2} rowSpan={2} style={{ ...label(12), verticalAlign: "top" }}>نائب المدير للشؤون الأكاديمية</td>
                    <td colSpan={3} style={name}>{deputyName}</td>
                </tr>
                <tr style={{ height: `${rowPt(40)}pt` }}>
                    <td style={line}/>
                    <td colSpan={5} style={line}/>
                    <td colSpan={3} style={line}/>
                </tr>
            </>
        );
    }

    const visitorLabel = role === "supervisor" ? "الموجه" : "نائب المدير للشؤون الأكاديمية";
    const [labelSpan, nameSpan] = role === "supervisor" ? [3, 7] : [5, 5];
    return (
        <>
            <tr style={{ height: `${rowPt(39)}pt` }}>
                <td colSpan={2} rowSpan={2} style={label()}>المعلم</td>
                <td colSpan={2} style={name}>{teacherName}</td>
                <td colSpan={labelSpan} rowSpan={2} style={label()}>{visitorLabel}</td>
                <td colSpan={nameSpan} style={name}>{visitorName}</td>
            </tr>
            <tr style={{ height: `${rowPt(40)}pt` }}>
                <td colSpan={2} style={line}/>
                <td colSpan={nameSpan} style={line}/>
            </tr>
        </>
    );
}
