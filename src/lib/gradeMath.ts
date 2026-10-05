// Final-score arithmetic for the short assessments, shared by the entry grid,
// the student report and every export so they can never disagree.
//
// The final score is taken over the assessments actually recorded for the
// student, so it means something from the first assessment of the term:
//   • a mark counts at its value
//   • غ (absent without excuse) counts as zero — it was held and missed
//   • م (excused) is left out of the calculation entirely
//   • an empty cell has not been recorded yet and is left out
// Once all five are recorded this equals sum ÷ (5 × max) × outOf.
//
// An assessment may be out of more than the school default (a 30- or 40-mark
// assessment): the row then carries `maxes`, the totals that differ, and the
// final score is marks obtained ÷ marks available over the counted assessments.

export const ASSESSMENT_SLOTS = ["a1", "a2", "a3", "a4", "a5"] as const;

export type FinalScore = {
    sum: number;          // marks obtained (غ adds nothing)
    counted: number;      // assessments in the calculation: marks + غ
    recorded: number;     // every filled cell, م included
    excused: number;
    maxPossible: number;  // the totals of the counted assessments, added up
    percent: number;      // 0..1
    finalScore: number;   // 0 when nothing is counted
    hasFinal: boolean;    // counted > 0
};

export function computeFinalScore(
    row: Record<string, unknown> | null | undefined,
    maxPerAssessment: number,
    finalOutOf: number,
): FinalScore {
    let sum = 0;
    let counted = 0;
    let recorded = 0;
    let excused = 0;
    let maxPossible = 0;
    const maxes = (row?.maxes ?? null) as Record<string, unknown> | null;
    const maxOf = (slot: string) => (typeof maxes?.[slot] === "number" ? maxes[slot] as number : maxPerAssessment);

    for (const slot of ASSESSMENT_SLOTS) {
        const v = row?.[slot];
        if (typeof v === "number") {
            sum += v;
            counted++;
            recorded++;
            maxPossible += maxOf(slot);
        } else if (v === "absent") {
            counted++;
            recorded++;
            maxPossible += maxOf(slot);
        } else if (v === "excused") {
            excused++;
            recorded++;
        }
    }

    const percent = maxPossible > 0 ? sum / maxPossible : 0;

    return {
        sum,
        counted,
        recorded,
        excused,
        maxPossible,
        percent,
        finalScore: percent * finalOutOf,
        hasFinal: counted > 0,
    };
}
