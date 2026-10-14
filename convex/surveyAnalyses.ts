import { ConvexError, v } from "convex/values";
import { staffQuery, staffMutation } from "./platformAccess";
const types = new Set(["choice", "multi", "grade", "class", "text", "name", "rating", "skip"]);
export function validateAnalysis(raw: string) {
    if (new TextEncoder().encode(raw).length > 700_000) throw new ConvexError("البيانات كبيرة؛ قسّم الردود إلى ملفات أصغر");
    let s: any;
    try { s = JSON.parse(raw); } catch { throw new ConvexError("بيانات التحليل غير صالحة"); }
    if (!s || typeof s.title !== "string" || !s.title.trim() || s.title.length > 160 || typeof s.fileName !== "string" || s.fileName.length > 255 ||
        !Array.isArray(s.columns) || !s.columns.length || s.columns.length > 300 || s.columns.some((c: any) => !c || typeof c.name !== "string" || c.name.length > 2000 || !types.has(c.type)) ||
        !Array.isArray(s.rows) || !s.rows.length || s.rows.length > 5000 || s.rows.some((r: any) => !Array.isArray(r) || r.length !== s.columns.length || r.some((x: any) => typeof x !== "string" || x.length > 10000)) ||
        !Array.isArray(s.times) || (s.times.length !== 0 && s.times.length !== s.rows.length) || s.times.some((x: any) => typeof x !== "string" || (x !== "" && !Number.isFinite(Date.parse(x))))) throw new ConvexError("راجع عناوين الأسئلة والردود في الملف");
    return { title: s.title.trim(), fileName: s.fileName, columns: s.columns.map((c: any) => ({ name: c.name, type: c.type })), rows: s.rows, times: s.times,
        hidden: Array.isArray(s.hidden) ? s.hidden.filter((x: any) => typeof x === "string").slice(0,150) : [],
        // the wording of rating-grid questions, which the Forms export leaves out
        statements: Array.isArray(s.statements) ? s.statements.slice(0,50).map((x: any) => typeof x === "string" ? x.slice(0,500) : "") : [] };
}
async function owned(ctx: any, id: any) {
    const row = await ctx.db.get(id);
    if (!row || row.schoolId !== ctx.platformSession.schoolId) throw new ConvexError("التحليل غير متاح");
    return row;
}
export const list = staffQuery({ args: {}, handler: async ctx => {
    const rows = await ctx.db.query("surveyAnalyses").withIndex("by_school", q => q.eq("schoolId", (ctx as any).platformSession.schoolId)).collect();
    return rows.map(({ data, ...row }) => row).sort((a,b) => b.updatedAt - a.updatedAt);
} });
export const get = staffQuery({ args: { id: v.id("surveyAnalyses") }, handler: async (ctx,args) => owned(ctx,args.id) });
export const save = staffMutation({ args: { id: v.optional(v.id("surveyAnalyses")), expectedUpdatedAt: v.optional(v.number()), data: v.string() }, handler: async (ctx,args) => {
    const s = validateAnalysis(args.data);
    let previous;
    if (args.id) {
        previous = await owned(ctx,args.id);
        if (previous.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("تغير التحليل؛ أعد فتحه قبل الحفظ");
    }
    const value = { title: s.title, fileName: s.fileName, data: JSON.stringify(s), responseCount: s.rows.length, questionCount: s.columns.filter((c: any) => c.type !== "skip" && c.type !== "rating").length + (s.columns.some((c: any) => c.type === "rating") ? Math.max(1, s.statements.length) : 0),
        updatedAt: Math.max(Date.now(), (previous?.updatedAt ?? 0)+1), updatedBy: (ctx as any).platformSession.name };
    if (args.id) { await ctx.db.patch(args.id,value); return args.id; }
    return ctx.db.insert("surveyAnalyses", { ...value, schoolId: (ctx as any).platformSession.schoolId });
} });
export const remove = staffMutation({ args: { id: v.id("surveyAnalyses") }, handler: async (ctx,args) => { await owned(ctx,args.id); await ctx.db.delete(args.id); } });
