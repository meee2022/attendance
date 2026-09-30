export type ImportColumn = { key: string; label: string; max: number };
export type ImportStudent = { id: string; name: string; values: Record<string, number | string>; absent?: boolean };
export function cleanName(value: unknown) { return String(value ?? "").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/\s+/g, " ").trim(); }
export function parseMark(value: unknown, max: number, diagnostics: boolean): number | string | null {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const s = String(value).trim().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/٫/g, ".");
    if (!diagnostics && ["غ", "غياب", "غائب", "absent"].includes(s)) return "absent";
    if (!diagnostics && ["م", "معذور", "excused"].includes(s)) return "excused";
    if (!/^\d+(\.\d+)?$/.test(s) || !Number.isFinite(Number(s)) || Number(s) > max) throw new Error(`درجة غير صالحة «${s}»؛ المطلوب من 0 إلى ${max}`);
    return Number(s);
}
export function previewScores(grid: unknown[][], start: number, nameColumn: number, mapping: Record<string, number>, columns: ImportColumn[], roster: ImportStudent[], diagnostics: boolean) {
    const rows: { studentId: string; name: string; expectedAbsent: boolean; cells: {key: string; value: number | string; expected: number | string | null; max: number}[]; sourceRow: number }[] = [];
    const errors: string[] = []; const used = new Set<string>();
    const selected = columns.filter(c => (mapping[c.key] ?? -1) >= 0);
    const indices = selected.map(c => mapping[c.key]);
    if (nameColumn < 0 || !selected.length) return { rows, errors: ["اختر عمود اسم الطالب وعمود درجات واحدًا على الأقل."] };
    if (indices.includes(nameColumn) || new Set(indices).size !== indices.length) return { rows, errors: ["لا يمكن استخدام العمود نفسه للاسم أو لأكثر من درجة."] };
    for (let i = start; i < grid.length; i++) {
        const raw = grid[i];
        if (!raw.some(v => String(v ?? "").trim())) continue;
        if (!selected.some(c => String(raw[mapping[c.key]] ?? "").trim())) continue;
        const name = cleanName(raw[nameColumn]);
        const matches = roster.filter(s => cleanName(s.name) === name);
        if (matches.length !== 1) { errors.push(`صف ${i + 1}: ${name || "اسم مفقود"} — ${matches.length ? "الاسم مكرر في الفصل" : "غير مطابق لقائمة هذا الفصل"}`); continue; }
        const student = matches[0];
        if (used.has(student.id)) { errors.push(`صف ${i + 1}: الطالب ${name} مكرر في الملف`); continue; }
        used.add(student.id);
        const cells = [];
        for (const c of selected) {
            try { const value = parseMark(raw[mapping[c.key]], c.max, diagnostics); if (value !== null) cells.push({ key: c.key, value, expected: student.values[c.key] ?? null, max: c.max }); }
            catch (e: any) { errors.push(`صف ${i + 1}، ${name}، ${c.label}: ${e.message}`); }
        }
        if (cells.length) rows.push({ studentId: student.id, name: student.name, expectedAbsent: !!student.absent, cells, sourceRow: i + 1 });
    }
    if (!rows.length && !errors.length) errors.push("لا توجد درجات قابلة للاستيراد في الأعمدة المختارة.");
    return { rows, errors };
}
