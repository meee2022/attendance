import type { CSSProperties, ReactNode } from "react";
import { EVALUATION_DOMAINS, INDICATORS, LEVELS, yearOnForm, type Indicator } from "../../../convex/evaluationForm";
import { usePages } from "../visits/usePages";

// «استمارة تقييم أداء المعلم» as the school's Word file lays it out: the same
// tables in the same order, with the Word tables' own column widths, row
// heights, colours and line weight (all read from the file, in points).
// The rows flow onto as many A4 pages as they need, as they do in Word.

const FONT = `"Sakkal Majalla", "Traditional Arabic", "Amiri", "Noto Naskh Arabic", serif`;
const MAROON = "#800000";
const LINE = "1.5pt solid #000";
// the page: A4 with the Word file's margins
const PAD = { top: 68.6, right: 37.3, bottom: 21.3, left: 36 };
const BODY_HEIGHT = 841.9 - PAD.top - PAD.bottom;

const cell: CSSProperties = { border: LINE, padding: "0 4pt", fontFamily: FONT, fontSize: "11pt", fontWeight: 700, lineHeight: 1.3, color: "#000", textAlign: "center", verticalAlign: "middle" };
const head: CSSProperties = { ...cell, background: MAROON, color: "#fff" };
const table = (width: number): CSSProperties => ({ width: `${width}pt`, borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl" });
const Cols = ({ widths }: { widths: number[] }) => <colgroup>{widths.map((w, i) => <col key={i} style={{ width: `${w}pt` }}/>)}</colgroup>;
const heading: CSSProperties = { margin: "8pt 0 3pt", fontFamily: FONT, fontSize: "11pt", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3pt", color: "#000" };

// the indicators table: المجال, its title, النسبة, م, المؤشر, المقررة, المستحقة
const IND_COLS = [25, 71, 36, 31.6, 287.4, 35.5, 47.6];
const IND_WIDTH = IND_COLS.reduce((a, b) => a + b, 0);
// row heights the Word file holds, by indicator id
const ROW_HEIGHT: Record<string, number> = { "1.3": 40.1, "1.4": 20.85, "1.5": 21.25, "2.3": 21.9, "2.4": 21.55, "2.5": 21.3, "2.7": 35.55, "4.4": 21.35, "4.5": 21.8, "5.5": 21.55 };
const rowHeight = (i: Indicator) => ROW_HEIGHT[i.id] ?? (i.domain >= 6 ? 25.5 : 28.35);
const shaded = (domain: number) => domain % 2 === 1;
// «م» as the form numbers it
const numberOf = (i: Indicator) => (i.domain === 1 && i.no <= 3 ? `1 ـ ${i.no}` : `${i.no}.${i.domain}`);

const RULES_LEFT = ["-الموظف الذي اتيحت له فرصه تدريب وتخلف عنه دون عذر مقبول .",
    "-الموظف الذي وقع عليه جزاء تأديبي بالخصم من راتبه أو الوقوف عن العمل لمدة تزيد على عشرة أيام أو وقعت عليه جزاءات تجاوز مجموعها الخصم من الراتب أو الوقوف عن العمل خمسة عشر يوماً خلال العام أو أي جزاء آخر آشد .",
    "-الموظف الذي انقطع عن العمل بدون عذر مقبول مدة تزيد على عشرة أيام العام ."];
const RULES_RIGHT = ["-الموظف التي اتيحت له فرصة تدريب خلال العام ولم يجتز  بنجاح.",
    "-الموظف الذي وقع عليه جزاء تأديبي بالخصم من راتبه أو الوقف عن العمل لمدة تزيد على عشرة أيام، أو وقعت عليه جزاءات تجاوز مجموعها الخصم من الراتب أو الوقف عن العمل لمدة تزيد على عشرة أيام خلال العام أو أي جزاء آخر أشد.",
    "-الموظف الذي انقطع عن العمل بدون عذر مقبول مدة تزيد على خمسة أيام خلال العام."];

const three = <T,>(rows: T[], empty: T) => [0, 1, 2].map(i => rows[i] ?? empty);
const dateOf = (at: number) => new Date(at + 3 * 3600_000).toISOString().slice(0, 10).split("-").reverse().join("/");

export default function EvaluationPages({ form }: { form: any }) {
    const complete = INDICATORS.every(i => form.scores[i.id] !== undefined);
    const level = complete ? form.level : "";
    // items: 0 the head of the form, 1…34 the indicators, 35 the total, 36 the end
    const TOTAL = INDICATORS.length + 1, END = TOTAL + 1;
    const { starts, bodyOf } = usePages(END + 1, BODY_HEIGHT, [0]);

    const intro = <>
        {form.version && <p style={{ margin: "0 0 4pt", textAlign: "left", fontFamily: FONT, fontSize: "10pt", fontWeight: 700, color: "#555" }}>
            نسخة المنسق كما أرسلها: {form.version.name} في <bdi>{dateOf(form.version.at)}</bdi> (قبل مراجعة النائب الأكاديمي)
        </p>}
        <p style={{ margin: 0, textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: "11pt", color: "#4A442A", lineHeight: 1.35 }}>
            استمارة تقييم أداء المعلم<br/>العام الاكاديمي ({yearOnForm(form.academicYear)})
        </p>
        <p style={{ margin: "0 0 22pt", textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: "14pt", color: "#000" }}>{form.schoolName}</p>

        <table style={table(488.25)}>
            <Cols widths={[79.1, 143.2, 89.2, 176.75]}/>
            <tbody>
                {[["اسم الموظف", form.teacherName, "الرقم الوظيفي", form.profile.employeeNo],
                  ["الرقم الشخصي", form.profile.personalNo, "تاريخ التعيين", form.profile.hireDate],
                  ["المسمى الوظيفي", form.profile.jobTitle, "الجنسية", form.profile.nationality]].map((r, i) => (
                    <tr key={i} style={{ height: i ? "14.4pt" : "18.15pt" }}>
                        <td style={{ ...head, fontSize: "12pt" }}>{r[0]}</td><td style={{ ...cell, fontSize: "12pt" }}>{r[1]}</td>
                        <td style={{ ...head, fontSize: "12pt" }}>{r[2]}</td><td style={{ ...cell, fontSize: "12pt" }}><bdi>{r[3]}</bdi></td>
                    </tr>
                ))}
            </tbody>
        </table>

        <p style={heading}>الجزاءات التأديبية التي وقعت على الموظف خلال سنة التقييم:</p>
        <table style={table(488.65)}>
            <Cols widths={[15.3, 140.7, 165.45, 167.2]}/>
            <tbody>
                <tr style={{ height: "18.15pt" }}>{["م", "نوع الجزاء", "سبب الجزاء", "تاريخ الجزاء"].map(t => <td key={t} style={{ ...head, fontSize: "9pt", padding: 0 }}>{t}</td>)}</tr>
                {three(form.penalties, { type: "", reason: "", date: "" }).map((p: any, i) => (
                    <tr key={i} style={{ height: "14.4pt" }}>
                        <td style={{ ...cell, fontSize: "9pt", padding: 0, fontWeight: 400 }}>{i + 1}</td>
                        <td style={small}>{p.type}</td><td style={small}>{p.reason}</td><td style={small}>{p.date}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        <p style={heading}>الدورات التدريبة التي حصل عليها الموظف خلال سنة التقييم:</p>
        <table style={table(489.65)}>
            <Cols widths={[21.65, 120.65, 141.75, 99.2, 106.4]}/>
            <tbody>
                <tr style={{ height: "18.15pt" }}>{["م", "اسم الدورة", "مكان الانعقاد", "المدة", "التاريخ"].map(t => <td key={t} style={{ ...head, fontSize: "9pt", padding: 0 }}>{t}</td>)}</tr>
                {three(form.courses, { name: "", place: "", duration: "", date: "" }).map((c: any, i) => (
                    <tr key={i} style={{ height: "14.4pt" }}>
                        <td style={{ ...cell, fontSize: "9pt", padding: 0, fontWeight: 400 }}>{i + 1}</td>
                        <td style={small}>{c.name}</td><td style={small}>{c.place}</td><td style={small}>{c.duration}</td><td style={small}>{c.date}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* wider than the text column in the Word file too: it reaches into the margin */}
        <table style={{ ...table(538.2), marginTop: "10pt" }}>
            <Cols widths={[226.8, 12.3, 11.8, 287.3]}/>
            <tbody>
                <tr style={{ height: "18pt" }}>
                    <td style={{ ...head, textAlign: "right" }}>لا يجوز تقييم أداء الموظف بمستوى أو جيد جداً الفئات التالية:</td>
                    <td style={head}/><td style={head}/>
                    <td style={{ ...head, textAlign: "right" }}>لا يجوز تقييم أداء الموظف بمستوى ممتاز الفئات التالية:</td>
                </tr>
                <tr style={{ height: "113pt" }}>
                    <td style={rules}>{RULES_RIGHT.map(t => <p key={t} style={{ margin: 0 }}>{t}</p>)}</td>
                    <td style={cell}/><td style={cell}/>
                    <td style={rules}>{RULES_LEFT.map(t => <p key={t} style={{ margin: 0 }}>{t}</p>)}</td>
                </tr>
            </tbody>
        </table>
        <p style={{ margin: "4pt 0", fontFamily: FONT, fontSize: "11pt", fontWeight: 700, lineHeight: 1.3, color: "#000", textAlign: "right" }}>
            ملاحظة: يعلن الموظف بنسخة من تقرير تقييم الأداء بمجرد اعتماده ويجوز للموظف أن يتظلم خلال خمسة عشر يوماً من تاريخ عمله ولا يعتبر التقرير نهائياً إلا بعد انقضاء ميعاد التظلم منه أو البت فيه .
        </p>
    </>;

    const ending = <>
        <table style={{ ...table(521.65), marginTop: "-1.5pt" }}>
            <Cols widths={[113.25, 134.65, 85.05, 92.15, 96.55]}/>
            <tbody>
                <tr style={{ height: "14.85pt" }}>{LEVELS.map(l => <td key={l.label} style={{ ...head, fontSize: "12pt" }}>{l.label}</td>)}</tr>
                <tr style={{ height: "17.85pt" }}>{LEVELS.map(l => <td key={l.label} style={cell}>{l.range}</td>)}</tr>
                <tr style={{ height: "25.4pt" }}>{LEVELS.map(l => <td key={l.label} style={cell}>{l.label === level ? level : ""}</td>)}</tr>
            </tbody>
        </table>
        <table style={{ ...table(521.5), marginTop: "12pt" }}>
            <Cols widths={[173.8, 173.85, 173.85]}/>
            <tbody>
                <tr style={{ height: "39pt" }}>
                    <td style={head}>اسم الموظفة</td><td style={head}>توقيع الموظف</td>
                    <td style={head}>تاريخ الاستلام<br/>( تدوين التاريخ في حالة رفض التوقيع )</td>
                </tr>
                <tr style={{ height: "30pt" }}>
                    <td style={cell}>{form.teacherName}</td>
                    <td style={{ ...cell, padding: "1pt 4pt" }}>{form.signatureUrl && <img src={form.signatureUrl} alt="توقيع الموظف" style={{ display: "block", margin: "0 auto", height: "27pt", maxWidth: "100%", objectFit: "contain" }}/>}</td>
                    <td style={cell}><bdi>{form.signedAt ? dateOf(form.signedAt) : ""}</bdi></td>
                </tr>
            </tbody>
        </table>
        <table style={{ ...table(517.8), margin: "12pt auto 0" }}>
            <Cols widths={[248.75, 269.05]}/>
            <tbody>
                <tr style={{ height: "31.35pt" }}><td style={head}>اسم مدير المدرسة</td><td style={head}>توقيع  مدير المدرسة</td></tr>
                <tr style={{ height: "30pt" }}><td style={cell}>{form.principalName}</td><td style={cell}/></tr>
            </tbody>
        </table>
    </>;

    const indicatorRows = (from: number, to: number, withTotal: boolean) => {
        const list = INDICATORS.slice(from, to);
        if (!list.length && !withTotal) return null;
        return (
            <table style={{ ...table(IND_WIDTH), marginTop: from ? 0 : "2pt" }}>
                <Cols widths={IND_COLS}/>
                <tbody>
                    {from === 0 && <tr style={{ height: "34.75pt" }}>
                        {["", "المجال الرئيسي", "النسبة المئوية", "م", "مؤشرات الأداء الفرعية", "الدرجة المقررة", "الدرجة المستحقة"].map((t, i) => <td key={i} style={{ ...head, padding: "0 1pt" }}>{t}</td>)}
                    </tr>}
                    {list.map((ind, i) => {
                        // the domain's cells span its rows on this page; a domain carried
                        // over from the page before continues in empty cells, as in Word
                        const opens = i === 0 || list[i - 1].domain !== ind.domain;
                        const span = list.filter(x => x.domain === ind.domain).length;
                        const fill = shaded(ind.domain) ? "#F2F2F2" : "#fff", d = EVALUATION_DOMAINS[ind.domain - 1];
                        return (
                            <tr key={ind.id} style={{ height: `${rowHeight(ind)}pt` }}>
                                {opens && <>
                                    <td rowSpan={span} style={{ ...cell, background: ind.domain === 7 ? "#fff" : fill, padding: 0 }}>{ind.no === 1 ? ind.domain : ""}</td>
                                    <td rowSpan={span} style={{ ...cell, background: fill, padding: "0 2pt" }}>{ind.no === 1 ? d.title : ""}</td>
                                    <td rowSpan={span} style={{ ...cell, background: fill, padding: 0 }}>{ind.no === 1 ? `${d.percent}%` : ""}</td>
                                </>}
                                <td style={{ ...cell, background: fill, padding: 0 }}>{numberOf(ind)}</td>
                                <td style={{ ...cell, background: fill, textAlign: "right" }}>{ind.id}- {ind.text}</td>
                                <td style={{ ...cell, background: "#943634", color: "#fff", padding: 0 }}>{ind.max}</td>
                                <td style={{ ...cell, background: fill, padding: 0, fontSize: "12pt" }}>{form.scores[ind.id] ?? ""}</td>
                            </tr>
                        );
                    })}
                    {withTotal && <tr style={{ height: "25.5pt" }}>
                        <td colSpan={5} style={head}>مستوى تقييم الأداء</td>
                        <td style={{ ...head, padding: 0 }}>100</td>
                        <td style={{ ...cell, padding: 0, fontSize: "12pt" }}>{complete ? form.total : ""}</td>
                    </tr>}
                </tbody>
            </table>
        );
    };

    return <>{starts.map((start, p) => {
        const end = starts[p + 1] ?? END + 1;
        return (
            <Page key={p} bodyRef={bodyOf(p)}>
                {start === 0 && intro}
                {indicatorRows(Math.max(0, start - 1), Math.min(end - 1, INDICATORS.length), start <= TOTAL && end > TOTAL)}
                {end > END && ending}
            </Page>
        );
    })}</>;
}

const small: CSSProperties = { ...cell, fontSize: "10pt", fontWeight: 400, padding: "0 3pt", overflowWrap: "anywhere" };
const rules: CSSProperties = { ...cell, textAlign: "right", verticalAlign: "top", padding: "2pt 5pt" };

function Page({ children, bodyRef }: { children: ReactNode; bodyRef: (el: HTMLElement | null) => void }) {
    return (
        <div className="form-page">
            <img src="/forms/moe-logo.png" alt="وزارة التربية والتعليم والتعليم العالي"
                style={{ position: "absolute", top: "11.5pt", right: "16pt", width: "166pt", height: "45.5pt", objectFit: "contain", objectPosition: "right center" }}/>
            <div ref={bodyRef} dir="rtl" style={{ position: "absolute", top: `${PAD.top}pt`, right: `${PAD.right}pt`, left: `${PAD.left}pt` }}>
                {children}
            </div>
        </div>
    );
}
