// Deployment-admin-only archive migration. Never exposed as a public function.
// Normal interactive imports use visitImports.upload and visits.saveVisit.
import {internalMutation,internalAction,internalQuery} from './_generated/server';
import {internal} from './_generated/api';
import {v,ConvexError} from 'convex/values';
import {saveVisitHandler,settingsOf,activeCriteria} from './visits';
import {computeScores} from './visitMath';
const I=internal as any;
// Apply an explicitly reviewed roster atomically; reject concurrent roster edits.
export const reconcileRoster=internalMutation({args:{schoolId:v.id('schools'),expected:v.string(),rows:v.string(),deactivate:v.array(v.id('schoolTeachers'))},handler:async(ctx,args)=>{
 const current=await ctx.db.query('schoolTeachers').withIndex('by_school',q=>q.eq('schoolId',args.schoolId)).collect();
 const stable=(rows:any[])=>JSON.stringify(rows.map(x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>String(a._id).localeCompare(String(b._id))));
 const expected=JSON.parse(args.expected);
 if(stable(current)!==stable(expected))throw new ConvexError('تغيرت قائمة المعلمين؛ أعد المطابقة قبل التنفيذ');
 const rows=JSON.parse(args.rows) as {id?:string|null,value:{fullName:string,department:string,email?:string,phone?:string,isActive:boolean}}[];
 const ids=new Set(current.map(x=>String(x._id)));const used=new Set<string>();const names=new Set<string>();const emails=new Set<string>();
 for(const r of rows){
  if(!r.value.fullName.trim()||!r.value.department.trim()||r.value.isActive!==true)throw new ConvexError('بيانات معلم غير مكتملة');
  if(names.has(r.value.fullName)||r.value.email&&emails.has(r.value.email))throw new ConvexError('بيانات مكررة');
  names.add(r.value.fullName);if(r.value.email)emails.add(r.value.email);
  if(r.id){if(!ids.has(r.id)||used.has(r.id))throw new ConvexError('معلم غير متاح أو مكرر');used.add(r.id);}
 }
 for(const id of args.deactivate)if(!ids.has(id)||used.has(id))throw new ConvexError('قائمة إنهاء الخدمة غير صحيحة');
 const result:{id:string,name:string,action:string}[]=[];
 for(const r of rows){
  const value={fullName:r.value.fullName.trim(),department:r.value.department.trim(),email:r.value.email?.trim()||undefined,phone:r.value.phone?.trim()||undefined,isActive:true};
  const id=r.id as any;
  if(id)await ctx.db.patch(id,value);
  const saved=id??await ctx.db.insert('schoolTeachers',{schoolId:args.schoolId,...value});
  result.push({id:saved,name:value.fullName,action:id?'updated':'added'});
 }
 for(const id of args.deactivate){await ctx.db.patch(id,{isActive:false});result.push({id,name:current.find(x=>x._id===id)!.fullName,action:'deactivated'});}
 await ctx.db.insert('supervisionAuditLog',{schoolId:args.schoolId,action:'roster_reconciled',actorName:'مسؤول المنصة',details:JSON.stringify(result),timestamp:Date.now()});
 return result;
}});
export const verify=internalQuery({args:{id:v.id('supervisionVisits')},handler:async(ctx,{id})=>{
 const visit=await ctx.db.get(id);if(!visit||!visit.sourceImportId)throw new ConvexError('الزيارة المستوردة غير موجودة');
 const snapshot=JSON.parse(visit.snapshot??'{}');
 return {criteria:snapshot.criteria??[],visit:{...visit,ratings:JSON.parse(visit.ratings)},form:{...snapshot,signatureUrl:snapshot.deputySignatureId?await ctx.storage.getUrl(snapshot.deputySignatureId):null}};
}});
export const uploadUrl=internalMutation({args:{},handler:ctx=>ctx.storage.generateUploadUrl()});
export const correctText=internalMutation({
 args:{id:v.id('supervisionVisits'),subjectName:v.string(),lessonTopic:v.string(),expectedUpdatedAt:v.number()},
 handler:async(ctx,args)=>{
  const visit=await ctx.db.get(args.id);
  if(!visit||!visit.sourceImportId||visit.recordedByName!=='استيراد أرشيف النائب من ملفات المدرسة')throw new ConvexError('ليست زيارة مستوردة بهذه العملية');
  return saveVisitHandler({...ctx,supervisionSession:{schoolId:visit.schoolId,role:'admin',name:'استيراد أرشيف النائب من ملفات المدرسة',departments:null}}, {...visit,...args,id:visit._id,importReviewed:true,editReason:'تصحيح حروف النص المستخرج بالمقارنة مع ملف PDF الأصلي'});
 }
});
export const complete=internalAction({
 args:{storageId:v.id('_storage'),filename:v.string(),data:v.string()},
 handler:async(ctx,args):Promise<any>=>{
  const blob=await ctx.storage.get(args.storageId);
  if(!blob||blob.size>6*1024*1024)throw new ConvexError('ملف الأرشيف غير متاح');
  const bytes=await blob.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new ConvexError('ملف PDF غير صحيح');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  return ctx.runMutation(I.visitArchiveMaintenance.commit,{...args,sha256});
 }
});
export const commit=internalMutation({
 args:{storageId:v.id('_storage'),filename:v.string(),data:v.string(),sha256:v.string()},
 handler:async(ctx,args)=>{
  const d=JSON.parse(args.data),school=await ctx.db.query('schools').first();
  if(!school||d.visitorRole!=='deputy'||d.importReviewed!==true||!d.teacherId||!d.classId)throw new ConvexError('يلزم ملف نائب مراجع ومعلم وصف محددان');
  const teacher=await ctx.db.get(d.teacherId) as any;
  if(!teacher||teacher.schoolId!==school._id)throw new ConvexError('المعلم غير متاح');
  const existing=(await ctx.db.query('supervisionVisits').withIndex('by_teacher_id',q=>q.eq('schoolId',school._id).eq('teacherId',d.teacherId)).collect()).filter(x=>!x.deletedAt&&x.visitorRole==='deputy'&&x.visitDate===d.visitDate);
  if(existing.length>1)throw new ConvexError('أكثر من زيارة مطابقة؛ يلزم فحص يدوي');
  const hash=await ctx.db.query('supervisionImports').withIndex('by_hash',q=>q.eq('schoolId',school._id).eq('sha256',args.sha256)).first();
  if(hash?.visitId){await ctx.storage.delete(args.storageId);return {outcome:'already-imported',id:hash.visitId};}
  if(existing[0]?.sourceImportId){await ctx.storage.delete(args.storageId);return {outcome:'existing-with-original',id:existing[0]._id};}
  const source=hash?._id??await ctx.db.insert('supervisionImports',{schoolId:school._id,ownerId:'admin',storageId:args.storageId,sha256:args.sha256,filename:args.filename,createdAt:Date.now()});
  if(hash)await ctx.storage.delete(args.storageId);
  if(existing[0]){
   // Attach the reviewed original without overwriting any existing evaluation.
   await ctx.db.patch(existing[0]._id,{sourceImportId:source});await ctx.db.patch(source,{visitId:existing[0]._id});
   await ctx.db.insert('supervisionAuditLog',{schoolId:school._id,visitId:existing[0]._id,action:'original_imported',actorName:'استيراد أرشيف النائب من ملفات المدرسة',details:'إرفاق الأصل المراجع لزيارة موجودة دون تغيير بياناتها أو تقييماتها',timestamp:Date.now()});
   return {outcome:'original-attached',id:existing[0]._id};
  }
  const result=await saveVisitHandler({...ctx,supervisionSession:{schoolId:school._id,role:'admin',name:'استيراد أرشيف النائب من ملفات المدرسة',departments:null}}, {...d,sourceImportId:source});
  return {...result,outcome:result.ok?'imported':'duplicate'};
 }
});
// Visits kept in the school's Excel workbook before the platform. Each row is
// already matched to a teacher, class and visitor and was reviewed against the
// workbook; it is written as an approved visit. A row already present (same
// teacher, visitor role, date and lesson) is skipped, so a batch can be re-run.
// The visit numbers of each touched teacher and role then follow the dates.
const EXCEL_IMPORT='استيراد أرشيف الزيارات من ملف Excel';
export const importExcelVisits=internalMutation({args:{rows:v.string()},handler:async(ctx,args)=>{
 const school=await ctx.db.query('schools').first();if(!school)throw new ConvexError('لا توجد مدرسة');
 const settings=await settingsOf(ctx,school),criteria=await activeCriteria(ctx,school._id);
 const refs=criteria.map((c:any)=>({_id:c._id,domain:c.domain}));
 const all=await ctx.db.query('supervisionVisits').withIndex('by_school',q=>q.eq('schoolId',school._id)).collect();
 let recordNo=all.filter(x=>(x.academicYear??settings.academicYear)===settings.academicYear).reduce((m,x)=>Math.max(m,x.recordNo??0),0);
 const out:any[]=[],touched=new Set<string>();
 for(const r of JSON.parse(args.rows)){
  const teacher=await ctx.db.get(r.teacherId) as any,cls=await ctx.db.get(r.classId) as any;
  if(!teacher||teacher.schoolId!==school._id||!cls||cls.schoolId!==school._id)throw new ConvexError(`معلم أو صف غير متاح: ${r.row}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.visitDate)||r.ratings.length!==criteria.length)throw new ConvexError(`صف غير مكتمل: ${r.row}`);
  if(r.visitorId){const s=await ctx.db.get(r.visitorId) as any;if(!s||s.schoolId!==school._id||s.role!==r.visitorRole)throw new ConvexError(`الزائر غير متاح: ${r.row}`);}
  const lessonTopic=r.lessonTopic.trim();
  if(all.some(x=>!x.deletedAt&&x.teacherId===r.teacherId&&x.visitorRole===r.visitorRole&&x.visitDate===r.visitDate&&x.lessonTopic===lessonTopic)){out.push({row:r.row,outcome:'exists'});continue;}
  const ratings=Object.fromEntries(criteria.map((c:any,i:number)=>[c._id,r.ratings[i]??'not_measured']));
  const scores=computeScores(ratings,refs),now=Date.now();
  const visit={schoolId:school._id,visitorRole:r.visitorRole,visitorId:r.visitorId??undefined,visitorName:r.visitorName.trim(),recordedByName:EXCEL_IMPORT,
   teacherId:teacher._id,teacherName:teacher.fullName.replace(/\s+/g,' ').trim(),teacherDepartment:(teacher.department??'').trim(),subjectName:(teacher.department??'').trim(),
   classId:cls._id,className:cls.name,lessonTopic,visitDate:r.visitDate,followUpType:'full' as const,deliveryMode:'field' as const,visitNumber:0,
   ratings:JSON.stringify(ratings),averageScore:scores.average??0,domainAverages:JSON.stringify(scores.domains),
   planningRec:r.planningRec?.trim()||undefined,executionRec:r.executionRec?.trim()||undefined,evalMgmtRec:r.evalMgmtRec?.trim()||undefined,notes:r.notes?.trim()||undefined,
   status:'submitted' as const,submittedAt:now,submittedByName:EXCEL_IMPORT,recordNo:++recordNo,academicYear:settings.academicYear,createdAt:now,updatedAt:now,updatedBy:EXCEL_IMPORT,
   snapshot:JSON.stringify({schoolName:settings.schoolNameOnForm,academicYear:settings.academicYear,deputyName:settings.deputyName,principalName:settings.principalName,
    headerImageId:settings.headerImageId,footerImageId:settings.footerImageId,deputySignatureId:settings.deputySignatureId,visitorSignatureId:null,
    criteria:criteria.map((c:any)=>({_id:c._id,domain:c.domain,text:c.text,order:c.order}))})};
  const id=await ctx.db.insert('supervisionVisits',visit);all.push({...visit,_id:id} as any);touched.add(`${teacher._id}|${r.visitorRole}`);
  await ctx.db.insert('supervisionAuditLog',{schoolId:school._id,visitId:id,action:'submitted',actorName:EXCEL_IMPORT,details:`استيراد زيارة ${visit.teacherName} بتاريخ ${r.visitDate} من ملف Excel (الصف ${r.row})`,timestamp:now});
  out.push({row:r.row,outcome:'imported',recordNo});
 }
 for(const key of touched){
  const [teacherId,role]=key.split('|');
  const chain=all.filter(x=>!x.deletedAt&&x.status==='submitted'&&x.visitorRole===role&&(x.teacherId?x.teacherId===teacherId:false))
   .sort((a,b)=>a.visitDate.localeCompare(b.visitDate)||a.createdAt-b.createdAt);
  for(const [i,x] of chain.entries())if(x.visitNumber!==i+1){await ctx.db.patch(x._id,{visitNumber:i+1});x.visitNumber=i+1;}
 }
 return out;
}});
