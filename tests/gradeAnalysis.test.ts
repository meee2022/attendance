import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { readGradeSheet, analyzeGrades, sectionsOf, checkSheet, markOf } from "../src/lib/gradeSheet";
const A = api as any;
const modules = import.meta.glob("../convex/**/*.ts");

// The layout of the ministry «كشف درجات الشعبة»: two title rows, a row of
// components, a row of subjects over their first column, then the students
const subjects = ["الكيمياء", "الفيزياء", "علوم الحاسب", "التاريخ"];
const head = (n: number) => [
    ["ابن تيمية الثانوية للبنين كشف درجات الشعبة"],
    ["السنة الدراسية: 2026-2027  - الفترة: منتصف الفصل الاول"],
    ["", "", "الشعبة الصفية", ...subjects.slice(0, n).flatMap(() => ["التقييم الرئيسي", "منتصف الفصل الاول"])],
    ["الرقم", "الاسم", "", ...subjects.slice(0, n).flatMap(s => [s, ""])],
];
const row = (id: number, name: string, cls: string, marks: (number | string | null)[]) =>
    [id, name, cls, ...marks.flatMap(m => [m ?? "", typeof m === "number" ? Math.ceil(m) / 2 : m === "محروم" ? "غائب" : m ?? ""])];

const table = [
    ...head(4),
    row(1, "طالب علمي أول", "11/1", [30, 28, null, null]),
    row(2, "طالب علمي ثان", "11/1", [8, 12, null, null]),
    row(3, "طالب تكنولوجي", "11/4", [null, 20, 9, null]),
    row(4, "طالب تكنولوجي ثان", "11/4", [null, 22, 26, null]),
    row(5, "طالب أدبي", "11/6", [null, null, null, "محروم"]),
    row(6, "طالب أدبي ثان", "11/6", [null, null, null, 27]),
    row(7, "طالب بلا درجات", "11/ESE", [null, null, null, null]),
];

describe("ministry grade sheets", () => {
    it("reads the sheet, its scales and its marks", () => {
        const s = readGradeSheet(table, "11.xlsx");
        expect(s.period).toBe("منتصف الفصل الاول");
        expect(s.grade).toBe(11);
        expect(s.subjects).toEqual(subjects);
        expect(s.components).toEqual(["التقييم الرئيسي", "منتصف الفصل الاول"]);
        expect(s.maxes).toEqual([30, 15]);
        expect(s.students).toHaveLength(7);
        expect(s.students[4].marks[3]).toEqual(["محروم", "غائب"]);
        expect(markOf("١٢٫٥")).toBe(12.5);
        expect(markOf(" ")).toBeNull();
        expect(() => readGradeSheet([["عنوان"], ["لا شيء"]], "x.xlsx")).toThrow("الاسم");
    });

    it("finds each section's track from its subjects and analyses by track and threshold", () => {
        const s = readGradeSheet(table, "11.xlsx");
        expect(sectionsOf(s).map(x => `${x.cls}:${x.track}`)).toEqual(["11/1:علمي", "11/4:تكنولوجي", "11/6:أدبي", "11/ESE:عام"]);
        // pass mark 15 of 30: under it «راسب», up to 18 «على الحافة»
        const a = analyzeGrades(s, { pass: 15, track: "", cls: "" });
        expect(a.students.filter(x => x.failed.length).map(x => x.name)).toEqual(["طالب علمي ثان", "طالب تكنولوجي"]);
        expect(a.students.map(x => x.status)).toEqual(["excellent", "fail", "fail", "pass", "barred", "excellent", "none"]);
        expect(a.students[1].failed.map(f => f.name)).toEqual(["الكيمياء", "الفيزياء"]);
        expect(a.summary).toMatchObject({ students: 7, rated: 6, failAny: 2, failTwo: 1, barred: 1, none: 1, passAll: 3 });
        const chem = a.subjects.find(x => x.name === "الكيمياء")!;
        expect(chem).toMatchObject({ mean: 19, fail: 1, passRate: 0.5 });
        expect(chem.bands).toEqual([1, 0, 0, 0, 1]);
        expect(chem.bySection).toEqual([{ cls: "11/1", track: "علمي", count: 2, mean: 19, fail: 1, passRate: 0.5 }]);
        const tech = analyzeGrades(s, { pass: 15, track: "تكنولوجي", cls: "" });
        expect(tech.students.map(x => x.cls)).toEqual(["11/4", "11/4"]);
        expect(tech.subjects.map(x => x.name)).toEqual(["الفيزياء", "علوم الحاسب"]);
        expect(tech.sections[0]).toMatchObject({ cls: "11/4", failing: 1, passRate: 0.5 });
        expect(analyzeGrades(s, { pass: 21, track: "", cls: "11/4" }).students.map(x => x.status)).toEqual(["fail", "edge"]);
    });

    it("flags a mark above its scale", () => {
        const bad = [...table.slice(0, 5), row(9, "طالب خطأ", "11/1", [24, 21, null, null]).map((v, i) => i === 4 ? 23.5 : v)];
        expect(checkSheet(readGradeSheet(bad, "x.xlsx"))).toEqual(["طالب خطأ (11/1) — الكيمياء: «منتصف الفصل الاول» 23.5 من 15"]);
    });

    it("keeps sheets for the deputy and the admin only, and checks their shape", async () => {
        const t = convexTest(schema, modules);
        await t.run(ctx => ctx.db.insert("schools", { name: "اختبار", code: "T", createdAt: "2026", deputyPin: "dep", teacherPin: "tea" }));
        const deputy = "d".repeat(64), teacher = "e".repeat(64);
        await t.mutation(A.supervisionSessions.login, { role: "deputy", pin: "dep", token: deputy, name: "x" });
        await t.mutation(A.supervisionSessions.login, { role: "teacher", pin: "tea", token: teacher, name: "x" });
        const data = JSON.stringify(readGradeSheet(table, "11.xlsx"));
        await expect(t.mutation(A.gradeAnalyses.save, { sessionToken: teacher, data })).rejects.toThrow();
        await expect(t.mutation(A.gradeAnalyses.save, { sessionToken: deputy, data: JSON.stringify({ title: "x" }) })).rejects.toThrow("راجع");
        const id = await t.mutation(A.gradeAnalyses.save, { sessionToken: deputy, data });
        const list = await t.query(A.gradeAnalyses.list, { sessionToken: deputy });
        expect(list[0]).toMatchObject({ grade: 11, studentCount: 7, subjectCount: 4, period: "منتصف الفصل الاول" });
        expect(list[0]).not.toHaveProperty("data");
        await expect(t.query(A.gradeAnalyses.get, { sessionToken: teacher, id })).rejects.toThrow();
        const row = await t.query(A.gradeAnalyses.get, { sessionToken: deputy, id });
        await t.mutation(A.gradeAnalyses.save, { sessionToken: deputy, id, expectedUpdatedAt: row.updatedAt, data });
        await expect(t.mutation(A.gradeAnalyses.save, { sessionToken: deputy, id, expectedUpdatedAt: row.updatedAt, data })).rejects.toThrow("تغيّر");
        await t.mutation(A.gradeAnalyses.remove, { sessionToken: deputy, id });
        expect(await t.query(A.gradeAnalyses.list, { sessionToken: deputy })).toEqual([]);
    });
});
