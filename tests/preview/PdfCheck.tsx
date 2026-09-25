import { useState } from "react";
import { createVisitPdf } from "../../src/lib/visitPdf";
import { OfficialVisitForm } from "../../src/pages/visits/VisitFormPrint";
const criteria = Array.from({ length: 23 }, (_, i) => ({ _id: `c${i}`, domain: i < 5 ? "planning" : i < 13 ? "execution" : i < 19 ? "evaluation" : "management", order: i, text: "معيار تجريبي للتحقق من وضوح النص العربي وتنسيق نموذج الزيارة المعتمد" }));
export const sample = { criteria, form: { schoolName: "مدرسة اختبار", academicYear: "2026 - 2027", deputyName: "نائب تجريبي", principalName: "مدير تجريبي" }, visit: { _id: "test-visit", teacherId: "test-teacher", teacherName: "معلم تجريبي", teacherDepartment: "العلوم", subjectName: "العلوم", visitorRole: "supervisor", visitorName: "موجه تجريبي", visitDate: "2026-09-25", updatedAt: 1, status: "submitted", visitNumber: 1, className: "العاشر 1", lessonTopic: "درس تجريبي", ratings: Object.fromEntries(criteria.map(c => [c._id, 3])), planningRec: "توصية تجريبية للتخطيط", executionRec: "توصية تجريبية للتنفيذ", evalMgmtRec: "توصية تجريبية للتقويم", notes: "هذه بيانات اختبار وليست زيارة حقيقية." } };
export default function PdfCheck() {
 const [status, setStatus] = useState("جاهز");
 return <><button onClick={async () => { setStatus("جاري التوليد"); try { const pdf = await createVisitPdf(sample); const response = await fetch("/__test-pdf", { method: "POST", body: pdf }); if (!response.ok) throw new Error("save failed"); setStatus(`تم حفظ ملف اختبار PDF: ${pdf.size} بايت`); } catch (e) { setStatus(String(e)); } }}>اختبار توليد PDF</button><p role="status">{status}</p><OfficialVisitForm data={sample}/></>;
}
