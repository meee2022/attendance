import { DEFAULT_CRITERIA } from '../../convex/visitCriteria';
import { EXCEL_CRITERION_ALIASES } from './visitExcelAliases';
import { normalizePdfText } from './visitImport';
import { cleanWordPdf, regionText, type VisitPdfDocument } from './visitPdfLayout';
const key=(s:string)=>normalizePdfText(cleanWordPdf(s)).replace(/[^\p{L}\p{N}]/gu,'');
const headers=['لم يتم قياسه','الأدلة غير متوفرة أو محدودة','تتوفر بعض الأدلة','تتوفر معظم الأدلة','الأدلة مستكملة وفاعلة'];
export function readExcelVisit(document:VisitPdfDocument) {
    if(document.pages.length!==1) return null;
    const source=document.pages[0], scale=595.2/source.width;
    if(Math.abs(source.width/source.height-595.2/841.8)>0.01) return null;
    const p={...source,pieces:source.pieces.map(t=>({...t,x:t.x*scale,y:t.y*scale,width:t.width*scale,height:t.height*scale})),rules:source.rules?.map(r=>({left:r.left*scale,right:r.right*scale,y:r.y*scale}))};
    const columns=[210.4,230,249.5,269.1,288.7,308.4];
    if(!headers.every((h,c)=>{
        const text=p.pieces.filter(t=>t.rotated&&t.width>0&&t.x>=columns[c]&&t.x<columns[c+1]).sort((a,b)=>a.y-b.y).map(t=>t.text).join('');
        return key(text)===key(h)||(c===1&&key(text)===key('الأدلة غي متوفرة أو محدودة'));
    })) return null;
    const first=p.pieces.find(t=>key(t.text).startsWith(key('خطة الدرس متوفرة')));
    if(!first) return null;
    const ys=(p.rules??[]).filter(r=>r.left<212&&r.right>518).map(r=>r.y).sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>2);
    let start=-1;for(let i=0;i<ys.length;i++)if(ys[i]<first.y)start=i;
    if(start<0) return null;
    const bounds=ys.slice(start,start+24);
    if(bounds.length!==24) return null;
    const labels=bounds.slice(0,-1).map((y,i)=>regionText(p,[309,y,519,bounds[i+1]]));
    if(!labels.every((text,i)=>[DEFAULT_CRITERIA[i].text,...EXCEL_CRITERION_ALIASES[i]].some(alias=>key(alias)===key(text))))return null;
    // Header rows are located by labels, not by a fixed vertical offset.
    const labelY=(label:string)=>p.pieces.find(t=>!t.rotated&&t.x>500&&key(t.text)===key(label))?.y;
    const subjectY=labelY('المادة'),classY=labelY('الصف'),visitorY=labelY('الزائر'),schoolY=labelY('المدرسة');
    if([subjectY,classY,visitorY,schoolY].some(y=>y===undefined))return null;
    const cell=(x1:number,x2:number,y:number)=>regionText(p,[x1,y-7,x2,y+8]).replace(/\n/g,' ');
    const notesHeader=p.pieces.find(t=>!t.rotated&&t.y>bounds[23]&&[key('ملاحظات وتوصيات عامة'),key('مالحظات وتوصيات عامة')].some(k=>key(t.text).includes(k)));
    const signature=p.pieces.find(t=>!t.rotated&&t.y>(notesHeader?.y??Infinity)&&t.x>500&&key(t.text)===key('المعلم'));
    const notesEnd=signature?Math.max(bounds[23],...ys.filter(y=>y<signature.y)):undefined;
    const deputy=document.text.includes('نائب')&&document.text.includes('األكاديمية');
    const dateParts=p.pieces.filter(t=>!t.rotated&&t.x>188&&t.x<266&&Math.abs(t.y-schoolY!)<5).map(t=>normalizePdfText(t.text)).filter(s=>/^\d+$/.test(s));
    const year=dateParts.find(s=>/^20\d\d$/.test(s));
    const day=cell(189,209,schoolY!),month=cell(210,230,schoolY!);
    let visitDate=year&&/^\d{1,2}$/.test(day)&&/^\d{1,2}$/.test(month)?`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`:'';
    const printedDate=cell(189,269,schoolY!);
    const numeric=printedDate.match(/^(\d{1,2})\/(\d{1,2})\/(20\d\d)$/);
    if(numeric)visitDate=`${numeric[3]}-${numeric[2].padStart(2,'0')}-${numeric[1].padStart(2,'0')}`;
    const rec=(from:number,to:number)=>regionText(p,[72,bounds[from],210,bounds[to]]);
    const separateManagement=(p.rules??[]).some(r=>r.left<74&&r.right>209&&Math.abs(r.y-bounds[19])<1);
    const originalVisitNumber=Number(cell(73,100,schoolY!))||undefined;
    return {originalVisitNumber,teacherName:cell(73,308,classY!),visitorName:cell(364,500,visitorY!),className:cell(364,500,classY!),subjectName:cell(364,500,subjectY!),lessonTopic:cell(73,308,subjectY!),visitDate,
        visitorRole:deputy?'deputy' as const:undefined,
        rows:labels.map((text,i)=>({text:DEFAULT_CRITERIA[i].text,sourceText:text,marks:columns.slice(0,-1).flatMap((left,c)=>p.pieces.some(t=>!t.rotated&&t.x+t.width/2>=left&&t.x+t.width/2<columns[c+1]&&t.y>=bounds[i]&&t.y<bounds[i+1]&&/^[✓✔\uf050]+$/.test(t.text.trim()))?[(['not_measured',0,1,2,3] as const)[c]]:[])})),
        planningRec:rec(0,3),executionRec:rec(3,16),evalMgmtRec:rec(16,separateManagement?19:23),managementRec:separateManagement?rec(19,23):'',notes:notesHeader&&notesEnd?regionText(p,[72,notesHeader.y+8,542,notesEnd]):'',
    };
}
