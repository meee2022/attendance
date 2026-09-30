import { DEFAULT_CRITERIA } from "../../convex/visitCriteria";
import type { Rating } from "../../convex/visitMath";
import { normalizePdfText, proposeVisit } from "./visitImport";

export type PdfPiece = { text: string; x: number; y: number; width: number; height: number; rotated: boolean };
export type PdfPage = { width: number; height: number; pieces: PdfPiece[] };
export type VisitPdfDocument = { text: string; pages: PdfPage[] };
type Setup = Parameters<typeof proposeVisit>[1] & { classes?: { _id: string; name: string }[] };
export const cleanWordPdf = (text: string) => text.normalize("NFKC")
    .replace(/(^|\s)([وفبلك]?)امل/g, "$1$2الم").replace(/األ/g, "الأ").replace(/اإل/g, "الإ").replace(/اال/g, "الا")
    .replace(/(^|\s)هللا(?=\s|$)/g,"$1الله")
    .replace(/[\u200e\u200f\uf020]/g, "").replace(/ـ/g, "");
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
export function regionText(page: PdfPage, box: Box) {
    const lines: { y: number; pieces: PdfPiece[] }[] = [];
    for (const p of piecesIn(page,box).filter(p=>p.width>0 && p.text.trim() && !/^[\uf020\uf050✓✔\s]+$/.test(p.text))) {
        let line = lines.find(l => Math.abs(l.y-p.y)<3);
        if (!line) { line={y:p.y,pieces:[]}; lines.push(line); }
        line.pieces.push(p);
    }
    return cleanWordPdf(lines.sort((a,b)=>a.y-b.y).map(l=>{
        const ordered=l.pieces.sort((a,b)=>b.x-a.x);
        return ordered.map((p,i)=>`${i && ordered[i-1].x-(p.x+p.width)>0.2 ? " " : ""}${p.text}`).join("").trim();
    }).join("\n")).trim();
}

export function proposeLayoutVisit(document: VisitPdfDocument, setup: Setup) {
    const form = { ...proposeVisit(document.text, setup), classId: "", followUpType: "full" as "full" | "partial", deliveryMode: "field" as "field" | "remote" };
    const review = { recognized:false, teacherName:"", supervisorName:"", className:"", teacherSuggestions:[] as string[], supervisorSuggestions:[] as string[], rows:[] as { criterionId:string; text:string; page:number; state:"read"|"conflict"|"empty"|"unmapped"; marks:Rating[] }[], warnings:[] as string[] };
    // Coordinates are only used after both page geometry and all row/column
    // labels prove this is the supported template. Other layouts fail closed.
    const pages = document.pages.map(p=>({...p,pieces:p.pieces.map(t=>({...t,x:t.x*612/p.width,y:t.y*792/p.height,width:t.width*612/p.width,height:t.height*792/p.height}))}));
    let index=0;
    const recognized = pages.length===2 && document.pages.every(p=>Math.abs(p.width/p.height-612/792)<0.01) && document.text.includes("ES-ESA-P11-F2") && pages.every((p,n)=>{
        const columnLabels = headers.every((h,c)=>p.pieces.some(t=>t.rotated && t.x>=columns[n][c] && t.x<columns[n][c+1] && key(t.text)===key(h)));
        const rowLabels = rows[n].slice(0,-1).every((top,i)=>{
            const expected=DEFAULT_CRITERIA[index++];
            return criterionKey(regionText(p,[columns[n][5],top,561.7,rows[n][i+1]]))===criterionKey(expected.text);
        });
        return columnLabels && rowLabels;
    });
    if (!recognized) {
        // Generic, explicit labels may still be useful, but never read unknown table ticks.
        review.warnings.push("لم يُطابق الملف قالب الموجّه المدعوم. راجع البيانات وأدخل التقييمات يدويًا؛ لم تُفسّر علامات الجدول.");
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
    review.warnings.push("راجع نوع المتابعة (كلية/جزئية) وطريقة الزيارة (ميدانية/عن بُعد) مع الأصل قبل الحفظ.");
    return {form,review};
}
