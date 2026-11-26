import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { INDICATORS, levelOf, totalOf } from "../convex/evaluationForm";

const modules = import.meta.glob("../convex/**/*.ts");
const A = api as any;
const full = (drop = 0) => JSON.stringify(Object.fromEntries(INDICATORS.map((i, n) => [i.id, n < drop ? i.max - 1 : i.max])));

async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "TEST", createdAt: "2026-09-01", deputyPin: "test-deputy", coordinatorPin: "test-coordinator" });
        const science = await ctx.db.insert("supervisors", { schoolId, fullName: "منسق العلوم", role: "coordinator", subjects: ["العلوم"], isActive: true });
        const maths = await ctx.db.insert("supervisors", { schoolId, fullName: "منسق الرياضيات", role: "coordinator", subjects: ["الرياضيات"], isActive: true });
        const teacher = (fullName: string, department: string) => ctx.db.insert("schoolTeachers", { schoolId, fullName, department, isActive: true });
        const ids = { schoolId, science, maths, scienceTeacher: await teacher("معلم علوم", "العلوم"), mathsTeacher: await teacher("معلم رياضيات", "الرياضيات"),
            scienceCoordinator: await teacher("منسق العلوم", "العلوم") };
        await ctx.db.insert("teacherProfiles", { schoolId, teacherId: ids.scienceTeacher, employeeNo: "1001", personalNo: "29900000001", hireDate: "01/09/2015", jobTitle: "مدرس علوم", nationality: "قطري" });
        return ids;
    });
    const tokens = { science: "a".repeat(64), maths: "c".repeat(64), deputy: "b".repeat(64) };
    await t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: ids.science, name: "x", pin: "test-coordinator", token: tokens.science });
    await t.mutation(A.supervisionSessions.login, { role: "coordinator", visitorId: ids.maths, name: "x", pin: "test-coordinator", token: tokens.maths });
    await t.mutation(A.supervisionSessions.login, { role: "deputy", name: "نائب", pin: "test-deputy", token: tokens.deputy });
    const save = (sessionToken: string, teacherId: any, scores: string, send: boolean, expectedUpdatedAt?: number) =>
        t.mutation(A.teacherEvaluations.save, { sessionToken, teacherId, scores, penalties: [], courses: [], send, expectedUpdatedAt });
    return { t, ...ids, tokens, save };
}

describe("the yearly teacher appraisal", () => {
    it("totals 100 and names the level", () => {
        expect(INDICATORS).toHaveLength(34);
        expect(INDICATORS.reduce((s, i) => s + i.max, 0)).toBe(100);
        expect(totalOf(JSON.parse(full()))).toBe(100);
        expect([49, 50, 65, 66, 75, 76, 89, 90].map(levelOf)).toEqual(["ضعيف", "مقبول", "مقبول", "جيد", "جيد", "جيد جداً", "جيد جداً", "ممتاز"]);
    });

    it("keeps each department's forms to its coordinator, and a coordinator's own form to the deputy", async () => {
        const f = await fixture();
        const rows = async (token: string) => (await f.t.query(A.teacherEvaluations.list, { sessionToken: token })).rows.map((r: any) => r.teacherName);
        expect(await rows(f.tokens.science)).toEqual(["معلم علوم"]);
        expect(await rows(f.tokens.maths)).toEqual(["معلم رياضيات"]);
        expect(await rows(f.tokens.deputy)).toHaveLength(3);
        // another department's teacher, and the coordinator's own record
        await expect(f.t.query(A.teacherEvaluations.get, { sessionToken: f.tokens.maths, teacherId: f.scienceTeacher })).rejects.toThrow();
        await expect(f.save(f.tokens.maths, f.scienceTeacher, full(), false)).rejects.toThrow();
        await expect(f.t.query(A.teacherEvaluations.get, { sessionToken: f.tokens.science, teacherId: f.scienceCoordinator })).rejects.toThrow();
        await expect(f.save(f.tokens.science, f.scienceCoordinator, full(), true)).rejects.toThrow();
        await f.save(f.tokens.deputy, f.scienceCoordinator, full(), false);
        expect(await f.t.query(A.teacherEvaluations.printForms, { sessionToken: f.tokens.maths, department: "العلوم" })).toEqual([]);
        expect(await f.t.query(A.teacherEvaluations.printForms, { sessionToken: f.tokens.science, department: "العلوم" })).toEqual([]);
    });

    it("keeps the coordinator's version while the deputy edits, approves, and the teacher signs", async () => {
        const f = await fixture();
        const get = (token: string) => f.t.query(A.teacherEvaluations.get, { sessionToken: token, teacherId: f.scienceTeacher });
        // marks above an indicator's maximum or off the half-mark step are dropped, so the form is not complete
        const withMark = (mark: number) => JSON.stringify({ ...JSON.parse(full()), "1.1": mark });
        await expect(f.save(f.tokens.science, f.scienceTeacher, withMark(9), true)).rejects.toThrow();
        await expect(f.save(f.tokens.science, f.scienceTeacher, withMark(2.3), true)).rejects.toThrow();
        expect((await f.save(f.tokens.science, f.scienceTeacher, withMark(2.5), false)).status).toBe("draft");
        expect((await f.t.query(A.teacherEvaluations.get, { sessionToken: f.tokens.science, teacherId: f.scienceTeacher })).evaluation.total).toBe(99.5);
        await f.save(f.tokens.science, f.scienceTeacher, full(), false, (await f.t.query(A.teacherEvaluations.get, { sessionToken: f.tokens.science, teacherId: f.scienceTeacher })).evaluation.updatedAt);
        let mine = await get(f.tokens.science);
        expect(mine.profile.personalNo).toBe("29900000001");
        await f.save(f.tokens.science, f.scienceTeacher, full(), true, mine.evaluation.updatedAt);
        mine = await get(f.tokens.science);
        expect(mine.editable).toBe(false);
        await expect(f.save(f.tokens.science, f.scienceTeacher, full(3), false, mine.evaluation.updatedAt)).rejects.toThrow();

        // the deputy lowers three marks: the coordinator still sees what they sent
        const review = await get(f.tokens.deputy);
        await f.t.mutation(A.teacherEvaluations.save, { sessionToken: f.tokens.deputy, teacherId: f.scienceTeacher, scores: full(3), penalties: [], courses: [], send: false,
            expectedUpdatedAt: review.evaluation.updatedAt, review: { note: "راجعت الأدلة", items: JSON.stringify({ "1.1": "لا يوجد دليل", "9.9": "x", "1.2": " " }) } });
        expect((await get(f.tokens.science)).evaluation.total).toBe(100);
        expect((await get(f.tokens.science)).evaluation.review).toBeNull();
        expect((await get(f.tokens.deputy)).evaluation.total).toBe(97);
        expect((await get(f.tokens.deputy)).evaluation.review).toEqual({ note: "راجعت الأدلة", items: { "1.1": "لا يوجد دليل" } });

        // no link before approval; after it the coordinator sees the final form beside their own
        const id = review.evaluation._id, token = "d".repeat(64);
        await expect(f.t.mutation(A.teacherEvaluations.createLink, { sessionToken: f.tokens.science, id, token })).rejects.toThrow();
        await expect(f.t.mutation(A.teacherEvaluations.approve, { sessionToken: f.tokens.science, id })).rejects.toThrow();
        await f.t.mutation(A.teacherEvaluations.approve, { sessionToken: f.tokens.deputy, id });
        mine = await get(f.tokens.science);
        expect([mine.evaluation.total, mine.evaluation.sent.total]).toEqual([97, 100]);
        expect(mine.evaluation.review.items).toEqual({ "1.1": "لا يوجد دليل" });
        // both versions print: the final form, and the coordinator's as sent
        const print = (sessionToken: string, version?: "coordinator") => f.t.query(A.teacherEvaluations.printForms, { sessionToken, teacherId: f.scienceTeacher, version });
        expect((await print(f.tokens.science))[0].total).toBe(97);
        expect((await print(f.tokens.science, "coordinator"))[0].total).toBe(100);
        expect((await print(f.tokens.deputy, "coordinator"))[0].version.name).toBeTruthy();
        expect(await f.t.query(A.teacherEvaluations.printForms, { sessionToken: f.tokens.maths, teacherId: f.scienceTeacher, version: "coordinator" })).toEqual([]);
        await expect(f.t.mutation(A.teacherEvaluations.createLink, { sessionToken: f.tokens.maths, id, token })).rejects.toThrow();
        await f.t.mutation(A.teacherEvaluations.createLink, { sessionToken: f.tokens.science, id, token });
        const form = await f.t.query(A.evaluationLinks.readLink, { token });
        expect([form.teacherName, form.total, form.level]).toEqual(["معلم علوم", 97, "ممتاز"]);
        expect(await f.t.query(A.evaluationLinks.readLink, { token: "e".repeat(64) })).toBeNull();

        const storageId = await f.t.run(ctx => ctx.storage.store(new Blob(["signature"], { type: "image/png" })));
        await f.t.mutation(A.evaluationLinks.sign, { token, storageId, comment: "" });
        expect((await f.t.query(A.evaluationLinks.readLink, { token })).signedAt).toBeTypeOf("number");
        await expect(f.t.mutation(A.evaluationLinks.sign, { token, storageId, comment: "" })).rejects.toThrow();

        // only the deputy removes a form; the teacher is then back to «لم يبدأ»
        await expect(f.t.mutation(A.teacherEvaluations.remove, { sessionToken: f.tokens.science, id })).rejects.toThrow();

        // reopening drops the signature and the link with it
        await f.t.mutation(A.teacherEvaluations.reopen, { sessionToken: f.tokens.deputy, id, reason: "تظلم" });
        expect(await f.t.query(A.evaluationLinks.readLink, { token })).toBeNull();
        expect((await get(f.tokens.deputy)).evaluation.signedAt).toBeNull();
        await f.t.mutation(A.teacherEvaluations.remove, { sessionToken: f.tokens.deputy, id });
        expect((await get(f.tokens.deputy)).evaluation).toBeNull();
        expect((await f.t.query(A.teacherEvaluations.list, { sessionToken: f.tokens.science })).rows[0].status).toBe("none");
    });

    it("splits one department between two coordinators, teacher by teacher", async () => {
        const f = await fixture();
        const { second, visitId } = await f.t.run(async ctx => {
            await ctx.db.patch(f.maths, { subjects: ["الرياضيات", "العلوم"] });
            await ctx.db.patch(f.scienceTeacher, { coordinatorId: f.science });
            const second = await ctx.db.insert("schoolTeachers", { schoolId: f.schoolId, fullName: "معلم علوم ثان", department: "العلوم", isActive: true, coordinatorId: f.maths });
            const visitId = await ctx.db.insert("supervisionVisits", { schoolId: f.schoolId, visitorId: f.maths, visitorRole: "coordinator", visitorName: "منسق الرياضيات",
                teacherId: second, teacherName: "معلم علوم ثان", teacherDepartment: "العلوم", subjectName: "العلوم", className: "10", lessonTopic: "درس", visitDate: "2026-09-01",
                followUpType: "full", visitNumber: 1, ratings: "{}", averageScore: 0.5, domainAverages: "{}", status: "submitted", createdAt: 1, updatedAt: 1 });
            return { second, visitId };
        });
        const names = async (token: string) => (await f.t.query(A.teacherEvaluations.list, { sessionToken: token })).rows.map((r: any) => r.teacherName);
        expect(await names(f.tokens.science)).toEqual(["معلم علوم"]);
        expect(await names(f.tokens.maths)).toEqual(["معلم رياضيات", "معلم علوم ثان"]);
        expect(await names(f.tokens.deputy)).toHaveLength(4);
        // the colleague's teacher, visits and form are out of reach, by id too
        const setup = await f.t.query(A.visits.getSetup, { sessionToken: f.tokens.science });
        expect(setup.teachers.map((t: any) => t.fullName)).not.toContain("معلم علوم ثان");
        expect(await f.t.query(A.visits.listVisits, { sessionToken: f.tokens.science })).toEqual([]);
        expect(await f.t.query(A.visits.listVisits, { sessionToken: f.tokens.maths })).toHaveLength(1);
        await expect(f.t.query(A.visits.getVisitForm, { sessionToken: f.tokens.science, id: visitId })).rejects.toThrow();
        await expect(f.save(f.tokens.science, second, full(), false)).rejects.toThrow();
        await expect(f.save(f.tokens.maths, f.scienceTeacher, full(), false)).rejects.toThrow();
        expect((await f.save(f.tokens.maths, second, full(), false)).status).toBe("draft");
    });
});
