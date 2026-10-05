import { describe, it, expect } from "vitest";
import { computeFinalScore } from "../src/lib/gradeMath";

describe("final score when assessments have different totals", () => {
    it("is unchanged when every assessment is out of the default", () => {
        const f = computeFinalScore({ a1: 20, a2: 10 }, 20, 5);
        expect(f.maxPossible).toBe(40);
        expect(f.finalScore).toBeCloseTo(3.75);
    });
    it("takes marks obtained over marks available — 36/40 and 15/20 is 51/60", () => {
        const f = computeFinalScore({ a1: 36, a2: 15, maxes: { a1: 40 } }, 20, 5);
        expect(f.sum).toBe(51);
        expect(f.maxPossible).toBe(60);
        expect(f.finalScore).toBeCloseTo(4.25);
    });
    it("counts an absence against that assessment's own total, and leaves an excuse out", () => {
        const f = computeFinalScore({ a1: "absent", a2: 20, a3: "excused", maxes: { a1: 30, a3: 40 } }, 20, 5);
        expect(f.maxPossible).toBe(50);
        expect(f.finalScore).toBeCloseTo(2);
    });
});
