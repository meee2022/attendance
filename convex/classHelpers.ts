// Shared, dependency-free helpers for turning a "سجل القيد" registry row into
// a class. Imported by both the Convex mutation and the import screen so the
// preview the user approves is exactly what gets written.

export const UNASSIGNED_LABEL = "غير محدد";

// The sheet carries the track inside the "الصف" column ("11-Science",
// "12-Humanities", "10"), not in the section column.
export function trackFromSourceGrade(raw: string): string {
    const s = (raw || "").toLowerCase();
    if (s.includes("science")) return "علمي";
    if (s.includes("humanities")) return "أدبي";
    if (s.includes("technology")) return "تكنولوجي";
    return "عام";
}

// "10/1" → "10-1" · "12 / ESE" → "12-ESE"
export function normalizeClassName(raw: string): string {
    return (raw || "").trim().replace(/\s*\/\s*/g, "-").replace(/\s+/g, " ");
}

// "الشعبة الصفية" is "-" for students who are not placed in a section yet.
export function isUnassignedSection(raw: string): boolean {
    const s = normalizeClassName(raw);
    return !s || s === "-" || s === "—" || s === "_";
}

export function gradeOf(sourceGrade: string, className: string): number {
    const m = (sourceGrade || "").match(/^\s*(\d+)/) || (className || "").match(/^\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

export type ResolvedClass = { className: string; grade: number; track: string } | null;

export function resolveClass(sourceGrade: string, section: string): ResolvedClass {
    const track = trackFromSourceGrade(sourceGrade);
    const normalized = normalizeClassName(section);
    const grade = gradeOf(sourceGrade, normalized);
    if (!grade) return null;

    return {
        className: isUnassignedSection(normalized)
            ? `${grade}-${UNASSIGNED_LABEL}-${track}`
            : normalized,
        grade,
        track,
    };
}

// Sections are usually homogeneous, but a few students carry a different track
// than their classmates — the class takes the majority.
export function majorityTrack(tracks: Record<string, number>): string {
    return Object.entries(tracks).sort((a, b) => b[1] - a[1])[0][0];
}

// "55666074, 33115530" → "55666074"
export function primaryPhone(phones: string): string | undefined {
    return (phones || "")
        .split(/[\/,;،]/)
        .map(p => p.trim())
        .filter(Boolean)[0];
}
