import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const A = api as any;
const hex = (c: string) => c.repeat(64);

async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const schoolId = await ctx.db.insert("schools", { name: "مدرسة اختبار", code: "TEST", createdAt: "2026-09-01", deputyPin: "deputy-code", coordinatorPin: "shared-code", adminPin: "admin-code" });
        const person = (fullName: string) => ctx.db.insert("supervisors", { schoolId, fullName, role: "coordinator", subjects: ["العلوم"], isActive: true });
        const teacher = (fullName: string, email: string, phone: string) => ctx.db.insert("schoolTeachers", { schoolId, fullName, department: "العلوم", email, phone, isActive: true });
        return { schoolId, first: await person("منسق أول"), second: await person("منسق ثان"),
            teacher: await teacher("معلم أول", "first@school.qa", "55001122"), colleague: await teacher("معلم ثان", "second@school.qa", "55003344") };
    });
    const login = (role: string, pin: string, token: string, visitorId?: any) => t.mutation(A.supervisionSessions.login, { role, visitorId, name: "x", pin, token });
    return { t, ...ids, login };
}

describe("personal accounts", () => {
    it("asks the deputy for a password of their own, after which the old code no longer works", async () => {
        const f = await fixture();
        expect((await f.login("deputy", "deputy-code", hex("a"))).session.role).toBe("deputy");
        expect((await f.t.query(A.supervisionSessions.current, { token: hex("a") })).needsPassword).toBe(true);
        const change = (current: string, next: string) => f.t.mutation(A.supervisionSessions.changePassword, { token: hex("a"), current, next });
        expect((await change("wrong", "NewPass2026")).error).toBeTruthy();
        expect((await change("deputy-code", "short1")).error).toBeTruthy();
        expect((await change("deputy-code", "onlyletters")).error).toBeTruthy();
        expect((await change("deputy-code", "NewPass2026")).ok).toBe(true);
        // the session that changed it carries on, without the prompt
        expect((await f.t.query(A.supervisionSessions.current, { token: hex("a") })).needsPassword).toBe(false);
        expect((await f.login("deputy", "deputy-code", hex("b"))).error).toBeTruthy();
        expect((await f.login("deputy", "NewPass2026", hex("c"))).session).toBeTruthy();
        // nothing readable is stored
        const stored = await f.t.run(ctx => ctx.db.query("supervisionAccounts").collect());
        expect(JSON.stringify(stored)).not.toContain("NewPass2026");
    });

    it("gives a coordinator an account only through the deputy's one-time link", async () => {
        const f = await fixture();
        await f.login("deputy", "deputy-code", hex("a"));
        await f.login("coordinator", "shared-code", hex("b"), f.first);
        const link = hex("d");
        // a coordinator cannot issue links, see the accounts, or claim an account from inside
        await expect(f.t.mutation(A.accounts.createActivations, { sessionToken: hex("b"), items: [{ role: "coordinator", ownerId: f.second, token: link }] })).rejects.toThrow();
        await expect(f.t.query(A.accounts.status, { sessionToken: hex("b") })).rejects.toThrow();
        await expect(f.t.mutation(A.supervisionSessions.changePassword, { token: hex("b"), current: "shared-code", next: "Claimed2026" })).rejects.toThrow();
        // the admin's account is the admin's own
        await expect(f.t.mutation(A.accounts.createActivations, { sessionToken: hex("a"), items: [{ role: "admin", token: link }] })).rejects.toThrow();

        await f.t.mutation(A.accounts.createActivations, { sessionToken: hex("a"), items: [{ role: "coordinator", ownerId: f.first, token: link }] });
        expect(await f.t.query(A.supervisionSessions.activationInfo, { token: link })).toEqual({ name: "منسق أول", role: "coordinator" });
        expect(await f.t.query(A.supervisionSessions.activationInfo, { token: hex("e") })).toBeNull();
        expect((await f.t.mutation(A.supervisionSessions.activate, { token: link, password: "12345678" })).error).toBeTruthy();
        expect((await f.t.mutation(A.supervisionSessions.activate, { token: link, password: "Science2026" })).ok).toBe(true);
        // one use; the shared code and the session opened with it are finished for this person
        expect((await f.t.mutation(A.supervisionSessions.activate, { token: link, password: "Another2026" })).error).toBeTruthy();
        expect(await f.t.query(A.supervisionSessions.current, { token: hex("b") })).toBeNull();
        expect((await f.login("coordinator", "shared-code", hex("1"), f.first)).error).toBeTruthy();
        expect((await f.login("coordinator", "Science2026", hex("2"), f.first)).session.name).toBe("منسق أول");
        // a colleague's password opens nobody else's account
        expect((await f.login("coordinator", "Science2026", hex("3"), f.second)).error).toBeTruthy();

        const status = await f.t.query(A.accounts.status, { sessionToken: hex("a") });
        expect(status.rows.filter((r: any) => r.activatedAt).map((r: any) => r.name)).toEqual(["منسق أول"]);
        expect(status.sharedCode).toBe(true);
        // until the shared code is retired, the colleague without an account still gets in with it
        expect((await f.login("coordinator", "shared-code", hex("4"), f.second)).session).toBeTruthy();
        await f.t.mutation(A.accounts.retireSharedCode, { sessionToken: hex("a") });
        expect((await f.login("coordinator", "shared-code", hex("5"), f.second)).error).toBeTruthy();
        expect(await f.t.query(A.supervisionSessions.current, { token: hex("4") })).toBeNull();
        // the deputy can set a password for someone, who then signs in with it
        await f.t.mutation(A.accounts.setFor, { sessionToken: hex("a"), role: "coordinator", ownerId: f.second, password: "Second2026" });
        expect((await f.login("coordinator", "Second2026", hex("6"), f.second)).session).toBeTruthy();
    });

    it("lets a teacher sign in as themselves, by e-mail or mobile number, once their link is used", async () => {
        const f = await fixture();
        await f.t.run(ctx => ctx.db.patch(f.schoolId, { teacherPin: "teachers-code" }));
        await f.login("deputy", "deputy-code", hex("a"));
        const own = (identifier: string, pin: string, token: string) => f.t.mutation(A.supervisionSessions.login, { role: "teacher", name: "x", pin, token, identifier });
        // no account yet: the shared code is not a personal password
        expect((await own("first@school.qa", "teachers-code", hex("1"))).error).toBeTruthy();
        // links for both teachers in one go
        await f.t.mutation(A.accounts.createActivations, { sessionToken: hex("a"), items: [
            { role: "teacher", ownerId: f.teacher, token: hex("d") }, { role: "teacher", ownerId: f.colleague, token: hex("e") }] });
        expect(await f.t.query(A.supervisionSessions.activationInfo, { token: hex("d") })).toEqual({ name: "معلم أول", role: "teacher", email: "first@school.qa", phone: "55001122" });
        expect((await f.t.mutation(A.supervisionSessions.activate, { token: hex("d"), password: "Teacher2026" })).ok).toBe(true);

        const session = await own("FIRST@school.qa ", "Teacher2026", hex("2"));
        expect(session.session.name).toBe("معلم أول");
        expect((await own("+974 5500 1122", "Teacher2026", hex("3"))).session.name).toBe("معلم أول");
        expect((await f.t.query(A.supervisionSessions.current, { token: hex("2") })).personal).toBe(true);
        // a colleague's identifier, an unknown one, and a too-short number all fail the same way
        expect((await own("second@school.qa", "Teacher2026", hex("4"))).error).toBeTruthy();
        expect((await own("nobody@school.qa", "Teacher2026", hex("5"))).error).toBeTruthy();
        expect((await own("1122", "Teacher2026", hex("6"))).error).toBeTruthy();
        // a teacher is still kept out of supervision and of other people's accounts
        await expect(f.t.query(A.accounts.status, { sessionToken: hex("2") })).rejects.toThrow();
        await expect(f.t.query(A.teacherEvaluations.list, { sessionToken: hex("2") })).rejects.toThrow();

        // they change their own password; retiring the shared code leaves their session alone
        expect((await f.t.mutation(A.supervisionSessions.changePassword, { token: hex("2"), current: "Teacher2026", next: "Changed2026" })).ok).toBe(true);
        expect(await f.t.query(A.supervisionSessions.current, { token: hex("3") })).toBeNull();
        await f.t.run(ctx => ctx.db.patch(f.schoolId, { teacherPin: undefined }));
        expect((await f.t.query(A.supervisionSessions.current, { token: hex("2") })).name).toBe("معلم أول");
        expect((await f.t.mutation(A.supervisionSessions.login, { role: "teacher", name: "x", pin: "teachers-code", token: hex("7") })).error).toBeTruthy();
        // a teacher who leaves loses the account's door
        await f.t.run(ctx => ctx.db.patch(f.teacher, { isActive: false }));
        expect(await f.t.query(A.supervisionSessions.current, { token: hex("2") })).toBeNull();
        expect((await own("first@school.qa", "Changed2026", hex("8"))).error).toBeTruthy();

        // a coordinator, on the staff list too, is not offered a second account as a teacher
        const both = await f.t.run(ctx => ctx.db.insert("schoolTeachers", { schoolId: f.schoolId, fullName: "منسق  أول", department: "العلوم", email: "c@school.qa", isActive: true }));
        await expect(f.t.mutation(A.accounts.createActivations, { sessionToken: hex("a"), items: [{ role: "teacher", ownerId: both, token: hex("9") }] })).rejects.toThrow();
        const status = await f.t.query(A.accounts.status, { sessionToken: hex("a") });
        expect(status.rows.filter((r: any) => r.role === "teacher").map((r: any) => [r.name, !!r.linkExpiresAt])).toEqual([["معلم ثان", true]]);
    });
});
