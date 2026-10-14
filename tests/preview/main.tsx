import PdfCheck from "./PdfCheck";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { VisitsWorkspace } from "../../src/pages/visits/VisitsPage";
import { setup, visits, session } from "./sessionMock";
import "../../src/index.css";
const mobile = new URLSearchParams(location.search).has("mobile");
// the mock keeps its visits in memory: redraw when one of them changes
function Live() {
    const [, update] = useState(0);
    useEffect(() => { const changed = () => update(n => n + 1); window.addEventListener("preview-data", changed); return () => window.removeEventListener("preview-data", changed); }, []);
    return <VisitsWorkspace setup={setup} visits={[...visits]} session={session} onSignOut={() => {}}/>;
}
import MonthlyReport from "../../src/pages/visits/MonthlyReport";
import GradesCheck from "./GradesCheck";
import SurveyCheck from "./SurveyCheck";
import StudentOpinionsPage from "../../src/pages/StudentOpinionsPage";
import { ReportView } from "../../src/pages/GuardianReport";
import { sample } from "./PdfCheck";
import { FormPreview } from "../../src/pages/visits/TeacherAcknowledgement";
if (new URLSearchParams(location.search).has("opinions")) createRoot(document.getElementById("root")!).render(<div style={{ padding: 12 }}><StudentOpinionsPage/></div>);
else
if (new URLSearchParams(location.search).has("guardian")) createRoot(document.getElementById("root")!).render(<ReportView data={{ school: "مدرسة ابن تيمية الثانوية للبنين", title: "استطلاع رأي المدرسين في طلاب الصف الثاني عشر", studentName: "طالب تجريبي", className: "12-1",
    subjects: [{ subject: "الأحياء", academic: 5, behavior: 5, distraction: "no", advice: "الاستمرار على مستواه المتميز" }, { subject: "الرياضيات", academic: 2, behavior: 3, distraction: "yes", advice: "متابعة حل الواجبات والمذاكرة اليومية في المنزل" }, { subject: "اللغة العربية", academic: 4, behavior: 4, distraction: "sometimes", advice: "" }] }}/>);
else
if (new URLSearchParams(location.search).has("survey")) createRoot(document.getElementById("root")!).render(<SurveyCheck/>);
else
if (new URLSearchParams(location.search).has("signpreview")) createRoot(document.getElementById("root")!).render(<div dir="rtl" style={{ maxWidth: 720, margin: "auto", padding: 16 }}><FormPreview data={sample}/><p>نهاية المعاينة</p></div>);
else
if (new URLSearchParams(location.search).has("grades")) createRoot(document.getElementById("root")!).render(<GradesCheck/>);
else
if (new URLSearchParams(location.search).has("report")) {
    // local data only (.cache is not committed)
    fetch("/.cache/report-data.json").then(r => r.json()).then(d => createRoot(document.getElementById("root")!).render(
        <div style={{ padding: 12 }}><MonthlyReport setup={d.setup} visits={d.visits}/></div>));
} else createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("pdf") ? <PdfCheck/> : mobile ? <iframe title="معاينة الجوال" src="/tests/preview/index.html?frame=1" style={{ width: 390, height: 1400, border: 0, display: "block", margin: "auto" }}/> : <div style={{ width: mobile ? 390 : "100%", maxWidth: "100%", margin: "auto", padding: 12 }}>
    <p style={{ background: "#fff4d6", padding: 10, marginBottom: 16 }}>معاينة اختبار معزولة — جميع الأسماء والبيانات تجريبية</p>
    <Live/>
</div>);
