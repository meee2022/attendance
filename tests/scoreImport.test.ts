import { describe, expect, it } from "vitest";
import { previewScores, parseMark } from "../src/lib/scoreImport";
const roster = [{ id: "1", name: "أحمد محمد", values: { a1: 12 } }, { id: "2", name: "علي حسن", values: {} }];
const columns = [{ key: "a1", label: "تقييم 1", max: 20 }, { key: "a2", label: "تقييم 2", max: 20 }];
describe("reviewed Excel scores", () => {
    it("matches by name independent of row order and preserves blank versus zero", () => {
        const p = previewScores([["الاسم", "تقييم 1", "تقييم 2"], ["علي حسن", "٠", ""], ["أحمد   محمد", "١٩٫٥", "م"]], 1, 0, { a1: 1, a2: 2 }, columns, roster, false);
        expect(p.errors).toEqual([]); expect(p.rows[0].studentId).toBe("2");
        expect(p.rows[0].cells).toHaveLength(1); expect(p.rows[0].cells[0].value).toBe(0);
        expect(p.rows[1].cells[0]).toMatchObject({ value: 19.5, expected: 12 }); expect(p.rows[1].cells[1].value).toBe("excused");
    });
    it("rejects unknown names, duplicate students, ambiguous names and invalid mappings", () => {
        expect(previewScores([["أحمد محمد", 5], ["أحمد محمد", 6], ["مجهول", 8]], 0, 0, { a1: 1 }, columns, roster, false).errors).toHaveLength(2);
        expect(previewScores([["أحمد محمد", 5]], 0, 0, { a1: 1 }, columns, [...roster, { ...roster[0], id: "3" }], false).errors).toHaveLength(1);
        expect(previewScores([], 0, 0, { a1: 1, a2: 1 }, columns, roster, false).errors).toHaveLength(1);
    });
    it("never coerces errors, percentages, negative values or absence into diagnostic marks", () => {
        for (const v of ["غ", "=SUM(A1:A2)", "50%", -1, 21, "#VALUE!", Infinity]) expect(() => parseMark(v, 20, true)).toThrow();
        expect(parseMark("۵۰", 50, true)).toBe(50); expect(parseMark("", 20, true)).toBeNull();
    });
});
