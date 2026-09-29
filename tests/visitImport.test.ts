import { describe, it, expect } from "vitest";
import { proposeVisit } from "../src/lib/visitImport";
import { roleComparisons } from "../src/lib/visitStats";

const criteria = [{ _id: "a", text: "يخطط للدرس", domain: "planning", order: 1 }, { _id: "b", text: "ينوع الأنشطة", domain: "planning", order: 2 }] as any;
const setup = { criteria, teachers: [{ _id: "t", fullName: "أحمد علي" }], visitors: [{ _id: "s", fullName: "محمد حسن", role: "supervisor" }] };
describe("conservative PDF proposals", () => {
    it("reads explicit values and Arabic dates, never a table tick or item number", () => {
        const result = proposeVisit("أحمد علي محمد حسن\nالتاريخ: ٢٩/٠٩/٢٠٢٦\nيخطط للدرس التقدير: ٣\n2 ينوع الأنشطة ✓\nتوصيات التخطيط: راجع الأهداف", setup);
        expect(result).toMatchObject({ teacherId: "t", supervisorId: "s", visitDate: "2026-09-29", ratings: { a: 3 }, planningRec: "راجع الأهداف" });
    });
    it("does not choose ambiguous identities, impossible dates or conflicting scores", () => {
        const result = proposeVisit("أحمد علي محمد سالم التاريخ: 31/02/2026 يخطط للدرس الدرجة: 1 يخطط للدرس الدرجة: 3", { ...setup, teachers: [...setup.teachers, { _id: "t2", fullName: "محمد سالم" }] });
        expect(result.teacherId).toBe(""); expect(result.visitDate).toBe(""); expect(result.ratings).toEqual({});
    });
});
describe("teacher comparison evidence", () => {
    const row = (visitDate: string, ratings: any, extra = {}) => ({ visitDate, ratings: JSON.stringify(ratings), visitorRole: "coordinator", visitorId: "c", visitorName: "منسق", status: "submitted", createdAt: 1, criteriaSnapshot: criteria, ...extra }) as any;
    it("compares only common measured items and excludes draft and other roles", () => {
        const results = roleComparisons([row("2026-09-01", { a: 1, b: 0 }), row("2026-09-20", { a: 3, b: "not_measured" }), row("2026-09-21", { a: 0 }, { status: "draft" }), row("2026-09-22", { a: 0 }, { visitorRole: "supervisor" })], criteria);
        expect(results[0].commonCount).toBe(1); expect(results[0].delta).toBeCloseTo(2/3); expect(results[0].count).toBe(2); expect(results[2].delta).toBeNull();
    });
    it("refuses trend claims across different visitors or changed criterion wording", () => {
        expect(roleComparisons([row("2026-09-01", { a: 1 }), row("2026-09-20", { a: 3 }, { visitorId: "another" })], criteria)[0].delta).toBeNull();
        expect(roleComparisons([row("2026-09-01", { a: 1 }), row("2026-09-20", { a: 3 }, { criteriaSnapshot: [{ ...criteria[0], text: "معيار جديد" }] })], criteria)[0].delta).toBeNull();
    });
});
