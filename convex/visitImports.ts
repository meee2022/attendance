import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireSession, requireVisit, sessionQuery } from "./supervisionAccess";

const I = internal as any;
export const authorize = internalQuery({
    args: { sessionToken: v.string() },
    handler: async (ctx, args) => { await requireSession(ctx, args.sessionToken); return null; },
});
export const retain = internalMutation({
    args: { sessionToken: v.string(), storageId: v.id("_storage"), filename: v.string(), sha256: v.string() },
    handler: async (ctx, args) => {
        const session = await requireSession(ctx, args.sessionToken);
        const ownerId = session.visitorId ?? "deputy";
        const previous = await ctx.db.query("supervisionImports").withIndex("by_hash", q => q.eq("schoolId", session.schoolId).eq("sha256", args.sha256)).first();
        if (previous) {
            if (previous.visitId) throw new ConvexError("هذا الملف مرتبط بزيارة بالفعل؛ افتحها من سجل الزيارات بدلاً من استيرادها مرة أخرى");
            if (previous.ownerId !== ownerId) throw new ConvexError("هذا الملف قيد المراجعة لدى مستخدم آخر");
            await ctx.storage.delete(args.storageId);
            return previous._id;
        }
        return ctx.db.insert("supervisionImports", { schoolId: session.schoolId, ownerId, storageId: args.storageId, filename: args.filename.slice(0, 180), sha256: args.sha256, createdAt: Date.now() });
    },
});

// Bytes are validated and stored by the server: clients cannot attach another
// person's storage ID. Nothing from the PDF is treated as executable content.
export const upload = action({
    args: { sessionToken: v.string(), bytes: v.bytes(), filename: v.string() },
    handler: async (ctx, args): Promise<string> => {
        await ctx.runQuery(I.visitImports.authorize, { sessionToken: args.sessionToken });
        if (args.bytes.byteLength > 6 * 1024 * 1024 || args.bytes.byteLength < 8 || new TextDecoder().decode(args.bytes.slice(0, 5)) !== "%PDF-") throw new ConvexError("اختر PDF صحيحاً لا يتجاوز 6 ميجابايت");
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", args.bytes)), x => x.toString(16).padStart(2, "0")).join("");
        const storageId = await ctx.storage.store(new Blob([args.bytes], { type: "application/pdf" }));
        try {
            return await ctx.runMutation(I.visitImports.retain, { sessionToken: args.sessionToken, storageId, sha256, filename: args.filename });
        } catch (error) { await ctx.storage.delete(storageId); throw error; }
    },
});

export const original = sessionQuery({
    args: { visitId: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        const visit = await requireVisit(ctx, (ctx as any).supervisionSession, args.visitId);
        if (!visit.sourceImportId) return null;
        const source = await ctx.db.get(visit.sourceImportId) as any;
        return source ? { filename: source.filename, url: await ctx.storage.getUrl(source.storageId) } : null;
    },
});
