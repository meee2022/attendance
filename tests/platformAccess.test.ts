import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const A = api as any;
const modules = import.meta.glob("../convex/**/*.ts");
async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "TEST", createdAt: "2026", adminPin: "admin-test", deputyPin: "deputy-test", teacherPin: "teacher-test" });
        const classId = await ctx.db.insert("classes", { schoolId, name: "10-1", grade: 10, isActive: true });
        const studentId = await ctx.db.insert("students", { schoolId, classId, fullName: "طالب تجريبي", nationalId: "private-id", guardianPhone: "private-phone", isActive: true });
        return { schoolId, classId, studentId };
    });
    const admin = "a".repeat(64), teacher = "b".repeat(64), deputy = "c".repeat(64);
    for (const [role, pin, token] of [["admin", "admin-test", admin], ["teacher", "teacher-test", teacher], ["deputy", "deputy-test", deputy]]) {
        expect((await t.mutation(A.supervisionSessions.login, { role, pin, token, name: "اسم مزور" })).session.role).toBe(role);
    }
    return { t, ...ids, admin, teacher, deputy };
}
describe("platform data protection", () => {
    it("protects task links by audience and visibility and restricts editing to staff", async () => {
        const f = await fixture();
        const task = { title: "مهمة اختبار", url: "https://example.com/task", description: "", audience: ["teacher"], audienceLabel: "", category: "عام", academicYear: "2026-2027", order: 2, isActive: true };
        await expect(f.t.query(A.teacherTasks.list, {})).rejects.toThrow();
        await expect(f.t.mutation(A.teacherTasks.save, { ...task, sessionToken: f.teacher })).rejects.toThrow();
        await expect(f.t.query(A.teacherTasks.manage, { sessionToken: f.teacher })).rejects.toThrow();
        for (const url of ["javascript:alert(1)", "//evil.example", "http://example.com", "https://user:pass@example.com", "/settings"]) {
            await expect(f.t.mutation(A.teacherTasks.save, { ...task, url, sessionToken: f.admin })).rejects.toThrow();
        }
        const id = await f.t.mutation(A.teacherTasks.save, { ...task, sessionToken: f.admin });
        await f.t.mutation(A.teacherTasks.save, { ...task, title: "للمنسق فقط", audience: ["coordinator"], order: 1, sessionToken: f.deputy });
        expect((await f.t.query(A.teacherTasks.list, { sessionToken: f.teacher })).map((t: any) => t.title)).toEqual([task.title]);
        expect((await f.t.query(A.teacherTasks.list, { sessionToken: f.deputy })).length).toBe(2);
        await f.t.mutation(A.teacherTasks.save, { ...task, id, url: "/grades", sessionToken: f.deputy });
        expect((await f.t.query(A.teacherTasks.list, { sessionToken: f.teacher }))[0].url).toBe("/grades");
        await f.t.mutation(A.teacherTasks.setVisible, { id, isActive: false, sessionToken: f.admin });
        expect(await f.t.query(A.teacherTasks.list, { sessionToken: f.teacher })).toEqual([]);
        expect((await f.t.query(A.teacherTasks.manage, { sessionToken: f.admin })).length).toBe(2);
    });
    it("lets admin and deputy reset private coordinator codes, revoking old sessions without exposing codes", async () => {
        const f = await fixture();
        const id = await f.t.run(ctx => ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "منسق اختبار", role: "coordinator", subjects: ["العلوم"], isActive: true }));
        await expect(f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.teacher, id, pin: "654321" })).rejects.toThrow();
        await expect(f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.admin, id, pin: "123" })).rejects.toThrow();
        await f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.admin, id, pin: "654321" });
        const people = await f.t.query(A.supervision.getSupervisors, { sessionToken: f.deputy });
        expect(people[0].hasPrivatePin).toBe(true);
        expect(people[0].pin).toBeUndefined();
        const token = "d".repeat(64);
        const args = { role: "coordinator", visitorId: id, name: "x", pin: "654321", token };
        expect((await f.t.mutation(A.supervisionSessions.login, args)).session.role).toBe("coordinator");
        await expect(f.t.mutation(A.supervision.updateSupervisor, { sessionToken: token, id, pin: "987654" })).rejects.toThrow();
        await f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.deputy, id, pin: "987654" });
        expect(await f.t.query(A.supervisionSessions.current, { token })).toBeNull();
        expect((await f.t.mutation(A.supervisionSessions.login, { ...args, token: "e".repeat(64) })).error).toBeTruthy();
        expect((await f.t.mutation(A.supervisionSessions.login, { ...args, pin: "987654", token: "f".repeat(64) })).session).toBeTruthy();
        await f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.admin, id, pin: "654321" });
        expect(await f.t.query(A.supervisionSessions.current, { token })).toBeNull();
        const other = await f.t.run(ctx => ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "منسق آخر", role: "coordinator", subjects: ["العلوم"], isActive: true }));
        await expect(f.t.mutation(A.supervision.updateSupervisor, { sessionToken: f.admin, id: other, pin: "654321" })).rejects.toThrow();
    });
    it("rejects anonymous and forged direct API reads, including school configuration and student data", async () => {
        const f = await fixture();
        for (const query of [A.setup.getInitialData, A.setup.getStudentCounts, A.grades.getClassesAndSubjects, A.settings.getHiddenFeatures, A.diagnostics.listTests]) {
            await expect(f.t.query(query, {})).rejects.toThrow();
            await expect(f.t.query(query, { sessionToken: "forged" })).rejects.toThrow();
        }
        await expect(f.t.query(A.students.getStudentsByClass, { classId: f.classId })).rejects.toThrow();
    });
    it("redacts identifiers and contact details from teachers but retains academic roster data", async () => {
        const f = await fixture();
        const rows = await f.t.query(A.students.getStudentsByClass, { sessionToken: f.teacher, classId: f.classId });
        expect(rows[0].fullName).toBe("طالب تجريبي");
        expect(rows[0].nationalId).toBeUndefined(); expect(rows[0].guardianPhone).toBeUndefined();
        const privileged = await f.t.query(A.students.getStudentsByClass, { sessionToken: f.admin, classId: f.classId });
        expect(privileged[0].guardianPhone).toBe("private-phone");
        const initial = await f.t.query(A.setup.getInitialData, { sessionToken: f.admin });
        expect(initial.schools[0].teacherPin).toBeUndefined(); expect(initial.schools[0].adminPin).toBeUndefined();
        await expect(f.t.query(A.grades.getGuardianPhone, { sessionToken: f.teacher, studentName: "طالب تجريبي" })).rejects.toThrow();
    });
    it("does not let teachers access supervision, settings or data administration", async () => {
        const f = await fixture();
        await expect(f.t.query(A.visits.getSetup, { sessionToken: f.teacher })).rejects.toThrow();
        await expect(f.t.mutation(A.settings.toggleFeature, { sessionToken: f.teacher, featureKey: "/grades", hidden: true })).rejects.toThrow();
        await expect(f.t.mutation(A.students.deleteAllStudentsAndAttendance, { sessionToken: f.teacher })).rejects.toThrow();
        await expect(f.t.mutation(A.settings.updateCurrentDate, { sessionToken: f.deputy, date: "2026-10-01" })).resolves.toBeTruthy();
        await expect(f.t.mutation(A.settings.setTeacherAccess, { sessionToken: f.deputy, enabled: false })).rejects.toThrow();
    });
    it("gives the platform admin independent access without impersonating the deputy", async () => {
        const f = await fixture();
        const session = await f.t.query(A.supervisionSessions.current, { token: f.admin });
        expect(session.role).toBe("admin"); expect(session.name).toBe("مسؤول المنصة");
        await expect(f.t.query(A.visits.getSetup, { sessionToken: f.admin })).resolves.toBeTruthy();
        const teacher = await f.t.mutation(A.supervision.addSchoolTeacher, { sessionToken: f.admin, fullName: "معلم جديد", department: "العلوم" });
        expect((await f.t.query(A.supervision.getSchoolTeachers, { sessionToken: f.admin })).some((t: any) => t.fullName === "معلم جديد")).toBe(true);
        await expect(f.t.mutation(A.visitWorkflow.setMySignature, { sessionToken: f.admin, storageId: null })).rejects.toThrow();
    });
    it("never grants administrative access using an unset default code", async () => {
        const f = await fixture();
        await f.t.run(ctx => ctx.db.patch(f.schoolId, { adminPin: undefined, deputyPin: undefined }));
        for (const [role, pin] of [["admin", "1234"], ["deputy", "3333"], ["admin", ""]]) {
            const result = await f.t.mutation(A.supervisionSessions.login, { role, pin, name: "x", token: "f".repeat(64) });
            expect(result.session).toBeUndefined();
            expect(result.error).toBeTruthy();
        }
        expect(await f.t.query(A.supervisionSessions.current, { token: f.admin })).toBeNull();
    });
    it("revokes teacher sessions on code changes and never supplies a default teacher code", async () => {
        const f = await fixture();
        await f.t.mutation(A.settings.setTeacherAccess, { sessionToken: f.admin, enabled: true, newPin: "654321" });
        expect(await f.t.query(A.supervisionSessions.current, { token: f.teacher })).toBeNull();
        await f.t.mutation(A.settings.setTeacherAccess, { sessionToken: f.admin, enabled: false });
        const login = await f.t.mutation(A.supervisionSessions.login, { role: "teacher", pin: "654321", token: "d".repeat(64), name: "x" });
        expect(login.error).toContain("غير مفعّل");
    });
    it("revokes admin access after PIN rotation or expiry and rate-limits incorrect passwords", async () => {
        const f = await fixture();
        await f.t.run(ctx => ctx.db.patch(f.schoolId, { adminPin: "changed" }));
        expect(await f.t.query(A.supervisionSessions.current, { token: f.admin })).toBeNull();
        const args = { role: "admin", name: "x", pin: "wrong", token: "e".repeat(64) };
        for (let i = 0; i < 8; i++) await f.t.mutation(A.supervisionSessions.login, args);
        expect((await f.t.mutation(A.supervisionSessions.login, { ...args, pin: "changed" })).error).toContain("محاولات كثيرة");
        await f.t.run(async ctx => { for (const s of await ctx.db.query("supervisionSessions").collect()) await ctx.db.patch(s._id, { expiresAt: 1 }); });
        await expect(f.t.query(A.setup.getInitialData, { sessionToken: f.teacher })).rejects.toThrow();
    });
    it("keeps raw public builders confined to audited login, token-link and wrapper modules", () => {
        const allowed = new Set(["platformAccess.ts", "supervisionAccess.ts", "supervisionSessions.ts", "supervisionAcknowledgements.ts", "visitImports.ts"]);
        for (const file of readdirSync("convex").filter(x => x.endsWith(".ts") && !allowed.has(x))) {
            expect(readFileSync(`convex/${file}`, "utf8")).not.toMatch(/import[^;]*["']\.\/_generated\/server["']/);
        }
    });
});
