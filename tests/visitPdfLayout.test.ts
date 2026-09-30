import { describe, it, expect } from "vitest";
import { cleanWordPdf, matchClass, proposeLayoutVisit, regionText, type PdfPiece, type VisitPdfDocument } from "../src/lib/visitPdfLayout";
import { DEFAULT_CRITERIA } from "../convex/visitCriteria";
import {EXCEL_CRITERION_ALIASES} from '../src/lib/visitExcelAliases';
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

describe('Excel archive imports',()=>{
 function excel():VisitPdfDocument {
  const ys=Array.from({length:24},(_,i)=>250+i*16);
  const pieces=[...headers.map((h,c)=>piece(h,220+c*19.6,220,60,true)),...DEFAULT_CRITERIA.flatMap((c,i)=>[piece(EXCEL_CRITERION_ALIASES[i][0],310,ys[i]+7,205),piece('✓',292,ys[i]+7,10)])];
  for(const [label,y] of [['المدرسة',110],['المادة',130],['الصف',150],['الزائر',170]] as const)pieces.push(piece(label,510,y,25));
  pieces.push(piece('أحمد محمد علي',100,150,140),piece('نائب تجريبي',370,170,100),piece('العلوم',400,130,80),piece('درس اختبار',100,130,150),piece('2026',241,110,24),piece('9',218,110,7),piece('13',195,110,12));
  return {text:'نائب المدير للشؤون األكاديمية',pages:[{width:595.2,height:841.8,pieces,rules:ys.map(y=>({left:72,right:542,y}))}]};
 }
 it('reads all 23 exact verified criteria, dates and the deputy role',()=>{
  const r=proposeLayoutVisit(excel(),setup);expect(r.review.recognized).toBe(true);expect(Object.keys(r.form.ratings)).toHaveLength(23);expect(r.form).toMatchObject({visitorRole:'deputy',visitDate:'2026-09-13',teacherId:'t',subjectName:'العلوم'});
 });
 it('rejects changed science criteria and missing grid lines instead of shifting scores',()=>{
  const d=excel();d.pages[0].pieces.find(p=>p.text===EXCEL_CRITERION_ALIASES[10][0])!.text='يطبق إجراءات السلامة في المختبر';expect(proposeLayoutVisit(d,setup).review.recognized).toBe(false);
  const b=excel();b.pages[0].rules!.splice(5,1);expect(proposeLayoutVisit(b,setup).form.ratings).toEqual({});
 });
 it('leaves multiple marks unresolved and zero distinct from an empty cell',()=>{
  const d=excel();d.pages[0].pieces.push(piece('✓',235,257,10));
  d.pages[0].pieces=d.pages[0].pieces.filter(p=>!(p.text==='✓'&&p.y===273));
  const r=proposeLayoutVisit(d,setup);expect(r.review.rows[0].state).toBe('conflict');expect(r.review.rows[1].state).toBe('empty');expect(r.form.ratings['0']).toBeUndefined();
 });
});

describe("text recovered from Word and Excel PDFs", () => {
 it("puts zero-width final letters back on their word, even where pieces overlap", () => {
  // «أوصي» as Excel writes it: the word, a space piece, a neighbouring piece that
  // overlaps the letter, and the final «ي» as a zero-width glyph near the word's left edge
  const page = { width: 612, height: 792, pieces: [
   { text: "أشكر المعلم على جهوده وأوص", x: 113, y: 294.5, width: 96, height: 9.4, rotated: false },
   { text: " ب", x: 103.2, y: 294.5, width: 12.9, height: 9.4, rotated: false },
   { text: "ي", x: 116.1, y: 297.4, width: 0, height: 9.4, rotated: false },
   { text: "توفي", x: 193.2, y: 330.9, width: 15.5, height: 9.4, rotated: false },
   { text: "ر", x: 198.1, y: 331.6, width: 0, height: 9.4, rotated: false },
  ] };
  const text = regionText(page, [72, 280, 215, 345]);
  expect(text).toContain("وأوصي");
  expect(text).toContain("توفير");
  // and leaves the raw text alone where it is only compared with known labels
  expect(regionText(page, [72, 280, 215, 345], false)).not.toContain("توفير");
 });
 it("mends spellings that are never Arabic, and not the ones that are", () => {
  expect(cleanWordPdf("عىل الطالب عل الكتاب حت يستكمله أعاله مالحظات عالقته الإسالمية العبدهللا"))
   .toBe("على الطالب على الكتاب حتى يستكمله أعلاه ملاحظات علاقته الإسلامية العبدالله");
  expect(cleanWordPdf("علم حتما")).toBe("علم حتما");
 });
 it("matches the class written in words or numbers to the class list", () => {
  const classes = ["10-3", "12-10", "11-3", "12-6", "10-10"].map(name => ({ _id: name, name }));
  expect(matchClass("عاشر 3", classes)).toBe("10-3");
  expect(matchClass("ثاني عشر 10", classes)).toBe("12-10");
  expect(matchClass("الحادي عشر ٣", classes)).toBe("11-3");
  expect(matchClass("12 / 6 - أدبي (الحصة 2)", classes)).toBe("12-6");
  expect(matchClass("عاشر 10", classes)).toBe("10-10");
  expect(matchClass("الصف التاسع 3", classes)).toBe("");
 });
});
