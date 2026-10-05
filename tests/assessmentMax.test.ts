import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const A = api as any;
const modules = import.meta.glob("../convex/**/*.ts");

async function fixture() {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "TEST", createdAt: "2026", teacherPin: "teacher-test" });
        const classId = await ctx.db.insert("classes", { schoolId, name: "12-1", grade: 12, track: "علمي", isActive: true });
        await ctx.db.insert("students", { schoolId, classId, fullName: "طالب تجريبي", isActive: true });
    });
    const sessionToken = "b".repeat(64);
    await t.mutation(A.supervisionSessions.login, { role: "teacher", pin: "teacher-test", token: sessionToken, name: "x" });
    const sheet = { className: "12-1", subjectName: "الفيزياء", sessionToken };
    const mark = (which: string, value: number) => t.mutation(A.grades.upsertGrade,
        { ...sheet, studentName: "طالب تجريبي", grade: 12, track: "علمي", [which]: value });
    return { t, sheet, mark };
}

describe("an assessment marked out of more than 20", () => {
    it("refuses a mark above the total, then takes it once the teacher sets the total", async () => {
        const f = await fixture();
        await expect(f.mark("a1", 36)).rejects.toThrow("أكبر من الدرجة الكلية");
        await f.t.mutation(A.grades.setAssessmentMax, { ...f.sheet, which: "a1", max: 40 });
        expect(await f.t.query(A.grades.getSheetMaxes, f.sheet)).toEqual([40, 20, 20, 20, 20]);
        await f.mark("a1", 36);
        // the other assessments keep the default
        await expect(f.mark("a2", 25)).rejects.toThrow("أكبر من الدرجة الكلية");
        await f.mark("a2", 15);
        const [row] = await f.t.query(A.grades.getGradesByClassSubject, f.sheet);
        expect(row).toMatchObject({ a1: 36, a2: 15, maxes: { a1: 40 } });
    });
    it("will not lower the total under a recorded mark, and going back to the default stores nothing", async () => {
        const f = await fixture();
        await f.t.mutation(A.grades.setAssessmentMax, { ...f.sheet, which: "a1", max: 40 });
        await f.mark("a1", 36);
        await expect(f.t.mutation(A.grades.setAssessmentMax, { ...f.sheet, which: "a1", max: 30 })).rejects.toThrow("أعلى من 30");
        await f.mark("a1", 18);
        await f.t.mutation(A.grades.setAssessmentMax, { ...f.sheet, which: "a1", max: 20 });
        expect(await f.t.query(A.grades.getSheetMaxes, f.sheet)).toEqual([20, 20, 20, 20, 20]);
        const [row] = await f.t.query(A.grades.getGradesByClassSubject, f.sheet);
        expect(row.maxes).toBeUndefined();
    });
});
