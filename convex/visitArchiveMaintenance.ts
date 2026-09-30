// Deployment-admin-only archive migration. Never exposed as a public function.
// Normal interactive imports use visitImports.upload and visits.saveVisit.
import {internalMutation,internalAction,internalQuery} from './_generated/server';
import {internal} from './_generated/api';
import {v,ConvexError} from 'convex/values';
import {saveVisitHandler} from './visits';
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
