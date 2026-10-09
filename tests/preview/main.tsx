import PdfCheck from "./PdfCheck";
import { createRoot } from "react-dom/client";
import { VisitsWorkspace } from "../../src/pages/visits/VisitsPage";
import { setup, visits, session } from "./sessionMock";
import "../../src/index.css";
const mobile = new URLSearchParams(location.search).has("mobile");
import MonthlyReport from "../../src/pages/visits/MonthlyReport";
import GradesCheck from "./GradesCheck";
if (new URLSearchParams(location.search).has("grades")) createRoot(document.getElementById("root")!).render(<GradesCheck/>);
else
if (new URLSearchParams(location.search).has("report")) {
    // local data only (.cache is not committed)
    fetch("/.cache/report-data.json").then(r => r.json()).then(d => createRoot(document.getElementById("root")!).render(
        <div style={{ padding: 12 }}><MonthlyReport setup={d.setup} visits={d.visits}/></div>));
} else createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("pdf") ? <PdfCheck/> : mobile ? <iframe title="معاينة الجوال" src="/tests/preview/index.html?frame=1" style={{ width: 390, height: 1400, border: 0, display: "block", margin: "auto" }}/> : <div style={{ width: mobile ? 390 : "100%", maxWidth: "100%", margin: "auto", padding: 12 }}>
    <p style={{ background: "#fff4d6", padding: 10, marginBottom: 16 }}>معاينة اختبار معزولة — جميع الأسماء والبيانات تجريبية</p>
    <VisitsWorkspace setup={setup} visits={visits} session={session} onSignOut={() => {}}/>
</div>);
