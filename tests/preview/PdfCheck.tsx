import { useState } from "react";
import { createVisitPdf } from "../../src/lib/visitPdf";
import { OfficialVisitForm } from "../../src/pages/visits/VisitFormPrint";
import { SUPPORT_CRITERIA } from "../../convex/visitCriteria";
const counts = [["planning", 3], ["execution", 13], ["evaluation", 3], ["management", 4]] as const;
const criteria = counts.flatMap(([domain, n]) => Array.from({ length: n }, (_, i) => ({ _id: `${domain}${i}`, domain, order: i, text: "معيار تجريبي" })));
const scale = [3, 2, 1, 0, "not_measured"] as const;
const q = new URLSearchParams(location.search);
const role = (q.get("role") ?? "supervisor") as "supervisor" | "coordinator" | "deputy";
const long = q.has("long") ? " ".repeat(1) + "توصية تجريبية طويلة لاختبار تصغير الخط داخل الخانة دون أن يتجاوز النص حدود الجدول. ".repeat(6) : "";
const deputySignature = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="38"><text x="100" y="26" text-anchor="middle" font-size="20" fill="#14356a">TEST SIGNATURE</text></svg>');
export const sample = { criteria, form: { schoolName: "مدرسة ابن تيمية الثانوية للبنين", academicYear: "2026 - 2027", deputyName: "نائب تجريبي", principalName: "مدير تجريبي", deputyApprovalSignatureUrl: q.has("approved") ? deputySignature : null, signatureUrl: q.get("sig"), teacherSignatureUrl: q.has("tsig") ? deputySignature : null }, visit: { deputyApproval: q.has("approved") ? { name: "نائب تجريبي", at: Date.UTC(2026, 8, 30) } : undefined, _id: "test-visit", teacherId: "test-teacher", teacherName: "معلم تجريبي باسم طويل للاختبار", teacherDepartment: "العلوم", subjectName: "الحوسبة وتكنولوجيا المعلومات", visitorRole: role, visitorName: role === "coordinator" ? "منسق تجريبي" : "موجه تجريبي", visitDate: "2026-09-25", updatedAt: 1, status: "submitted", visitNumber: 1, className: "العاشر 1", lessonTopic: "عنوان درس تجريبي طويل لاختبار تصغير الخط داخل الخانة", followUpType: q.has("partial") ? "partial" : "full", deliveryMode: q.has("remote") ? "remote" : "field", streamMode: q.has("remote") ? "merged" : undefined, ratings: Object.fromEntries(criteria.map((c, i) => [c._id, scale[i % 5]])), planningRec: "توصية تجريبية للتخطيط" + long, executionRec: "توصية تجريبية للتنفيذ" + long, evalMgmtRec: "توصية تجريبية للتقويم" + long, managementRec: "توصية تجريبية للإدارة الصفية" + long, notes: "هذه بيانات اختبار وليست زيارة حقيقية." + long } };
// ?support: the support teachers' form, rated 1-5 with a recommendation per criterion
const support = { ...sample, criteria: SUPPORT_CRITERIA, visit: { ...sample.visit, formKind: "support", visitorRole: role, followUpType: "partial",
    ratings: Object.fromEntries(SUPPORT_CRITERIA.map((c, i) => [c._id, (i % 5) + 1])),
    criterionRecs: { sp02: long || "ربط أهداف الحصة بالخطة الفردية للطالب", sp10: long || "تنويع الأنشطة حسب مستوى كل طالب", sp12: long, sp17: long || "استخدام لوحة التعزيز الرمزي" },
    notes: "زيارة تجريبية لاستمارة الدعم الإضافي." } } as any;
const data = q.has("support") ? support : sample;
export default function PdfCheck() {
 const [status, setStatus] = useState("جاهز");
 return <><div className="no-print"><button onClick={async () => { setStatus("جاري التوليد"); try { const pdf = await createVisitPdf(data); const response = await fetch("/__test-pdf", { method: "POST", body: pdf }); if (!response.ok) throw new Error("save failed"); setStatus(`تم حفظ ملف اختبار PDF: ${pdf.size} بايت`); } catch (e) { setStatus(String(e)); } }}>اختبار توليد PDF</button><p role="status">{status}</p></div><OfficialVisitForm data={data}/></>;
}
