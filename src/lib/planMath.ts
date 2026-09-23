// Reading of the published week grid, shared by the pages that show it.
// Mirrors convex/assessmentPlan.ts — the server answers «كم كان المفروض؟» for
// the coverage table, and these helpers answer it live while a teacher records.

export type PlanWeek = {
    week: number; label: string; startDate: string; endDate: string; note?: string;
};

export type PlanEntry = { subjectName: string; grade?: number; week: number };

// A subject's own weeks for a grade, else the rows that cover every grade.
export function weeksFor(entries: PlanEntry[], subjectName?: string, grade?: number): number[] {
    if (!subjectName) return [];
    const mine = entries.filter(e => e.subjectName === subjectName);
    const forGrade = grade === undefined ? [] : mine.filter(e => e.grade === grade);
    const source = forGrade.length ? forGrade : mine.filter(e => e.grade === undefined);
    return [...new Set(source.map(e => e.week))].sort((a, b) => a - b);
}

// Assessments that should already be recorded: the planned weeks that have
// ended, never more than the number of slots the sheet has.
export function dueByNow(
    weeks: PlanWeek[], entries: PlanEntry[],
    subjectName: string | undefined, grade: number | undefined,
    slots = 5, today = new Date().toISOString().slice(0, 10),
): number {
    const byWeek = new Map(weeks.map(w => [w.week, w]));
    const passed = weeksFor(entries, subjectName, grade)
        .filter(w => (byWeek.get(w)?.endDate ?? "") < today);
    return Math.min(passed.length, slots);
}

// Which assessment number a planned week carries — «التقييم الثالث» is simply
// the third marked week for that subject.
export function assessmentIndexOf(
    entries: PlanEntry[], subjectName: string | undefined, grade: number | undefined, week: number,
): number | null {
    const i = weeksFor(entries, subjectName, grade).indexOf(week);
    return i < 0 ? null : i + 1;
}
