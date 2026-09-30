import { v, ConvexError } from "convex/values";
import { sessionMutation, sessionQuery, requireVisit } from "./supervisionAccess";

// What happens to a visit around saving it: the visitor's own signature,
// sending a draft to the deputy or a colleague for review, and sending the
// submitted form to the visited teacher.

async function schoolOf(ctx: any) {
    const school = await ctx.db.query("schools").first();
    if (!school) throw new ConvexError("لا توجد مدرسة مُهيَّأة");
    return school;
}
async function settingsRow(ctx: any, schoolId: any) {
    return ctx.db.query("supervisionSettings").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).first();
}

// ── Signature: uploaded once by its owner ────────────────────────────────
export const uploadUrl = sessionMutation({
    args: {},
    handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const mySignature = sessionQuery({
    args: {},
    handler: async (ctx) => {
        const s = (ctx as any).supervisionSession;
        if (s.role === "deputy") {
            const settings = await settingsRow(ctx, s.schoolId);
            return settings?.deputySignatureId ? await ctx.storage.getUrl(settings.deputySignatureId) : null;
        }
        const me: any = s.visitorId ? await ctx.db.get(s.visitorId) : null;
        return me?.signatureId ? await ctx.storage.getUrl(me.signatureId) : null;
    },
});

export const setMySignature = sessionMutation({
    args: { storageId: v.union(v.id("_storage"), v.null()) },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        const value = args.storageId ?? undefined;
        if (s.role === "deputy") {
            const settings = await settingsRow(ctx, s.schoolId);
            if (!settings) throw new ConvexError("احفظ إعدادات الاستمارة أولاً");
            await ctx.db.patch(settings._id, { deputySignatureId: value });
            return;
        }
        if (!s.visitorId) throw new ConvexError("اختر اسمك عند الدخول لرفع توقيعك");
        await ctx.db.patch(s.visitorId, { signatureId: value });
    },
});

// ── Review before submitting ─────────────────────────────────────────────
// Who a draft can be sent to: the academic deputy, or another coordinator of
// the teacher's department
export const reviewers = sessionQuery({
    args: { department: v.string() },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        const school = await schoolOf(ctx);
        const settings = await settingsRow(ctx, school._id);
        const coordinators = await ctx.db.query("supervisors")
            .withIndex("by_role", (q: any) => q.eq("schoolId", school._id).eq("role", "coordinator"))
            .collect();
        const dept = args.department.trim();
        return [
            ...(s.role === "deputy" ? [] : [{ key: "deputy", toRole: "deputy" as const, name: settings?.deputyName || "النائب الأكاديمي", label: "النائب الأكاديمي" }]),
            ...coordinators
                .filter((c: any) => c.isActive && c._id !== s.visitorId && c.subjects.map((x: string) => x.trim()).includes(dept))
                .map((c: any) => ({ key: c._id, toRole: "coordinator" as const, toVisitorId: c._id, name: c.fullName, label: "منسق" })),
        ];
    },
});

export const requestReview = sessionMutation({
    args: {
        visitId: v.id("supervisionVisits"),
        toRole: v.union(v.literal("deputy"), v.literal("coordinator")),
        toVisitorId: v.optional(v.id("supervisors")),
        note: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        const visit = await requireVisit(ctx, s, args.visitId, true);
        if (visit.status !== "draft" || visit.deletedAt) throw new ConvexError("تُرسل المسودات فقط للمراجعة");
        if (visit.coordinatorApproval) throw new ConvexError("الزيارة بانتظار اعتماد النائب؛ لا يمكن تغيير مسار اعتمادها");
        let toName = "النائب الأكاديمي";
        if (args.toRole === "deputy") {
            const settings = await settingsRow(ctx, visit.schoolId);
            toName = settings?.deputyName || toName;
        } else {
            const to = args.toVisitorId ? await ctx.db.get(args.toVisitorId) : null;
            if (!to || to.schoolId !== visit.schoolId || to.role !== "coordinator" || !to.isActive || to._id === s.visitorId
                || !to.subjects.map((x: string) => x.trim()).includes((visit.teacherDepartment ?? "").trim())) {
                throw new ConvexError("اختر منسقًا من قسم المعلم");
            }
            toName = to.fullName;
        }
        const note = args.note?.trim().slice(0, 1000) || undefined;
        await ctx.db.patch(visit._id, {
            reviewRequest: { toRole: args.toRole, toVisitorId: args.toRole === "coordinator" ? args.toVisitorId : undefined, toName, byName: s.name, note, at: Date.now() },
            reviewReturn: undefined,
            updatedAt: Date.now(),
        });
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: visit.schoolId, visitId: visit._id, action: "review_requested", actorName: s.name,
            details: `أُرسلت زيارة ${visit.teacherName} إلى ${toName} للمراجعة`, timestamp: Date.now(),
        });
    },
});

// The reviewer sends the draft back to its visitor with a note
export const returnVisit = sessionMutation({
    args: { visitId: v.id("supervisionVisits"), note: v.string() },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        const visit = await requireVisit(ctx, s, args.visitId);
        const req = visit.reviewRequest;
        const isReviewer = req && (req.toRole === "deputy" ? s.role === "deputy" : req.toVisitorId === s.visitorId);
        if (!req || visit.status !== "draft" || !isReviewer) throw new ConvexError("الزيارة ليست مرسلة إليك للمراجعة");
        const note = args.note.trim();
        if (!note) throw new ConvexError("اكتب ملاحظتك للزائر");
        await ctx.db.patch(visit._id, {
            reviewRequest: undefined,
            coordinatorApproval: undefined,
            deputyApproval: undefined,
            reviewReturn: { byName: s.name, note: note.slice(0, 2000), at: Date.now() },
            updatedAt: Date.now(),
        });
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: visit.schoolId, visitId: visit._id, action: "review_returned", actorName: s.name,
            details: `أُعيدت زيارة ${visit.teacherName} للزائر بملاحظات`, timestamp: Date.now(),
        });
    },
});

// ── Sending the form to the teacher ──────────────────────────────────────
// Sent from the visitor's own device — the share sheet (WhatsApp, e-mail…) or
// their mail program — so no mail service is involved. The server only gives
// the teacher's address and keeps a record of each send.
export const emailStatus = sessionQuery({
    args: { visitId: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        const visit = await requireVisit(ctx, (ctx as any).supervisionSession, args.visitId);
        const teacher: any = visit.teacherId ? await ctx.db.get(visit.teacherId) : null;
        const rows = await ctx.db.query("supervisionEmails").withIndex("by_visit", q => q.eq("visitId", args.visitId)).collect();
        return {
            teacherName: visit.teacherName,
            teacherEmail: teacher?.email?.trim() || null,
            teacherPhone: teacher?.phone?.trim() || null,
            sends: rows.sort((a, b) => b.createdAt - a.createdAt)
                .map(r => ({ _id: r._id, to: r.to, status: r.status, createdAt: r.createdAt, byName: r.byName })),
        };
    },
});

export const logSend = sessionMutation({
    args: { visitId: v.id("supervisionVisits"), via: v.string() },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        const visit = await requireVisit(ctx, s, args.visitId, true);
        if (visit.status !== "submitted") throw new ConvexError("تُرسل الزيارات المعتمدة فقط");
        await ctx.db.insert("supervisionEmails", {
            schoolId: visit.schoolId, visitId: visit._id, to: args.via.slice(0, 200), byName: s.name, status: "sent", createdAt: Date.now(), sentAt: Date.now(),
        });
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: visit.schoolId, visitId: visit._id, action: "sent_to_teacher", actorName: s.name,
            details: `إرسال الاستمارة إلى ${visit.teacherName} (${args.via.slice(0, 200)})`, timestamp: Date.now(),
        });
    },
});
