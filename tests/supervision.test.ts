import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { applyFilters, submittedOnly, countByRole } from "../src/lib/visitStats";

const modules = import.meta.glob("../convex/**/*.ts");
const A = api as any;
async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "TEST", createdAt: "2026-09-01", deputyPin: "test-deputy", coordinatorPin: "test-coordinator" });
        const visitorId = await ctx.db.insert("supervisors", { schoolId, fullName: "منسق اختبار", role: "coordinator", subjects: ["العلوم"], isActive: true });
        const teacherId = await ctx.db.insert("schoolTeachers", { schoolId, fullName: "معلم اختبار", department: "العلوم", isActive: true });
        const otherTeacher = await ctx.db.insert("schoolTeachers", { schoolId, fullName: "معلم آخر", department: "الرياضيات", isActive: true });
        const base = { schoolId, visitorId, visitorRole: "coordinator" as const, visitorName: "منسق اختبار", className: "10", lessonTopic: "درس", visitDate: "2026-09-01", followUpType: "full" as const, visitNumber: 1, ratings: "{}", averageScore: 0.5, domainAverages: "{}", status: "submitted" as const, createdAt: 1, updatedAt: 1, planningRec: "توصية اختبار", snapshot: JSON.stringify({ criteria: [], schoolName: "الاسم وقت الاعتماد", academicYear: "2026" }) };
        const visitId = await ctx.db.insert("supervisionVisits", { ...base, teacherId, teacherName: "معلم اختبار", teacherDepartment: "العلوم", subjectName: "العلوم" });
        const otherVisit = await ctx.db.insert("supervisionVisits", { ...base, teacherId: otherTeacher, teacherName: "معلم آخر", teacherDepartment: "الرياضيات", subjectName: "الرياضيات" });
        return { schoolId, visitorId, teacherId, otherTeacher, visitId, otherVisit };
    });
    const token = "a".repeat(64), deputy = "b".repeat(64);
    const login = await t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: ids.visitorId, name: "اسم مزيف", pin: "test-coordinator", token });
    expect(login.session.name).toBe("منسق اختبار");
    await t.mutation(A.supervisionSessions.login, { role: "deputy", name: "نائب اختبار", pin: "test-deputy", token: deputy });
    return { t, ...ids, token, deputy };
}

describe("supervision authorization and official-form preservation", () => {
    it("rejects anonymous and forged sessions; filters teacher, visit and trash reads on the server", async () => {
        const f = await fixture();
        await expect(f.t.query(A.visits.listVisits, {})).rejects.toThrow();
        await expect(f.t.query(A.visits.listVisits, { sessionToken: "forged" })).rejects.toThrow();
        const setup = await f.t.query(A.visits.getSetup, { sessionToken: f.token });
        expect(setup.teachers.map((x: any) => x._id)).toEqual([f.teacherId]);
        expect((await f.t.query(A.visits.listVisits, { sessionToken: f.token })).map((x: any) => x._id)).toEqual([f.visitId]);
        await f.t.run(ctx => ctx.db.patch(f.otherVisit, { deletedAt: 1 }));
        expect(await f.t.query(A.visits.listVisits, { sessionToken: f.token, deleted: true })).toEqual([]);
        await expect(f.t.query(A.visits.getVisitForm, { sessionToken: f.token, id: f.otherVisit })).rejects.toThrow();
        await expect(f.t.mutation(A.visits.deleteVisit, { sessionToken: f.token, id: f.visitId, reason: "x" })).rejects.toThrow();
    });
    it("fails closed when department assignments disappear, invalidates changed PINs and logout", async () => {
        const f = await fixture();
        await f.t.run(ctx => ctx.db.patch(f.visitorId, { subjects: [] }));
        expect(await f.t.query(A.visits.listVisits, { sessionToken: f.token })).toEqual([]);
        await f.t.run(ctx => ctx.db.patch(f.schoolId, { coordinatorPin: "changed" }));
        await expect(f.t.query(A.visits.listVisits, { sessionToken: f.token })).rejects.toThrow();
        await f.t.mutation(A.supervisionSessions.logout, { token: f.deputy });
        expect(await f.t.query(A.supervisionSessions.current, { token: f.deputy })).toBeNull();
    });
    it("locks repeated failed login attempts without rolling back the counter", async () => {
        const f = await fixture();
        for (let i = 0; i < 8; i++) await f.t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: f.visitorId, name: "x", pin: "wrong", token: "c".repeat(64) });
        const result = await f.t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: f.visitorId, name: "x", pin: "test-coordinator", token: "d".repeat(64) });
        expect(result.error).toContain("محاولات كثيرة");
    });
    it("keeps original print snapshot and rejects legacy visit writes", async () => {
        const f = await fixture();
        const printed = await f.t.query(A.visits.getVisitForm, { sessionToken: f.token, id: f.visitId });
        expect(printed.form.schoolName).toBe("الاسم وقت الاعتماد");
        expect(printed.criteria).toEqual([]);
        await expect(f.t.mutation(A.supervision.signVisitAsTeacher, { sessionToken: f.deputy, id: f.visitId })).rejects.toThrow();
    });
    it("rejects out-of-scope teachers and concurrent changes when saving visits", async () => {
        const f = await fixture();
        const args = { sessionToken: f.token, visitorRole: "deputy", visitorName: "مزيف", teacherId: f.otherTeacher, subjectName: "الرياضيات", lessonTopic: "درس", visitDate: "2026-09-01", ratings: "{}", status: "draft" };
        await expect(f.t.mutation(A.visits.saveVisit, args)).rejects.toThrow("خارج");
        await expect(f.t.mutation(A.visits.saveVisit, { ...args, id: f.visitId, teacherId: f.teacherId, expectedUpdatedAt: 0 })).rejects.toThrow("جلسة أخرى");
    });
});

describe("follow-up and acknowledgement outside the official form", () => {
    it("requires evidence and the correct teacher's visit; detects concurrent edits", async () => {
        const f = await fixture();
        const args = { sessionToken: f.token, teacherId: f.teacherId, visitId: f.visitId, kind: "improvement", title: "تنفيذ توصية", owner: "معلم اختبار", dueDate: "2026-10-01", evidence: "", status: "open" };
        const before = await f.t.run(ctx => ctx.db.get(f.visitId));
        const id = await f.t.mutation(A.supervisionActions.save, args);
        await expect(f.t.mutation(A.supervisionActions.save, { ...args, status: "done" })).rejects.toThrow("دليل");
        await expect(f.t.mutation(A.supervisionActions.save, { ...args, completionVisitId: f.otherVisit })).rejects.toThrow();
        await expect(f.t.mutation(A.supervisionActions.save, { ...args, id, expectedUpdatedAt: 0 })).rejects.toThrow("مستخدم آخر");
        const row = (await f.t.query(A.supervisionActions.list, { sessionToken: f.token }))[0];
        await f.t.mutation(A.supervisionActions.save, { ...args, id, expectedUpdatedAt: row.updatedAt, status: "done", evidence: "تم التنفيذ والتحقق" });
        expect(await f.t.run(ctx => ctx.db.get(f.visitId))).toEqual(before);
    });
    it("requires a completed visit before closing a scheduled visit", async () => {
        const f = await fixture();
        await expect(f.t.mutation(A.supervisionActions.save, { sessionToken: f.token, teacherId: f.teacherId, kind: "visit", title: "زيارة", owner: "المنسق", dueDate: "2026-10-01", evidence: "تمت", status: "done" })).rejects.toThrow("اربط");
    });
    it("supports one acknowledgement, revocation and invalidation after the visit changes", async () => {
        const f = await fixture(), link = "e".repeat(64);
        await f.t.mutation(A.supervisionAcknowledgements.create, { sessionToken: f.token, visitId: f.visitId, token: link });
        const view = await f.t.query(A.supervisionAcknowledgements.read, { token: link });
        expect(view.teacherName).toBe("معلم اختبار");
        expect(view.ratings).toBeUndefined();
        const before = await f.t.run(ctx => ctx.db.get(f.visitId));
        await f.t.mutation(A.supervisionAcknowledgements.acknowledge, { token: link, comment: "تم الاطلاع" });
        await expect(f.t.mutation(A.supervisionAcknowledgements.acknowledge, { token: link, comment: "مرة ثانية" })).rejects.toThrow();
        expect(await f.t.run(ctx => ctx.db.get(f.visitId))).toEqual(before);
        await f.t.run(ctx => ctx.db.patch(f.visitId, { updatedAt: 2 }));
        expect(await f.t.query(A.supervisionAcknowledgements.read, { token: link })).toBeNull();
        const second = "f".repeat(64);
        await f.t.mutation(A.supervisionAcknowledgements.create, { sessionToken: f.token, visitId: f.visitId, token: second });
        const rows = await f.t.query(A.supervisionAcknowledgements.status, { sessionToken: f.token, visitId: f.visitId });
        const active = rows.find((r: any) => !r.acknowledgedAt && !r.revoked);
        await f.t.mutation(A.supervisionAcknowledgements.revoke, { sessionToken: f.token, id: active._id });
        expect(await f.t.query(A.supervisionAcknowledgements.read, { token: second })).toBeNull();
    });
    it("keeps previous years and drafts out of annual visit counts", () => {
        const rows = [{ visitDate: "2025-09-01", visitorRole: "coordinator", status: "submitted" }, { visitDate: "2026-09-01", visitorRole: "coordinator", status: "submitted" }, { visitDate: "2026-09-02", visitorRole: "coordinator", status: "draft" }] as any;
        const annual = submittedOnly(applyFilters(rows, { department: "", teacherId: "", role: "", from: "2026-08-30", to: "2027-06-30" }));
        expect(countByRole(annual).coordinator).toBe(1);
    });
});


describe("coordinator records the supervisor visit", () => {
    it("keeps the real visitor and recorder separate and enforces department scope", async () => {
        const f = await fixture();
        const supervisor = await f.t.run(ctx => ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "موجه اختبار", role: "supervisor", subjects: ["العلوم"], isActive: true }));
        const args = { sessionToken: f.token, visitorRole: "supervisor", visitorId: supervisor, visitorName: "اسم مزيف", teacherId: f.teacherId, subjectName: "العلوم", lessonTopic: "درس", visitDate: "2026-09-01", ratings: "{}", status: "draft" };
        const result = await f.t.mutation(A.visits.saveVisit, args);
        const saved = await f.t.run(ctx => ctx.db.get(result.id));
        expect(saved?.visitorName).toBe("موجه اختبار");
        expect(saved?.visitorRole).toBe("supervisor");
        expect(saved?.recordedByVisitorId).toBe(f.visitorId);
        expect(saved?.recordedByName).toBe("منسق اختبار");
        await expect(f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: saved?.updatedAt })).resolves.toMatchObject({ ok: true });
        const blockedLogin = await f.t.mutation(A.supervisionSessions.login, { role: "supervisor", visitorId: supervisor, name: "موجه", pin: "x", token: "e".repeat(64) });
        expect(blockedLogin.error).toContain("المنسق");
        await f.t.run(ctx => ctx.db.patch(supervisor, { subjects: ["الرياضيات"] }));
        await expect(f.t.mutation(A.visits.saveVisit, args)).rejects.toThrow("غير مسجل لهذا القسم");
    });
    it("uses the deputy name from settings, never from the login request", async () => {
        const f = await fixture();
        await f.t.mutation(A.visits.updateSettings, { sessionToken: f.deputy, deputyName: "نائب جديد" });
        expect((await f.t.query(A.supervisionSessions.current, { token: f.deputy })).name).toBe("نائب جديد");
        const directory = await f.t.query(A.supervisionSessions.directory, {});
        expect(directory.deputyName).toBe("نائب جديد");
        const result = await f.t.mutation(A.supervisionSessions.login, { role: "deputy", name: "اسم مزيف", pin: "test-deputy", token: "f".repeat(64) });
        expect(result.session.name).toBe("نائب جديد");
    });
});
