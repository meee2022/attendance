import { describe, it, expect } from "vitest";
import { parseInput } from "../src/pages/GradesPage";

describe("short-assessment mark input", () => {
    it("reads marks typed on an Arabic keyboard", () => {
        expect(parseInput("١٨", 20)).toBe(18);
        expect(parseInput("۱۷", 20)).toBe(17);
        expect(parseInput("١٧٫٥", 20)).toBe(17.5);
        expect(parseInput("17,5", 20)).toBe(17.5);
        expect(parseInput(" 20 ", 20)).toBe(20);
    });
    it("keeps absence, excuse, blanks and limits as before", () => {
        expect(parseInput("غ", 20)).toBe("absent");
        expect(parseInput("م", 20)).toBe("excused");
        expect(parseInput("", 20)).toBeNull();
        expect(parseInput("٢٥", 20)).toEqual({ error: "لا يمكن أن تتجاوز 20" });
        expect(parseInput("abc", 20)).toEqual({ error: "قيمة غير صالحة" });
    });
});
