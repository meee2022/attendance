import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { sessionMutation, sessionQuery, requireVisit, digest } from "./supervisionAccess";
import { ROLE_LABELS, formatDate } from "./visitMath";

// Convex exposes the deployment's environment variables here; the app build has no Node types
declare const process: { env: Record<string, string | undefined> };

// What happens to a visit around saving it: the visitor's own signature,
// sending a draft to the deputy or a colleague for review, and e-mailing the
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
            reviewReturn: { byName: s.name, note: note.slice(0, 2000), at: Date.now() },
            updatedAt: Date.now(),
        });
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: visit.schoolId, visitId: visit._id, action: "review_returned", actorName: s.name,
            details: `أُعيدت زيارة ${visit.teacherName} للزائر بملاحظات`, timestamp: Date.now(),
        });
    },
});

// ── E-mail the submitted form to the teacher ─────────────────────────────
// Sent through Resend. It stays off until RESEND_API_KEY (and, for a verified
// school domain, VISIT_EMAIL_FROM) is set on the Convex deployment.
const ALLOWED_ORIGINS = /^(https:\/\/(www\.)?ibntaymia\.com|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;

export const emailStatus = sessionQuery({
    args: { visitId: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        const visit = await requireVisit(ctx, (ctx as any).supervisionSession, args.visitId);
        const teacher: any = visit.teacherId ? await ctx.db.get(visit.teacherId) : null;
        const rows = await ctx.db.query("supervisionEmails").withIndex("by_visit", q => q.eq("visitId", args.visitId)).collect();
        return {
            configured: Boolean(process.env.RESEND_API_KEY),
            teacherEmail: teacher?.email?.trim() || null,
            sends: rows.sort((a, b) => b.createdAt - a.createdAt)
                .map(r => ({ _id: r._id, to: r.to, status: r.status, error: r.error ?? null, createdAt: r.createdAt, byName: r.byName })),
        };
    },
});

export const emailTeacher = sessionMutation({
    args: {
        visitId: v.id("supervisionVisits"),
        pdfId: v.id("_storage"),
        token: v.string(),        // the acknowledgement link's secret, already registered for this visit
        origin: v.string(),
    },
    handler: async (ctx, args) => {
        const s = (ctx as any).supervisionSession;
        if (!process.env.RESEND_API_KEY) throw new ConvexError("إرسال البريد غير مُفعّل بعد");
        const visit = await requireVisit(ctx, s, args.visitId, true);
        if (visit.status !== "submitted" || visit.deletedAt) throw new ConvexError("تُرسل الزيارات المعتمدة فقط");
        if (!ALLOWED_ORIGINS.test(args.origin)) throw new ConvexError("رابط غير معروف");
        const teacher: any = visit.teacherId ? await ctx.db.get(visit.teacherId) : null;
        const to = teacher?.email?.trim();
        if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ConvexError("لا يوجد بريد صحيح للمعلم — أضفه من إدارة المعلمين");
        const hash = await digest(args.token);
        const link = await ctx.db.query("supervisionAcknowledgements").withIndex("by_token", q => q.eq("tokenHash", hash)).first();
        if (!link || link.visitId !== visit._id || link.revoked) throw new ConvexError("أعد المحاولة");

        const emailId = await ctx.db.insert("supervisionEmails", {
            schoolId: visit.schoolId, visitId: visit._id, to, byName: s.name, status: "queued", createdAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.visitWorkflow.sendVisitEmail, {
            emailId, pdfId: args.pdfId, to,
            teacherName: visit.teacherName,
            visitorLine: `${ROLE_LABELS[visit.visitorRole as keyof typeof ROLE_LABELS]} ${visit.visitorName}`,
            date: formatDate(visit.visitDate),
            lesson: visit.lessonTopic,
            link: `${args.origin}/supervision/acknowledge#${args.token}`,
        });
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: visit.schoolId, visitId: visit._id, action: "emailed_teacher", actorName: s.name,
            details: `إرسال الاستمارة إلى ${visit.teacherName} (${to})`, timestamp: Date.now(),
        });
    },
});

const escape = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const sendVisitEmail = internalAction({
    args: {
        emailId: v.id("supervisionEmails"), pdfId: v.id("_storage"), to: v.string(),
        teacherName: v.string(), visitorLine: v.string(), date: v.string(), lesson: v.string(), link: v.string(),
    },
    handler: async (ctx, a) => {
        let error: string | undefined;
        try {
            const pdf = await ctx.storage.get(a.pdfId);
            if (!pdf) throw new Error("PDF missing");
            const bytes = new Uint8Array(await pdf.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.9;color:#1e293b">
<p>السلام عليكم ورحمة الله،</p>
<p>الأستاذ/ ${escape(a.teacherName)}</p>
<p>مرفق استمارة الإشراف على أداء المعلّم لزيارة يوم ${escape(a.date)} — ${escape(a.lesson)}، من ${escape(a.visitorLine)}.</p>
<p>للاطلاع على الملاحظات وتسجيل تعليقك: <a href="${escape(a.link)}">فتح صفحة الاطلاع</a> (الرابط صالح 7 أيام).</p>
<p style="color:#64748b;font-size:13px">تسجيل الاطلاع لا يعني الموافقة على التقييم.</p>
</div>`;
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: process.env.VISIT_EMAIL_FROM || "الإشراف الصفي <onboarding@resend.dev>",
                    to: [a.to],
                    subject: `استمارة الإشراف على أداء المعلّم — ${a.date}`,
                    html,
                    attachments: [{ filename: `استمارة الزيارة ${a.date.replace(/\//g, "-")}.pdf`, content: btoa(binary) }],
                }),
            });
            if (!res.ok) error = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
        } catch (e: any) {
            error = String(e?.message ?? e).slice(0, 300);
        }
        await ctx.storage.delete(a.pdfId).catch(() => {});
        await ctx.runMutation(internal.visitWorkflow.recordEmail, { emailId: a.emailId, error });
    },
});

export const recordEmail = internalMutation({
    args: { emailId: v.id("supervisionEmails"), error: v.optional(v.string()) },
    handler: async (ctx, a) => {
        await ctx.db.patch(a.emailId, a.error ? { status: "failed", error: a.error } : { status: "sent", sentAt: Date.now() });
    },
});
