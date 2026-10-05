import { useState } from "react";
import { GradesGrid } from "../../src/pages/GradesPage";

// The mark grid on its own, with a slow fake server: each save lands 900 ms
// later, as it would on a weak connection. Synthetic names only.
const names = ["طالب تجريبي 1", "طالب تجريبي 2", "طالب تجريبي 3"];
export default function GradesCheck() {
    const [grades, setGrades] = useState<any[]>(names.map(studentName => ({ studentName, className: "12-1", grade: 12, track: "علمي", subjectName: "مادة" })));
    const fail = new URLSearchParams(location.search).has("fail");
    return <div dir="rtl" style={{ padding: 12 }}>
        <pre id="server-state" style={{ fontSize: 11 }}>{JSON.stringify(grades.map(g => [g.a1 ?? null, g.a2 ?? null]))}</pre>
        <GradesGrid grades={grades} subjectName="مادة" classMeta={{ className: "12-1", track: "علمي", grade: 12 }}
            settings={{ maxPerAssessment: 20, finalScoreOutOf: 5, passThreshold: 2.5, excellenceThreshold: 4.5, assessmentLabels: ["تقييم 1", "تقييم 2", "تقييم 3", "تقييم 4", "تقييم 5"] }}
            onUpdate={async (d: any) => {
                await new Promise(r => setTimeout(r, 900));
                if (fail) throw new Error("offline");
                setGrades(gs => gs.map(g => g.studentName === d.studentName ? { ...g, ...Object.fromEntries(Object.entries(d.values).map(([k, v]) => [k, v ?? undefined])) } : g));
            }}
            onFill={async () => ({ filled: 0, skipped: 0 })} onUndoFill={async () => {}}/>
    </div>;
}
