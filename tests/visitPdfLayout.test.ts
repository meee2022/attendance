import { describe, it, expect } from "vitest";
import { proposeLayoutVisit, regionText, type PdfPiece, type VisitPdfDocument } from "../src/lib/visitPdfLayout";
import { DEFAULT_CRITERIA } from "../convex/visitCriteria";
const bounds=[[352.3,379.5,396.8,414,436.5,453.8,476.3,498.8,526.1,548.6,565.9,583.1,605.6,622.9,640.2,657.5,680.3],[198.4,223.1,245.7,268.1,290.7,313.1,335.7,358.1]];
const columns=[[220,245,270,295,321],[224,249,274,299,324]];
const headers=["لم يتم قياسه","الأدلة غير متوفرة أو محدودة","تتوفر بعض الأدلة","تتوفر معظم الأدلة","الأدلة مستكملة وفاعلة"];
const piece=(text:string,x:number,y:number,width=12,rotated=false):PdfPiece=>({text,x,y,width,height:12,rotated});
const setup={teachers:[{_id:"t",fullName:"أحمد محمد علي"}],visitors:[{_id:"s",fullName:"موجه تجريبي",role:"supervisor"}],criteria:DEFAULT_CRITERIA.map((c,i)=>({...c,_id:String(i)}))};
function fixture():VisitPdfDocument {
 let index=0;
 const pages=bounds.map((ys,n)=>({width:612,height:792,pieces:[...headers.map((h,c)=>piece(h,columns[n][c],n?175:330,60,true)),...ys.slice(0,-1).flatMap((top,r)=>[piece(DEFAULT_CRITERIA[index++].text,350,(top+ys[r+1])/2,200),piece("\uf050",columns[n][4]-5,(top+ys[r+1])/2,10)])]}));
 pages[0].pieces.push(piece("أحمد علي",80,181,100),piece("موجه تجريبي",400,215,100),piece("2026-09-16",25,132,85),piece("اللغة العربية",400,156,95),piece("درس تجريبي",90,156,100),piece("توصية تنفيذ",35,520,130));
 pages[1].pieces.push(piece("\uf050",columns[1][0]-5,256,10),piece("توصية تقويم",35,233,130),piece("توصية إدارة",35,310,130),piece("ملاحظة عامة",250,425,130));
 return {text:"ES-ESA-P11-F2",pages};
}
describe("position-aware ministry PDF import",()=>{
 it("separates cells and 22 ratings, requires name confirmation and leaves conflicting marks unresolved",()=>{
  const result=proposeLayoutVisit(fixture(),setup);
  expect(result.review.recognized).toBe(true);
  expect(result.form).toMatchObject({teacherId:"",supervisorId:"s",visitDate:"2026-09-16",subjectName:"اللغة العربية",lessonTopic:"درس تجريبي",executionRec:"توصية تنفيذ",evalMgmtRec:"توصية تقويم",managementRec:"توصية إدارة",notes:"ملاحظة عامة"});
  expect(result.review.teacherSuggestions).toEqual(["t"]);
  expect(Object.keys(result.form.ratings)).toHaveLength(22);
  expect(result.form.ratings['18']).toBeUndefined();
  expect(result.review.rows[18]).toMatchObject({state:"conflict",marks:['not_measured',3]});
 });
 it("rejects changed columns, shifted rows, missing pages and unrecognized forms",()=>{
  const cases=[fixture(),fixture(),fixture(),fixture()];
  cases[0].pages[0].pieces[0].text="عمود مختلف";
  cases[1].pages[0].pieces.find(p=>p.text.startsWith("خطة الدرس"))!.y+=50;
  cases[2].pages.pop(); cases[3].text="نموذج آخر";
  for(const d of cases){ const result=proposeLayoutVisit(d,setup);expect(result.review.recognized).toBe(false);expect(result.form.ratings).toEqual({}); }
 });
 it("does not map altered criteria, treats blank cells as missing, and preserves a true zero",()=>{
  const d=fixture();d.pages[0].pieces=d.pages[0].pieces.filter(p=>!(p.text==='\uf050'&&p.y<390));
  d.pages[0].pieces.push(piece('\uf050',240,365,10));
  const result=proposeLayoutVisit(d,{...setup,criteria:setup.criteria.map(c=>c._id==='2'?{...c,text:'بند مختلف'}:c)});
  expect(result.form.ratings['0']).toBe(0);expect(result.form.ratings['1']).toBeUndefined();expect(result.form.ratings['2']).toBeUndefined();expect(result.review.rows[2].state).toBe('unmapped');
 });
 it("accepts uniform page scaling but never auto-selects two possible people",()=>{
  const d=fixture();for(const p of d.pages){p.width*=2;p.height*=2;for(const t of p.pieces){t.x*=2;t.y*=2;t.width*=2;t.height*=2;}}
  const result=proposeLayoutVisit(d,{...setup,teachers:[...setup.teachers,{_id:'t2',fullName:'أحمد حسن علي'}]});
  expect(result.review.recognized).toBe(true);expect(result.form.teacherId).toBe('');expect(result.review.teacherSuggestions).toEqual(['t','t2']);
 });
 it("joins touching Arabic glyph runs without mixing neighbouring columns",()=>{
  const p={width:612,height:792,pieces:[piece('امل',80,20,8),piece('زيد',65,20,15),piece('نص آخر',200,20,70)]};
  expect(regionText(p,[0,0,100,40])).toBe('المزيد');
 });
});
