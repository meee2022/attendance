import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const A = api as any;
const modules = import.meta.glob("../convex/**/*.ts");

async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "T", createdAt: "2026", deputyPin: "dep", teacherPin: "tea" });
        const c12 = await ctx.db.insert("classes", { schoolId, name: "12-1", grade: 12, isActive: true });
        const c11 = await ctx.db.insert("classes", { schoolId, name: "11-1", grade: 11, isActive: true });
        const ali = await ctx.db.insert("students", { schoolId, classId: c12, fullName: "طالب أول", nationalId: "29900000001", guardianPhone: "55000001", isActive: true });
        const omar = await ctx.db.insert("students", { schoolId, classId: c12, fullName: "طالب ثان", isActive: true });
        const junior = await ctx.db.insert("students", { schoolId, classId: c11, fullName: "طالب حادي عشر", isActive: true });
        const math = await ctx.db.insert("schoolTeachers", { schoolId, fullName: "معلم الرياضيات", department: "الرياضيات", isActive: true });
        const phys = await ctx.db.insert("schoolTeachers", { schoolId, fullName: "معلم الفيزياء", department: "الفيزياء", isActive: true });
        return { schoolId, c12, c11, ali, omar, junior, math, phys };
    });
    const deputy = "d".repeat(64), teacher = "e".repeat(64);
    await t.mutation(A.supervisionSessions.login, { role: "deputy", pin: "dep", token: deputy, name: "x" });
    await t.mutation(A.supervisionSessions.login, { role: "teacher", pin: "tea", token: teacher, name: "x" });
    return { t, ...ids, deputy, teacher };
}

describe("teachers' opinion of their students", () => {
    it("lets each teacher rate a section of the round's grade, and only while it is open", async () => {
        const f = await fixture();
        await expect(f.t.mutation(A.studentOpinions.createRound, { sessionToken: f.teacher, title: "x", grade: 12 })).rejects.toThrow();
        const roundId = await f.t.mutation(A.studentOpinions.createRound, { sessionToken: f.deputy, title: "رأي المعلمين — الفصل الأول", grade: 12 });
        expect((await f.t.query(A.studentOpinions.setup, { sessionToken: f.teacher, roundId })).classes.map((c: any) => c.name)).toEqual(["12-1"]);
        const base = { sessionToken: f.teacher, roundId, teacherId: f.math, subjectName: "الرياضيات" };
        await f.t.mutation(A.studentOpinions.save, { ...base, studentId: f.ali, academic: 5, behavior: 4, distraction: "no", advice: "متابعة حل الواجبات" });
        await f.t.mutation(A.studentOpinions.save, { ...base, studentId: f.ali, behavior: 3 });     // keeps the other fields
        await expect(f.t.mutation(A.studentOpinions.save, { ...base, studentId: f.ali, academic: 9 })).rejects.toThrow("التقدير");
        await expect(f.t.mutation(A.studentOpinions.save, { ...base, studentId: f.junior, academic: 3 })).rejects.toThrow("صف الاستطلاع");
        await expect(f.t.query(A.studentOpinions.sheet, { ...base, classId: f.c11 })).rejects.toThrow("الشعبة");
        const sheet = await f.t.query(A.studentOpinions.sheet, { ...base, classId: f.c12 });
        expect(sheet.students.map((s: any) => s.fullName)).toEqual(["طالب أول", "طالب ثان"]);
        expect(sheet.opinions).toHaveLength(1);
        expect(sheet.opinions[0]).toMatchObject({ academic: 5, behavior: 3, distraction: "no", advice: "متابعة حل الواجبات" });
        // another teacher's sheet does not show it
        expect((await f.t.query(A.studentOpinions.sheet, { ...base, teacherId: f.phys, subjectName: "الفيزياء", classId: f.c12 })).opinions).toEqual([]);
        await f.t.mutation(A.studentOpinions.setRound, { sessionToken: f.deputy, id: roundId, open: false });
        await expect(f.t.mutation(A.studentOpinions.save, { ...base, studentId: f.ali, academic: 4 })).rejects.toThrow("أُغلق");
        expect(await f.t.query(A.studentOpinions.rounds, { sessionToken: f.teacher })).toEqual([]);
        await expect(f.t.query(A.studentOpinions.overview, { sessionToken: f.teacher, roundId })).rejects.toThrow();
    });

    it("gives each guardian a private report of all subjects once published, without teachers' names", async () => {
        const f = await fixture();
        const roundId = await f.t.mutation(A.studentOpinions.createRound, { sessionToken: f.deputy, title: "رأي المعلمين", grade: 12 });
        await f.t.mutation(A.studentOpinions.save, { sessionToken: f.teacher, roundId, teacherId: f.math, subjectName: "الرياضيات", studentId: f.ali, academic: 5, advice: "استمر" });
        await f.t.mutation(A.studentOpinions.save, { sessionToken: f.teacher, roundId, teacherId: f.phys, subjectName: "الفيزياء", studentId: f.ali, academic: 2, distraction: "yes" });
        expect(await f.t.mutation(A.studentOpinions.issueLinks, { sessionToken: f.deputy, roundId, days: 30 })).toBe(2);
        expect(await f.t.mutation(A.studentOpinions.issueLinks, { sessionToken: f.deputy, roundId, days: 30 })).toBe(0);
        const view = await f.t.query(A.studentOpinions.overview, { sessionToken: f.deputy, roundId });
        expect(view.students.find((s: any) => s._id === f.ali).guardianPhone).toBe("55000001");
        const token = view.links.find((l: any) => l.studentId === f.ali).token;
        // nothing until the deputy publishes
        expect(await f.t.query(A.guardianReports.report, { token })).toBeNull();
        await f.t.mutation(A.studentOpinions.setRound, { sessionToken: f.deputy, id: roundId, published: true });
        const report = await f.t.query(A.guardianReports.report, { token });
        expect(report).toMatchObject({ studentName: "طالب أول", className: "12-1" });
        expect(report.subjects.map((s: any) => s.subject)).toEqual(["الرياضيات", "الفيزياء"]);
        expect(JSON.stringify(report)).not.toContain("معلم الرياضيات");
        expect(JSON.stringify(report)).not.toContain("55000001");
        expect(await f.t.query(A.guardianReports.report, { token: "0".repeat(48) })).toBeNull();
        await f.t.mutation(A.guardianReports.opened, { token });
        await f.t.mutation(A.guardianReports.opened, { token });
        const after = await f.t.query(A.studentOpinions.overview, { sessionToken: f.deputy, roundId });
        expect(after.links.find((l: any) => l.studentId === f.ali).openCount).toBe(2);
        // an expired link no longer opens, and a new one is issued in its place
        await f.t.run(async ctx => { const l = (await ctx.db.query("guardianLinks").collect()).find(x => x.token === token)!; await ctx.db.patch(l._id, { expiresAt: 1 }); });
        expect(await f.t.query(A.guardianReports.report, { token })).toBeNull();
        expect(await f.t.mutation(A.studentOpinions.issueLinks, { sessionToken: f.deputy, roundId, days: 30 })).toBe(1);
    });
});
