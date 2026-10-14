import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { buildSurvey, analyze, refreshSurvey, gradeOf } from "../src/lib/surveyAnalysis";
const A = api as any;
const modules = import.meta.glob("../convex/**/*.ts");
const table = [
    ["ID", "Completion time", "Email", "رقم الجوال", "الصف", "الرضا", "المجالات", "مقترحات"],
    [1, new Date("2026-10-12T08:00:00Z"), "a@example.com", "55112233", "العاشر 1", "نعم", "علوم;رياضيات;علوم", "تطوير المعامل"],
    [2, new Date("2026-10-13T08:00:00Z"), "b@example.com", "55114433", "١٠/٢", "نعم", "علوم؛رياضيات", "زيادة الأنشطة"],
    [3, "", "", "", "الحادي عشر", "لا", "علوم", "لا يوجد"],
    [4, "", "", "", "11-2", "لا", "رياضيات", ""],
];
describe("imported survey analysis", () => {
    it("removes contact metadata, groups grades and deduplicates multi-answer options per respondent", () => {
        const s = buildSurvey(table, "اختبار.xlsx");
        expect(JSON.stringify(s)).not.toContain("55112233");
        expect(JSON.stringify(s)).not.toContain("a@example.com");
        expect(s.rows).toHaveLength(4);
        expect(gradeOf("الحادي عشر")).toBe(11);
        const a = analyze(s);
        expect(a.days).toHaveLength(2);
        expect(a.questions.find(q => q.name === "المجالات").items.map(x=>x.count)).toEqual([3,3]);
        expect(analyze(s,{column:0,value:"الصف العاشر"}).responses).toBe(2);
        const edited = {...s, title:"اسم محفوظ", columns:s.columns.map(c=>({...c,type:c.name==="الرضا"?"skip":c.type}))};
        expect(refreshSurvey(edited,buildSurvey(table,"أحدث.xlsx")).title).toBe("اسم محفوظ");
        expect(()=>refreshSurvey(s,buildSurvey([["سؤال مختلف"],["نعم"],["لا"]],"x.xlsx"))).toThrow("أسئلة الملف مختلفة");
    });
    it("restricts list, read, write and delete to admin/deputy and checks ownership and concurrent changes", async () => {
        const t=convexTest(schema,modules);
        const schoolId=await t.run(ctx=>ctx.db.insert("schools",{name:"اختبار",code:"T",createdAt:"2026",adminPin:"adm",deputyPin:"dep",teacherPin:"tea"}));
        const admin="a".repeat(64), deputy="b".repeat(64), teacher="c".repeat(64);
        for(const [role,pin,token] of [["admin","adm",admin],["deputy","dep",deputy],["teacher","tea",teacher]]) await t.mutation(A.supervisionSessions.login,{role,pin,token,name:"اختبار"});
        const data=JSON.stringify(buildSurvey(table,"اختبار.xlsx"));
        await expect(t.query(A.surveyAnalyses.list,{})).rejects.toThrow();
        await expect(t.mutation(A.surveyAnalyses.save,{data,sessionToken:teacher})).rejects.toThrow();
        const id=await t.mutation(A.surveyAnalyses.save,{data,sessionToken:admin});
        await expect(t.query(A.surveyAnalyses.get,{id,sessionToken:teacher})).rejects.toThrow();
        await expect(t.query(A.surveyAnalyses.list,{sessionToken:teacher})).rejects.toThrow();
        await expect(t.mutation(A.surveyAnalyses.remove,{id,sessionToken:teacher})).rejects.toThrow();
        const row=await t.query(A.surveyAnalyses.get,{id,sessionToken:deputy});
        await t.mutation(A.surveyAnalyses.save,{id,data,expectedUpdatedAt:row.updatedAt,sessionToken:deputy});
        await expect(t.mutation(A.surveyAnalyses.save,{id,data,expectedUpdatedAt:row.updatedAt,sessionToken:admin})).rejects.toThrow("تغير التحليل");
        await expect(t.mutation(A.surveyAnalyses.save,{data:'{}',sessionToken:admin})).rejects.toThrow();
        expect((await t.query(A.surveyAnalyses.list,{sessionToken:admin}))[0]).not.toHaveProperty("data");
        const foreignId=await t.run(async ctx=>{const other=await ctx.db.insert("schools",{name:"أخرى",code:"O",createdAt:"2026"});return ctx.db.insert("surveyAnalyses",{schoolId:other,title:"خاص",fileName:"x.xlsx",data,responseCount:4,questionCount:4,updatedAt:1,updatedBy:"آخر"});});
        await expect(t.query(A.surveyAnalyses.get,{id:foreignId,sessionToken:admin})).rejects.toThrow("غير متاح");
        await t.mutation(A.surveyAnalyses.remove,{id,sessionToken:deputy});
        expect(await t.query(A.surveyAnalyses.list,{sessionToken:admin})).toEqual([]);
    });
});
