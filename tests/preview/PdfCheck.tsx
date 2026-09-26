import { useState } from "react";
import { createVisitPdf } from "../../src/lib/visitPdf";
import { OfficialVisitForm } from "../../src/pages/visits/VisitFormPrint";
const counts = [["planning", 3], ["execution", 13], ["evaluation", 3], ["management", 4]] as const;
const criteria = counts.flatMap(([domain, n]) => Array.from({ length: n }, (_, i) => ({ _id: `${domain}${i}`, domain, order: i, text: "معيار تجريبي" })));
const scale = [3, 2, 1, 0, "not_measured"] as const;
const q = new URLSearchParams(location.search);
const role = (q.get("role") ?? "supervisor") as "supervisor" | "coordinator" | "deputy";
const long = q.has("long") ? " ".repeat(1) + "توصية تجريبية طويلة لاختبار تصغير الخط داخل الخانة دون أن يتجاوز النص حدود الجدول. ".repeat(6) : "";
export const sample = { criteria, form: { schoolName: "مدرسة اختبار", academicYear: "2026 - 2027", deputyName: "نائب تجريبي", principalName: "مدير تجريبي", signatureUrl: q.get("sig") }, visit: { _id: "test-visit", teacherId: "test-teacher", teacherName: "معلم تجريبي", teacherDepartment: "العلوم", subjectName: "العلوم", visitorRole: role, visitorName: role === "coordinator" ? "منسق تجريبي" : "موجه تجريبي", visitDate: "2026-09-25", updatedAt: 1, status: "submitted", visitNumber: 1, className: "العاشر 1", lessonTopic: "درس تجريبي", followUpType: q.has("partial") ? "partial" : "full", deliveryMode: q.has("remote") ? "remote" : "field", streamMode: q.has("remote") ? "merged" : undefined, ratings: Object.fromEntries(criteria.map((c, i) => [c._id, scale[i % 5]])), planningRec: "توصية تجريبية للتخطيط" + long, executionRec: "توصية تجريبية للتنفيذ" + long, evalMgmtRec: "توصية تجريبية للتقويم" + long, managementRec: "توصية تجريبية للإدارة الصفية" + long, notes: "هذه بيانات اختبار وليست زيارة حقيقية." + long } };
export default function PdfCheck() {
 const [status, setStatus] = useState("جاهز");
 return <><div className="no-print"><button onClick={async () => { setStatus("جاري التوليد"); try { const pdf = await createVisitPdf(sample); const response = await fetch("/__test-pdf", { method: "POST", body: pdf }); if (!response.ok) throw new Error("save failed"); setStatus(`تم حفظ ملف اختبار PDF: ${pdf.size} بايت`); } catch (e) { setStatus(String(e)); } }}>اختبار توليد PDF</button><p role="status">{status}</p></div><OfficialVisitForm data={sample}/></>;
}
