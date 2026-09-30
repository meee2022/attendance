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
    it("imports scores atomically, preserves existing marks, and rejects stale previews and invalid students", async () => {
        const f = await fixture();
        const row = { studentId: f.studentId, cells: [{ key: "a1", value: 18, expected: null, max: 20 }] };
        const args = { mode: "grades", className: "10-1", subjectName: "علوم", overwrite: false, rows: [row], sessionToken: f.teacher };
        expect((await f.t.mutation(A.scoreImports.save, args)).changed).toBe(1);
        await expect(f.t.mutation(A.scoreImports.save, args)).rejects.toThrow("تغيرت درجات");
        const updated = { ...row, cells: [{ key: "a1", value: 14, expected: 18, max: 20 }] };
        expect((await f.t.mutation(A.scoreImports.save, { ...args, rows: [updated] })).skipped).toBe(1);
        expect((await f.t.mutation(A.scoreImports.save, { ...args, overwrite: true, rows: [updated] })).changed).toBe(1);
        await expect(f.t.mutation(A.scoreImports.save, { ...args, overwrite: true, rows: [{ ...row, cells: [{ key: "a2", value: 10, expected: null, max: 20 }, { key: "a3", value: 21, expected: null, max: 20 }] }] })).rejects.toThrow();
        const saved = await f.t.query(A.grades.getGradesByClassSubject, { sessionToken: f.teacher, className: "10-1", subjectName: "علوم" });
        expect(saved[0].a1).toBe(14); expect(saved[0].a2).toBeUndefined();
        const testId = await f.t.mutation(A.diagnostics.createTest, { sessionToken: f.admin, title: "تشخيص", subjectName: "علوم", grade: 10, classNames: ["10-1"], questions: [{ n: 1, maxMark: 50 }] });
        await f.t.mutation(A.scoreImports.save, { mode: "diagnostics", className: "10-1", testId, overwrite: false, rows: [{ studentId: f.studentId, expectedAbsent: false, cells: [{ key: "1", value: 40, expected: null, max: 50 }] }], sessionToken: f.teacher });
        const sheet = await f.t.query(A.diagnostics.getEntrySheet, { sessionToken: f.teacher, testId, className: "10-1" });
        expect(sheet.students[0].total).toBe(40);
        await expect(f.t.mutation(A.scoreImports.save, { ...args, rows: [row, row] })).rejects.toThrow();
        await expect(f.t.mutation(A.scoreImports.save, { ...args, sessionToken: "fake" })).rejects.toThrow();
    });
    it("allows teachers to configure diagnostic marks before entry and locks recorded tests", async () => {
        const f = await fixture();
        const questions = [{ n: 1, maxMark: 10 }, { n: 2, maxMark: 10 }];
        const id = await f.t.mutation(A.diagnostics.createTest, { sessionToken: f.admin, title: "اختبار", subjectName: "علوم", grade: 10, classNames: ["10-1"], questions });
        const marks = [{ n: 1, maxMark: 25 }, { n: 2, maxMark: 25 }];
        await f.t.mutation(A.diagnostics.configureMarks, { sessionToken: f.teacher, testId: id, expectedQuestions: JSON.stringify(questions), marks });
        expect((await f.t.query(A.diagnostics.getTest, { sessionToken: f.teacher, testId: id })).totalMarks).toBe(50);
        await expect(f.t.mutation(A.diagnostics.configureMarks, { sessionToken: f.teacher, testId: id, expectedQuestions: JSON.stringify(questions), marks })).rejects.toThrow();
        await expect(f.t.mutation(A.diagnostics.configureMarks, { sessionToken: f.teacher, testId: id, expectedQuestions: JSON.stringify(marks), marks: [{ n: 1, maxMark: -1 }, marks[1]] })).rejects.toThrow();
        await f.t.mutation(A.diagnostics.setScore, { sessionToken: f.teacher, testId: id, studentId: f.studentId, questionNumber: 1, value: 20 });
        await expect(f.t.mutation(A.diagnostics.configureMarks, { sessionToken: f.teacher, testId: id, expectedQuestions: JSON.stringify(marks), marks: questions })).rejects.toThrow("بدأ رصد");
        expect((await f.t.query(A.diagnostics.getTest, { sessionToken: f.teacher, testId: id })).totalMarks).toBe(50);
    });
    it("archives teachers without deleting their identity and lets staff restore them", async () => {
        const f = await fixture();
        await f.t.mutation(A.supervision.addSchoolTeacher, { sessionToken: f.admin, fullName: "معلم", department: "العلوم" });
        const [teacher] = await f.t.query(A.supervision.getSchoolTeachers, { sessionToken: f.admin });
        await f.t.mutation(A.supervision.deleteSchoolTeacher, { sessionToken: f.admin, id: teacher._id });
        expect(await f.t.query(A.supervision.getSchoolTeachers, { sessionToken: f.admin })).toHaveLength(0);
        expect((await f.t.query(A.supervision.getSchoolTeachers, { sessionToken: f.admin, includeInactive: true }))[0].isActive).toBe(false);
        await f.t.mutation(A.supervision.updateSchoolTeacher, { sessionToken: f.deputy, id: teacher._id, isActive: true });
        expect((await f.t.query(A.supervision.getSchoolTeachers, { sessionToken: f.admin }))[0]._id).toBe(teacher._id);
    });
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
        const maintenance=readFileSync('convex/visitArchiveMaintenance.ts','utf8');
        expect(maintenance).not.toMatch(/=\s*(query|mutation|action)\s*\(/);
        const allowed = new Set(["platformAccess.ts", "supervisionAccess.ts", "supervisionSessions.ts", "supervisionAcknowledgements.ts", "visitImports.ts", "visitArchiveMaintenance.ts"]);
        for (const file of readdirSync("convex").filter(x => x.endsWith(".ts") && !allowed.has(x))) {
            expect(readFileSync(`convex/${file}`, "utf8")).not.toMatch(/import[^;]*["']\.\/_generated\/server["']/);
        }
    });
});
