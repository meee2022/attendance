import { DEFAULT_CRITERIA } from "../../convex/visitCriteria";
import type { Rating } from "../../convex/visitMath";
import { normalizePdfText, proposeVisit } from "./visitImport";
import { readExcelVisit } from "./visitExcelLayout";

export type PdfPiece = { text: string; x: number; y: number; width: number; height: number; rotated: boolean };
export type PdfPage = { width: number; height: number; pieces: PdfPiece[]; rules?: {left:number;right:number;y:number}[] };
export type VisitPdfDocument = { text: string; pages: PdfPage[] };
type Setup = Parameters<typeof proposeVisit>[1] & { classes?: { _id: string; name: string }[] };
// Word and Excel write some Arabic ligatures to PDF with their letters swapped
// or a letter lost. Only spellings that are never correct Arabic are mended;
// «الطالب» / «الطلاب» cannot be told apart and is left for review.
const WORD_FIXES: [RegExp, string][] = [
    [/عىل/g, "على"], [/(^|[\s(])عل(?=[\s.،:)]|$)/g, "$1على"], [/(^|[\s(])حت(?=[\s.،:)]|$)/g, "$1حتى"],
    [/أعاله/g, "أعلاه"], [/مالحظ/g, "ملاحظ"], [/عالق/g, "علاق"], [/إسالم/g, "إسلام"], [/اسالم/g, "اسلام"],
    [/هللا/g, "الله"],
];
export const cleanWordPdf = (text: string) => WORD_FIXES.reduce((t, [from, to]) => t.replace(from, to), text.normalize("NFKC")
    .replace(/(^|\s)([وفبلك]?)امل/g, "$1$2الم").replace(/األ/g, "الأ").replace(/اإل/g, "الإ").replace(/اال/g, "الا")
    .replace(/[\u200e\u200f\uf020]/g, "").replace(/ـ/g, ""));
const key = (s: string) => normalizePdfText(cleanWordPdf(s)).replace(/[^\p{L}\p{N}]/gu, "");
const criterionKey = (s: string) => key(s).replace(/امل/g, "الم");
type Box = [number, number, number, number];
const rows = [[352.3,379.5,396.8,414,436.5,453.8,476.3,498.8,526.1,548.6,565.9,583.1,605.6,622.9,640.2,657.5,680.3], [198.4,223.1,245.7,268.1,290.7,313.1,335.7,358.1]];
const columns = [[205.6,230.6,255.4,280.2,305.8,333.3], [209.9,234.8,259.6,284.5,309.3,334.6]];
const scores: Rating[] = ["not_measured",0,1,2,3];
const headers = ["لم يتم قياسه","الأدلة غير متوفرة أو محدودة","تتوفر بعض الأدلة","تتوفر معظم الأدلة","الأدلة مستكملة وفاعلة"];

function piecesIn(page: PdfPage, [left,top,right,bottom]: Box) {
    return page.pieces.filter(p => !p.rotated && p.x + p.width / 2 >= left && p.x + p.width / 2 < right && p.y >= top && p.y < bottom);
}
// Word and Excel draw some final letters (ر، ي، ى…) as separate zero-width
// glyphs placed back over their word. Each is put back at the end of the word
// it sits on — the word whose left edge is nearest — or dropped if none is close.
function restoreLooseLetters(pieces: PdfPiece[]) {
    const solid = pieces.filter(p => p.width > 0);
    const text = new Map(solid.map(p => [p, p.text]));
    // compared on the baseline: a zero-width glyph has no height to centre on
    const baseline = (p: PdfPiece) => p.y + p.height / 2;
    for (const g of pieces.filter(p => p.width <= 0 && p.text.trim().length === 1)) {
        // the letter may overlap neighbouring pieces; the nearest word end wins
        let host: PdfPiece | null = null, best = -1, distance = 5.5;
        for (const p of solid) {
            if (Math.abs(baseline(p) - baseline(g)) >= 4 || g.x < p.x - 1 || g.x > p.x + p.width + 1) continue;
            const t = text.get(p)!;
            for (let i = 1; i <= t.length; i++) {
                if ((i < t.length && t[i] !== " ") || t[i - 1] === " ") continue;
                const edge = p.x + p.width * (1 - i / t.length);   // right to left: index i ends here
                if (Math.abs(edge - g.x) < distance) { distance = Math.abs(edge - g.x); best = i; host = p; }
            }
        }
        if (host) { const t = text.get(host)!; text.set(host, t.slice(0, best) + g.text.trim() + t.slice(best)); }
    }
    return solid.map(p => ({ ...p, text: text.get(p)! }));
}

// `restore` is off where text is only compared with known labels, which carry
// the same missing letters
export function regionText(page: PdfPage, box: Box, restore = true) {
    const lines: { y: number; pieces: PdfPiece[] }[] = [];
    for (const p of (restore ? restoreLooseLetters : (x: PdfPiece[]) => x.filter(p => p.width > 0))(piecesIn(page,box).filter(p=>p.text.trim() && !/^[\uf020\uf050✓✔\s]+$/.test(p.text)))) {
        let line = lines.find(l => Math.abs(l.y-p.y)<3);
        if (!line) { line={y:p.y,pieces:[]}; lines.push(line); }
        line.pieces.push(p);
    }
    return cleanWordPdf(lines.sort((a,b)=>a.y-b.y).map(l=>{
        const ordered=l.pieces.sort((a,b)=>b.x-a.x);
        return ordered.map((p,i)=>`${i && ordered[i-1].x-(p.x+p.width)>0.2 ? " " : ""}${p.text}`).join("").trim();
    }).join("\n")).trim();
}

// «عاشر 3», «ثاني عشر 10», «12 / 6 - أدبي» → the class named "10-3", "12-10", "12-6"
const GRADE_WORDS: [RegExp, number][] = [[/(ال)?ثاني عشر/, 12], [/(ال)?حادي عشر/, 11], [/(ال)?عاشر/, 10]];
export function matchClass(name: string, classes: { _id: string; name: string }[]) {
    const text = normalizePdfText(cleanWordPdf(name));
    let grade: number | undefined, rest = text;
    for (const [word, g] of GRADE_WORDS) if (word.test(text)) { grade = g; rest = text.replace(word, " "); break; }
    const numbers = (rest.match(/\d+/g) ?? []).map(Number);
    if (grade === undefined) {
        const at = numbers.findIndex(n => n >= 10 && n <= 12);
        if (at < 0) return "";
        grade = numbers.splice(at, 1)[0];
    }
    const section = numbers.find(n => n >= 1 && n <= 20);
    if (section === undefined) return "";
    const found = classes.filter(c => c.name.replace(/\s/g, "") === `${grade}-${section}`);
    return found.length === 1 ? found[0]._id : "";
}

// «الطلاب» comes out of these PDFs as «الطالب»; which one was meant is for a person to check
const REVIEW_TEXT = ["subjectName", "lessonTopic", "planningRec", "executionRec", "evalMgmtRec", "managementRec", "notes"] as const;
function wordWarnings(form: Record<(typeof REVIEW_TEXT)[number], string>) {
    return REVIEW_TEXT.some(k => /الطالب(?!ة)/.test(form[k] ?? ""))
        ? ["كلمة «الطالب» في النص قد تكون «الطلاب» في الأصل؛ هذه الملفات تكتب الكلمتين بالشكل نفسه. راجعها مقابل الاستمارة."]
        : [];
}

export function proposeLayoutVisit(document: VisitPdfDocument, setup: Setup) {
    const form = { ...proposeVisit(document.text, setup), originalVisitNumber:undefined as number|undefined, visitorRole: "supervisor" as "supervisor"|"coordinator"|"deputy", classId: "", followUpType: "full" as "full" | "partial", deliveryMode: "field" as "field" | "remote" };
    const review = { recognized:false, teacherName:"", supervisorName:"", className:"", teacherSuggestions:[] as string[], supervisorSuggestions:[] as string[], rows:[] as { criterionId:string; text:string; page:number; state:"read"|"conflict"|"empty"|"unmapped"; marks:Rating[] }[], warnings:[] as string[] };
    const excel=readExcelVisit(document);
    if(excel) {
        review.recognized=true;review.teacherName=excel.teacherName;review.supervisorName=excel.visitorName;review.className=excel.className;
        form.visitorRole=excel.visitorRole??'supervisor';
        form.originalVisitNumber=excel.originalVisitNumber;
        const teachers=setup.teachers.filter(t=>key(t.fullName)===key(excel.teacherName));
        form.teacherId=teachers.length===1?teachers[0]._id:'';form.supervisorId='';
        for(const field of ['subjectName','lessonTopic','planningRec','executionRec','evalMgmtRec','managementRec','notes'] as const)form[field]=excel[field];
        const date=new Date(excel.visitDate+'T00:00:00Z');
        form.visitDate=Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===excel.visitDate?excel.visitDate:'';
        form.ratings={};
        for(const row of excel.rows){
            const matched=setup.criteria.filter(c=>criterionKey(c.text)===criterionKey(row.text));
            const criterionId=matched.length===1?matched[0]._id:'';
            const state=!criterionId?'unmapped':row.marks.length>1?'conflict':row.marks.length===0?'empty':'read';
            review.rows.push({criterionId,text:row.text,page:1,state,marks:row.marks});
            if(state==='read')form.ratings[criterionId]=row.marks[0];
        }
        form.classId=matchClass(excel.className,setup.classes??[]);
        review.warnings.push(...wordWarnings(form));
        review.warnings.push('تمت قراءة جدول Excel. راجع اسم الزائر وصفته والصف ونوع المتابعة؛ بعض خطوط العربية في التوصيات تحتاج تصحيحًا بالمقارنة مع الأصل.');
        return {form,review};
    }
    // Coordinates are only used after both page geometry and all row/column
    // labels prove this is the supported template. Other layouts fail closed.
    const pages = document.pages.map(p=>({...p,pieces:p.pieces.map(t=>({...t,x:t.x*612/p.width,y:t.y*792/p.height,width:t.width*612/p.width,height:t.height*792/p.height}))}));
    let index=0;
    const recognized = pages.length===2 && document.pages.every(p=>Math.abs(p.width/p.height-612/792)<0.01) && document.text.includes("ES-ESA-P11-F2") && pages.every((p,n)=>{
        const columnLabels = headers.every((h,c)=>p.pieces.some(t=>t.rotated && t.x>=columns[n][c] && t.x<columns[n][c+1] && key(t.text)===key(h)));
        const rowLabels = rows[n].slice(0,-1).every((top,i)=>{
            const expected=DEFAULT_CRITERIA[index++];
            return criterionKey(regionText(p,[columns[n][5],top,561.7,rows[n][i+1]],false))===criterionKey(expected.text);
        });
        return columnLabels && rowLabels;
    });
    if (!recognized) {
        // Generic, explicit labels may still be useful, but never read unknown table ticks.
        // A form printed from this app has its table drawn as shapes, not text: only the
        // visit's own words and the ticks remain. That visit is already in the register.
        if((document.text.match(/✓/g)??[]).length>=20 && !document.text.includes('ES-ESA-P11-F2'))
            review.warnings.push('يبدو أن هذه الاستمارة مطبوعة من التطبيق نفسه، فالزيارة موجودة غالبًا في سجل الزيارات. تأكد من السجل قبل استيرادها حتى لا تتكرر.');
        review.warnings.push(document.text.trim()?"لم يُطابق الملف القوالب المدعومة. راجع البيانات وأدخل التقييمات يدويًا؛ لم تُفسّر علامات الجدول.":"الملف صور بلا نص قابل للاستخراج؛ أدخل البيانات والتقييمات من المعاينة، أو استخدم PDF مُصدّرًا مباشرة من Word أو Excel.");
        review.rows=setup.criteria.map(c=>({criterionId:c._id,text:c.text,page:1,state:'empty',marks:[]}));
        return {form,review};
    }
    review.recognized=true;
    const p=pages[0];
    review.teacherName=regionText(p,[20,171,307,195]);
    review.supervisorName=regionText(p,[377,195,533,238]);
    review.className=regionText(p,[377,171,533,195]);
    const matchName = (name:string, people:{_id:string;fullName:string}[])=>{
        const exact=people.filter(p=>key(p.fullName)===key(name));
        const tokens=normalizePdfText(cleanWordPdf(name)).split(/\s+/).filter(Boolean);
        const suggested=people.filter(p=>{
            const words=normalizePdfText(p.fullName).split(/\s+/); let start=0;
            return tokens.length>=2 && tokens.every(t=>{const i=words.indexOf(t,start);start=i+1;return i>=0;});
        });
        return {id:exact.length===1?exact[0]._id:"", suggestions:suggested.map(p=>p._id)};
    };
    const teacher=matchName(review.teacherName,setup.teachers), supervisor=matchName(review.supervisorName,setup.visitors.filter(v=>v.role==="supervisor"));
    form.teacherId=teacher.id; review.teacherSuggestions=teacher.suggestions;
    form.supervisorId=supervisor.id; review.supervisorSuggestions=supervisor.suggestions;
    form.subjectName=regionText(p,[377,145.3,533,170.8]).replace(/\n/g," ");
    form.lessonTopic=regionText(p,[20,145.3,307,170.8]).replace(/\n/g," ");
    const dateText=normalizePdfText(regionText(p,[20,121,134,145.3]));
    const m=dateText.match(/\b(20\d\d)-(\d{2})-(\d{2})\b/);
    const date = m ? new Date(`${m[0]}T00:00:00Z`) : null;
    form.visitDate=m && date && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===m[0]?m[0]:"";
    form.planningRec=regionText(p,[20,352.3,205.6,414]);
    form.executionRec=regionText(p,[20,414,205.6,680.3]);
    form.evalMgmtRec=regionText(pages[1],[20,198.4,209.9,268.1]);
    form.managementRec=regionText(pages[1],[20,268.1,209.9,358.1]);
    form.notes=regionText(pages[1],[20,382,592,472.9]);
    form.ratings={}; index=0;
    for (const [n,page] of pages.entries()) for (let r=0;r<rows[n].length-1;r++) {
        const expected=DEFAULT_CRITERIA[index++];
        const matched=setup.criteria.filter(c=>criterionKey(c.text)===criterionKey(expected.text));
        const marks:Rating[]=[];
        for(let c=0;c<5;c++) {
            if(piecesIn(page,[columns[n][c],rows[n][r],columns[n][c+1],rows[n][r+1]]).some(t=>/^[\uf050✓✔]+$/.test(t.text.trim()))) marks.push(scores[c]);
        }
        const criterionId=matched.length===1?matched[0]._id:"";
        const state=!criterionId?"unmapped":marks.length>1?"conflict":marks.length===0?"empty":"read";
        review.rows.push({criterionId,text:expected.text,page:n+1,state,marks});
        if(state==="read") form.ratings[criterionId]=marks[0];
    }
    form.classId=matchClass(review.className,setup.classes??[]);
    review.warnings.push(...wordWarnings(form));
    review.warnings.push("راجع نوع المتابعة (كلية/جزئية) وطريقة الزيارة (ميدانية/عن بُعد) مع الأصل قبل الحفظ.");
    return {form,review};
}
