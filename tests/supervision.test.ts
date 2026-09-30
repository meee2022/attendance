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

describe("correcting the teacher of a submitted visit", () => {
    it("is the deputy's alone, needs a reason, and renumbers the visit under the new teacher", async () => {
        const f = await fixture();
        await f.t.run(async ctx => {
            const signature = await ctx.storage.store(new Blob(["test signature"], { type: "image/png" }));
            await ctx.db.insert("supervisionSettings", { schoolId: f.schoolId, academicYear: "2026 - 2027", deputySignatureId: signature });
        });
        const { newTeacher, classId } = await f.t.run(async ctx => ({
            newTeacher: await ctx.db.insert("schoolTeachers", { schoolId: f.schoolId, fullName: "المعلم الصحيح", department: "العلوم", isActive: true }),
            classId: await ctx.db.insert("classes", { schoolId: f.schoolId, name: "10-1", grade: 10, isActive: true }),
        }));
        const edit = (sessionToken: string, teacherId: any, editReason?: string) => f.t.mutation(A.visits.saveVisit, {
            sessionToken, id: f.visitId, expectedUpdatedAt: 1, visitorRole: "coordinator", visitorName: "منسق اختبار",
            teacherId, classId, subjectName: "العلوم", lessonTopic: "درس", visitDate: "2026-09-01", followUpType: "full",
            ratings: "{}", planningRec: "توصية اختبار", status: "submitted", editReason, confirmDuplicate: true,
        });
        await expect(edit(f.token, newTeacher, "اختيار خاطئ")).rejects.toThrow();
        await expect(edit(f.deputy, newTeacher)).rejects.toThrow();
        await edit(f.deputy, newTeacher, "اختيار خاطئ");
        const moved = await f.t.run(ctx => ctx.db.get(f.visitId));
        expect(moved?.teacherId).toBe(newTeacher);
        expect(moved?.teacherName).toBe("المعلم الصحيح");
        expect(moved?.visitNumber).toBe(1);
        const versions = await f.t.run(ctx => ctx.db.query("supervisionVisitVersions").collect());
        expect(versions.map(v => v.reason)).toEqual(["اختيار خاطئ"]);
    });
});

describe("coordinator then deputy approval", () => {
    it("queues coordinator approval, requires the deputy's signature, freezes it, and invalidates approval after changes", async () => {
        const f = await fixture();
        const classId = await f.t.run(ctx => ctx.db.insert("classes", { schoolId: f.schoolId, name: "10-1", grade: 10, isActive: true }));
        const args = { visitorRole: "coordinator", visitorName: "منسق اختبار", teacherId: f.teacherId, classId,
            subjectName: "العلوم", lessonTopic: "درس", visitDate: "2026-09-01", followUpType: "full",
            ratings: "{}", planningRec: "توصية", status: "submitted", confirmDuplicate: true };
        const result = await f.t.mutation(A.visits.saveVisit, { ...args, sessionToken: f.token });
        expect(result).toMatchObject({ status: "draft", awaitingDeputy: true });
        let visit = await f.t.run(ctx => ctx.db.get(result.id));
        expect(visit.reviewRequest.toRole).toBe("deputy");
        expect(visit.coordinatorApproval.name).toBe("منسق اختبار");
        expect(visit.submittedAt).toBeUndefined();
        await expect(f.t.mutation(A.visitWorkflow.logSend, { sessionToken: f.token, visitId: result.id, via: "test" })).rejects.toThrow("المعتمدة");
        await expect(f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: visit.updatedAt, sessionToken: f.deputy })).rejects.toThrow("توقيع");
        const settingsId = await f.t.run(async ctx => {
            const signature = await ctx.storage.store(new Blob(["signature"], { type: "image/png" }));
            return ctx.db.insert("supervisionSettings", { schoolId: f.schoolId, academicYear: "2026 - 2027", deputyName: "نائب الاعتماد", deputySignatureId: signature });
        });
        await f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: visit.updatedAt, sessionToken: f.deputy });
        visit = await f.t.run(ctx => ctx.db.get(result.id));
        expect(visit.status).toBe("submitted");
        expect(visit.deputyApproval.name).toBe("نائب الاعتماد");
        expect(visit.reviewRequest).toBeUndefined();
        const printed = await f.t.query(A.visits.getVisitForm, { sessionToken: f.token, id: result.id });
        expect(printed.form.deputyApprovalSignatureUrl).toBeTruthy();
        await f.t.run(ctx => ctx.db.patch(settingsId, { deputyName: "نائب جديد", deputySignatureId: undefined }));
        const unchanged = await f.t.query(A.visits.getVisitForm, { sessionToken: f.token, id: result.id });
        expect(unchanged.visit.deputyApproval.name).toBe("نائب الاعتماد");
        expect(unchanged.form.deputyApprovalSignatureUrl).toBe(printed.form.deputyApprovalSignatureUrl);
        await f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: visit.updatedAt, planningRec: "توصية معدلة", sessionToken: f.token });
        visit = await f.t.run(ctx => ctx.db.get(result.id));
        expect(visit.status).toBe("draft");
        expect(visit.deputyApproval).toBeUndefined();
        expect(visit.reviewRequest.toRole).toBe("deputy");
        await f.t.mutation(A.visitWorkflow.returnVisit, { sessionToken: f.deputy, visitId: result.id, note: "راجع التوصيات" });
        visit = await f.t.run(ctx => ctx.db.get(result.id));
        expect(visit.coordinatorApproval).toBeUndefined();
        await expect(f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: visit.updatedAt, sessionToken: f.deputy })).rejects.toThrow("المنسق أولاً");
    });
});

describe("review before submitting", () => {
    it("lets only the chosen colleague edit or return a draft, and only the owner send it", async () => {
        const f = await fixture();
        const ids = await f.t.run(async ctx => {
            const colleague = await ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "منسق زميل", role: "coordinator", subjects: ["العلوم"], isActive: true });
            const outsider = await ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "منسق آخر", role: "coordinator", subjects: ["العلوم"], isActive: true });
            const draft = await ctx.db.insert("supervisionVisits", { schoolId: f.schoolId, visitorId: f.visitorId, visitorRole: "coordinator", visitorName: "منسق اختبار",
                teacherId: f.teacherId, teacherName: "معلم اختبار", teacherDepartment: "العلوم", subjectName: "العلوم", className: "10", lessonTopic: "درس",
                visitDate: "2026-09-01", followUpType: "full", visitNumber: 0, ratings: "{}", averageScore: 0, domainAverages: "{}", status: "draft", createdAt: 1, updatedAt: 1 });
            return { colleague, outsider, draft };
        });
        const colleague = "e".repeat(64), outsider = "f".repeat(64);
        await f.t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: ids.colleague, name: "x", pin: "test-coordinator", token: colleague });
        await f.t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: ids.outsider, name: "x", pin: "test-coordinator", token: outsider });

        // a colleague cannot send someone else's draft
        await expect(f.t.mutation(A.visitWorkflow.requestReview, { sessionToken: colleague, visitId: ids.draft, toRole: "deputy" })).rejects.toThrow();
        await f.t.mutation(A.visitWorkflow.requestReview, { sessionToken: f.token, visitId: ids.draft, toRole: "coordinator", toVisitorId: ids.colleague, note: "راجعها" });

        await expect(f.t.mutation(A.visitWorkflow.returnVisit, { sessionToken: outsider, visitId: ids.draft, note: "x" })).rejects.toThrow();
        await f.t.mutation(A.visitWorkflow.returnVisit, { sessionToken: colleague, visitId: ids.draft, note: "عدّل التوصيات" });
        const back = await f.t.run(ctx => ctx.db.get(ids.draft));
        expect(back?.reviewRequest).toBeUndefined();
        expect(back?.reviewReturn?.note).toBe("عدّل التوصيات");
        // once returned, the colleague has no more say
        await expect(f.t.mutation(A.visitWorkflow.returnVisit, { sessionToken: colleague, visitId: ids.draft, note: "x" })).rejects.toThrow();
    });
});

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


describe("PDF visit imports", () => {
    it("validates files, stores originals, blocks reuse and requires review before submission", async () => {
        const f = await fixture();
        const bytes = new TextEncoder().encode("%PDF-1.7\nfixture").buffer;
        await expect(f.t.action(A.visitImports.upload, { sessionToken: "forged", bytes, filename: "visit.pdf" })).rejects.toThrow();
        await expect(f.t.action(A.visitImports.upload, { sessionToken: f.token, bytes: new TextEncoder().encode("not a pdf").buffer, filename: "visit.pdf" })).rejects.toThrow();
        const sourceImportId = await f.t.action(A.visitImports.upload, { sessionToken: f.token, bytes, filename: "visit.pdf" });
        expect(await f.t.action(A.visitImports.upload, { sessionToken: f.token, bytes, filename: "visit.pdf" })).toBe(sourceImportId);
        const supervisor = await f.t.run(ctx => ctx.db.insert("supervisors", { schoolId: f.schoolId, fullName: "موجه", role: "supervisor", subjects: ["العلوم"], isActive: true }));
        const args = { sessionToken: f.token, sourceImportId, visitorRole: "supervisor", visitorId: supervisor, visitorName: "", teacherId: f.teacherId, subjectName: "العلوم", lessonTopic: "درس", visitDate: "2026-09-29", ratings: "{}", status: "draft" };
        const result = await f.t.mutation(A.visits.saveVisit, args);
        const saved = await f.t.run(ctx => ctx.db.get(result.id));
        expect(saved?.sourceImportId).toBe(sourceImportId);
        expect((await f.t.query(A.visitImports.original, { sessionToken: f.token, visitId: result.id })).filename).toBe("visit.pdf");
        await expect(f.t.mutation(A.visits.saveVisit, args)).rejects.toThrow("مرتبط");
        await expect(f.t.action(A.visitImports.upload, { sessionToken: f.token, bytes, filename: "again.pdf" })).rejects.toThrow("مرتبط");
        await expect(f.t.mutation(A.visits.saveVisit, { ...args, id: result.id, expectedUpdatedAt: saved?.updatedAt, status: "submitted" })).rejects.toThrow("راجع");
        await expect(f.t.query(A.visitImports.original, { sessionToken: f.token, visitId: f.otherVisit })).rejects.toThrow();
    });
});
