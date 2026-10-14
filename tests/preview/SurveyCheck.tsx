import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { buildSurvey, analyze } from "../../src/lib/surveyAnalysis";
import { Report, SurveyWorkspace } from "../../src/pages/SurveyAnalysisPage";
import "../../src/pages/surveyAnalysis.css";

// The report for a survey export kept locally in .cache (not committed)
export default function SurveyCheck() {
    const [state, setState] = useState<any>(null);
    useEffect(() => { void (async () => {
        const XLSX = await import("xlsx");
        const buf = await (await fetch("/.cache/survey-analysis/real.xlsx")).arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
        const survey = buildSurvey(table, "معاينة.xlsx");
        if (new URLSearchParams(location.search).has("named")) survey.statements = ["يشرح المعلم الدرس بوضوح", "يشجعنا على المشاركة", "يستخدم وسائل متنوعة", "يتعامل باحترام", "يراعي الفروق الفردية"];
        setState(survey);
    })(); }, []);
    if (!state) return <p>…</p>;
    const print = new URLSearchParams(location.search).has("print");
    if (new URLSearchParams(location.search).has("workspace"))
        return <MemoryRouter><SurveyWorkspace list={[]} id="x" row={{ _id: "x", updatedAt: 1, data: JSON.stringify(state) }} onOpen={() => {}}
            onSave={async (a: any) => { (window as any).__saved = JSON.parse(a.data); return "x"; }} onRemove={async () => {}}/></MemoryRouter>;
    const pdf = async () => {
        const { createSurveyPdf } = await import("../../src/lib/surveyPdf");
        const blob = await createSurveyPdf(<Report survey={state} result={analyze(state, null)} filterLabel="" print/>);
        await fetch("/__test-pdf", { method: "POST", body: blob });
        document.title = "pdf-ready";
    };
    return <div className="survey-analysis" dir="rtl" style={{ padding: 12 }}><button id="make-pdf" onClick={pdf}>PDF</button><Report survey={state} result={analyze(state, null)} filterLabel="" print={print}/></div>;
}
