import PdfCheck from "./PdfCheck";
import { createRoot } from "react-dom/client";
import { VisitsWorkspace } from "../../src/pages/visits/VisitsPage";
import { setup, visits, session } from "./sessionMock";
import "../../src/index.css";
const mobile = new URLSearchParams(location.search).has("mobile");
createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("pdf") ? <PdfCheck/> : mobile ? <iframe title="معاينة الجوال" src="/tests/preview/index.html?frame=1" style={{ width: 390, height: 1400, border: 0, display: "block", margin: "auto" }}/> : <div style={{ width: mobile ? 390 : "100%", maxWidth: "100%", margin: "auto", padding: 12 }}>
    <p style={{ background: "#fff4d6", padding: 10, marginBottom: 16 }}>معاينة اختبار معزولة — جميع الأسماء والبيانات تجريبية</p>
    <VisitsWorkspace setup={setup} visits={visits} session={session} onSignOut={() => {}}/>
</div>);
