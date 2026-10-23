import { useEffect, useState } from "react";
import { readGradeSheet, type GradeSheet } from "../../src/lib/gradeSheet";
import { Report } from "../../src/pages/GradeAnalysisPage";
import "../../src/pages/surveyAnalysis.css";

// A ministry grade sheet kept locally in .cache (not committed), analysed as the page does
export default function GradeCheck() {
    const [sheet, setSheet] = useState<GradeSheet | null>(null);
    useEffect(() => { void (async () => {
        const XLSX = await import("xlsx");
        const file = new URLSearchParams(location.search).get("file") ?? "11";
        const wb = XLSX.read(await (await fetch(`/.cache/grades/${file}.xlsx`)).arrayBuffer(), { type: "array" });
        const tables = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }) as unknown[][]);
        setSheet(readGradeSheet(tables.sort((a, b) => b.length - a.length)[0], `${file}.xlsx`));
    })(); }, []);
    return sheet ? <div className="survey-analysis" dir="rtl" style={{ padding: 12 }}><Report sheet={sheet}/></div> : <p>…</p>;
}
