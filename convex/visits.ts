import { deputyNameOf } from "./supervisionDefaults";
import { sessionMutation as mutation, sessionQuery as query, deputyMutation, canAccess, requireVisit } from "./supervisionAccess";
import { ConvexError, v } from "convex/values";
import {
    DOMAINS, computeScores, nameKey, parseRatings, todayInQatar, validateVisit,
    type CriterionRef, type Domain,
} from "./visitMath";

// Refusals are ConvexError so their reason reaches the visitor: a production
// deployment hides the text of any other thrown error.
//
// The life of a classroom visit, rebuilt on the rules of the ministry form:
// people and classes are referenced by id, the numbers on the form (record
// number, visit number, averages) are fixed by the server when the visit is
// submitted, the form's wording is frozen with it, and nothing is ever lost —
// an edit keeps the earlier version and a delete only moves it to the bin.

const roleV = v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy"));

const DEFAULT_YEAR = "2026 - 2027";

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new ConvexError("لا توجد مدرسة مُهيَّأة");
    return sch;
}

async function settingsOf(ctx: any, school: any) {
    const s = await ctx.db.query("supervisionSettings")
        .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
        .first();
    return {
        _id: s?._id ?? null,
        academicYear: s?.academicYear ?? DEFAULT_YEAR,
        yearStart: s?.yearStart ?? "2026-08-30",
        yearEnd: s?.yearEnd ?? "2027-06-30",
        schoolNameOnForm: s?.schoolNameOnForm ?? school.name,
        principalName: s?.principalName ?? "",
        deputyName: deputyNameOf(s),
        headerImageId: s?.headerImageId ?? null,
        footerImageId: s?.footerImageId ?? null,
        deputySignatureId: s?.deputySignatureId ?? null,
        requiredCoordinator: s?.requiredCoordinator ?? 2,
        requiredSupervisor: s?.requiredSupervisor ?? 1,
        requiredDeputy: s?.requiredDeputy ?? 1,
    };
}

async function activeCriteria(ctx: any, schoolId: any) {
    const all = await ctx.db.query("supervisionCriteria")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
    return all
        .filter((c: any) => c.isActive !== false)
        .sort((a: any, b: any) =>
            DOMAINS.indexOf(a.domain) - DOMAINS.indexOf(b.domain) || a.order - b.order);
}

async function imageUrl(ctx: any, id: any) {
    return id ? await ctx.storage.getUrl(id) : null;
}

// ── Reference data for the form ──────────────────────────────────────────
export const getSetup = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const settings = await settingsOf(ctx, school);
        const criteria = await activeCriteria(ctx, school._id);

        const access = (ctx as any).supervisionSession;
        const teachers = (await ctx.db.query("schoolTeachers")
            .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
            .collect())
            .filter((t: any) => t.isActive !== false && canAccess(access, t.schoolId, t.department ?? ""))
            .map((t: any) => ({
                _id: t._id, fullName: t.fullName.replace(/\s+/g, " ").trim(),
                department: (t.department ?? "").trim(), email: t.email ?? "",
            }))
            .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName, "ar"));

        const visitors = (await ctx.db.query("supervisors")
            .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
            .collect())
            .filter((s: any) => s.isActive !== false && (access.role === "deputy" || s._id === access.visitorId || (s.role === "supervisor" && (s.subjects ?? []).some((d: string) => access.departments?.includes(d.trim())))))
            .map((s: any) => ({ _id: s._id, fullName: s.fullName, role: s.role, subjects: s.subjects ?? [] }));

        const classes = (await ctx.db.query("classes")
            .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
            .collect())
            .filter((c: any) => c.isActive !== false && !String(c.name).includes("غير محدد"))
            .map((c: any) => ({ _id: c._id, name: c.name, grade: c.grade, track: c.track ?? "" }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar", { numeric: true }));

        const departments = [...new Set(teachers.map((t: any) => t.department).filter(Boolean))]
            .sort((a, b) => (a as string).localeCompare(b as string, "ar"));

        return {
            settings: {
                ...settings,
                headerUrl: await imageUrl(ctx, settings.headerImageId),
                footerUrl: await imageUrl(ctx, settings.footerImageId),
                signatureUrl: await imageUrl(ctx, settings.deputySignatureId),
            },
            criteria: criteria.map((c: any) => ({ _id: c._id, domain: c.domain, text: c.text, order: c.order })),
            teachers, visitors, classes, departments,
            today: todayInQatar(),
        };
    },
});

// ── Visits ───────────────────────────────────────────────────────────────
// Everything the dashboards, the registry and the teacher file need. A school
// makes a few hundred visits a year, so the aggregation happens in the page.
export const listVisits = query({
    args: { deleted: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const all = await ctx.db.query("supervisionVisits")
            .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
            .collect();

        return all
            .filter((x: any) => canAccess((ctx as any).supervisionSession, x.schoolId, x.teacherDepartment ?? ""))
            .filter((x: any) => Boolean(x.deletedAt) === Boolean(args.deleted))
            .map((x: any) => ({
                _id: x._id,
                recordNo: x.recordNo ?? null,
                visitorId: x.visitorId ?? null,
                recordedByVisitorId: x.recordedByVisitorId ?? null,
                recordedByName: x.recordedByName ?? null,
                academicYear: x.academicYear ?? null,
                visitNumber: x.visitNumber ?? null,
                teacherId: x.teacherId ?? null,
                teacherName: x.teacherName,
                department: (x.teacherDepartment ?? "").trim(),
                subjectName: (x.subjectName ?? "").trim(),
                classId: x.classId ?? null,
                className: x.className,
                lessonTopic: x.lessonTopic,
                visitDate: x.visitDate,
                visitorRole: x.visitorRole,
                visitorName: x.visitorName,
                followUpType: x.followUpType,
                deliveryMode: x.deliveryMode ?? "field",
                streamMode: x.streamMode ?? null,
                status: x.status,
                averageScore: x.status === "submitted" ? x.averageScore : null,
                domainAverages: x.domainAverages,
                ratings: x.ratings,
                planningRec: x.planningRec ?? "",
                executionRec: x.executionRec ?? "",
                evalMgmtRec: x.evalMgmtRec ?? "",
                managementRec: x.managementRec ?? "",
                notes: x.notes ?? "",
                createdAt: x.createdAt,
                updatedAt: x.updatedAt ?? x.createdAt,
                deletedAt: x.deletedAt ?? null,
                deletedBy: x.deletedBy ?? null,
                deleteReason: x.deleteReason ?? null,
            }))
            .sort((a: any, b: any) => (b.visitDate || "").localeCompare(a.visitDate || "")
                || (b.createdAt ?? 0) - (a.createdAt ?? 0));
    },
});

// One visit as the printed form shows it: frozen wording, frozen names.
export const getVisitForm = query({
    args: { id: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        const visit = await requireVisit(ctx, (ctx as any).supervisionSession, args.id);
        if (!visit) return null;
        const school = await getSchool(ctx);
        const settings = await settingsOf(ctx, school);

        let snapshot: any = null;
        try { snapshot = visit.snapshot ? JSON.parse(visit.snapshot) : null; } catch { snapshot = null; }

        const criteria = snapshot?.criteria
            ?? (await activeCriteria(ctx, school._id)).map((c: any) => ({
                _id: c._id, domain: c.domain, text: c.text, order: c.order,
            }));

        const headerId = snapshot?.headerImageId ?? settings.headerImageId;
        const footerId = snapshot?.footerImageId ?? settings.footerImageId;
        // Only the deputy's own submitted visits carry the deputy's signature;
        // a visit keeps the signature it was submitted with
        const signatureId = visit.visitorRole === "deputy" && visit.status === "submitted"
            ? snapshot?.deputySignatureId ?? settings.deputySignatureId : null;

        return {
            visit: {
                ...visit,
                ratings: parseRatings(visit.ratings),
            },
            criteria,
            form: {
                schoolName: snapshot?.schoolName ?? settings.schoolNameOnForm,
                academicYear: snapshot?.academicYear ?? settings.academicYear,
                deputyName: snapshot?.deputyName ?? settings.deputyName,
                principalName: snapshot?.principalName ?? settings.principalName,
                headerUrl: await imageUrl(ctx, headerId),
                footerUrl: await imageUrl(ctx, footerId),
                signatureUrl: await imageUrl(ctx, signatureId),
            },
        };
    },
});

export const getVersions = query({
    args: { id: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        await requireVisit(ctx, (ctx as any).supervisionSession, args.id);
        const rows = await ctx.db.query("supervisionVisitVersions")
            .withIndex("by_visit", (q: any) => q.eq("visitId", args.id))
            .collect();
        return rows.sort((a: any, b: any) => b.version - a.version)
            .map((r: any) => ({ version: r.version, changedBy: r.changedBy, changedAt: r.changedAt, reason: r.reason }));
    },
});

async function audit(ctx: any, schoolId: any, visitId: any, action: string, actor: string | undefined, details: string) {
    await ctx.db.insert("supervisionAuditLog", {
        schoolId, visitId, action,
        actorName: actor, details, timestamp: Date.now(),
    });
}

const visitArgs = {
    id: v.optional(v.id("supervisionVisits")),
    visitorRole: roleV,
    visitorId: v.optional(v.id("supervisors")),
    visitorName: v.string(),
    teacherId: v.optional(v.id("schoolTeachers")),
    classId: v.optional(v.id("classes")),
    subjectName: v.string(),
    lessonTopic: v.string(),
    visitDate: v.string(),
    followUpType: v.optional(v.union(v.literal("full"), v.literal("partial"))),
    deliveryMode: v.optional(v.union(v.literal("field"), v.literal("remote"))),
    streamMode: v.optional(v.union(v.literal("merged"), v.literal("unmerged"))),
    ratings: v.string(),
    planningRec: v.optional(v.string()),
    executionRec: v.optional(v.string()),
    evalMgmtRec: v.optional(v.string()),
    managementRec: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    // «نفس المعلم + نفس نوع الزائر + نفس التاريخ» warns first; this confirms it
    confirmDuplicate: v.optional(v.boolean()),
    // entering a visit older than a year needs a stated reason
    oldDateReason: v.optional(v.string()),
    editReason: v.optional(v.string()),
    actorName: v.optional(v.string()),
    expectedUpdatedAt: v.optional(v.number()),
};

export const saveVisit = mutation({
    args: visitArgs,
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const settings = await settingsOf(ctx, school);
        const criteria = await activeCriteria(ctx, school._id);
        const criteriaRefs: CriterionRef[] = criteria.map((c: any) => ({ _id: c._id, domain: c.domain as Domain }));
        const ratings = parseRatings(args.ratings);
        const access = (ctx as any).supervisionSession;
        const existing = args.id ? await requireVisit(ctx, access, args.id, true) : null;
        args.actorName = access.name;
        const delegated = !existing && access.role === "coordinator" && args.visitorRole === "supervisor";
        const supervisor = delegated && args.visitorId ? await ctx.db.get(args.visitorId) : null;
        if (delegated && (!supervisor || supervisor.schoolId !== school._id || supervisor.role !== "supervisor" || !supervisor.isActive)) throw new ConvexError("اختر الموجه المسجل للقسم");
        args.visitorRole = existing?.visitorRole ?? (delegated ? "supervisor" : access.role);
        args.visitorName = existing?.visitorName ?? (delegated ? supervisor!.fullName : access.role === "deputy" ? settings.deputyName : access.name);
        args.visitorId = existing ? existing.visitorId : delegated ? supervisor!._id : access.visitorId;
        if (existing && args.expectedUpdatedAt !== (existing.updatedAt ?? existing.createdAt)) throw new ConvexError("تم تعديل الزيارة في جلسة أخرى؛ أعد فتحها قبل الحفظ");
        if (args.id && !existing) throw new ConvexError("الزيارة غير موجودة");
        if (existing?.deletedAt) throw new ConvexError("الزيارة في سلة المحذوفات — استرجعها أولاً");

        const teacher = args.teacherId ? await ctx.db.get(args.teacherId) : null;
        const cls = args.classId ? await ctx.db.get(args.classId) : null;
        if (!teacher || !canAccess(access, teacher.schoolId, teacher.department ?? "")) throw new ConvexError("المعلم خارج الأقسام المسموحة لك");
        if (delegated && !supervisor!.subjects.map((d: string) => d.trim()).includes((teacher.department ?? "").trim())) throw new ConvexError("الموجه غير مسجل لهذا القسم");
        if (cls && cls.schoolId !== school._id) throw new ConvexError("الصف غير متاح");

        // A submitted visit keeps who, by whom, what and when — as in the workbook
        if (existing && existing.status === "submitted") {
            const locked: string[] = [];
            if (existing.teacherId && existing.teacherId !== args.teacherId) locked.push("المعلم");
            if (existing.visitorRole !== args.visitorRole) locked.push("نوع الزائر");
            if (existing.visitDate !== args.visitDate) locked.push("التاريخ");
            if ((existing.subjectName ?? "").trim() !== args.subjectName.trim()) locked.push("المادة");
            if (locked.length) throw new ConvexError(`لا يمكن تغيير ${locked.join(" و")} بعد اعتماد الزيارة`);
            if (args.status === "draft") throw new ConvexError("الزيارة المعتمدة لا تعود مسودة");
        }

        if (args.status === "submitted") {
            const issues = validateVisit({
                teacherId: args.teacherId, classId: args.classId, lessonTopic: args.lessonTopic,
                visitDate: args.visitDate, followUpType: args.followUpType ?? null, ratings,
                planningRec: args.planningRec, executionRec: args.executionRec,
                evalMgmtRec: args.evalMgmtRec, managementRec: args.managementRec, notes: args.notes,
            }, criteriaRefs, { allowOldDate: Boolean(args.oldDateReason?.trim()) });
            if (issues.length) throw new ConvexError(issues.map(i => i.message).join(" · "));

            if (!args.confirmDuplicate) {
                const sameTeacher = await ctx.db.query("supervisionVisits")
                    .withIndex("by_teacher_id", (q: any) => q.eq("schoolId", school._id).eq("teacherId", args.teacherId))
                    .collect();
                const twin = sameTeacher.find((x: any) =>
                    x._id !== args.id && !x.deletedAt && x.status === "submitted"
                    && x.visitorRole === args.visitorRole && x.visitDate === args.visitDate);
                if (twin) {
                    return {
                        ok: false as const,
                        duplicate: { id: twin._id, visitorName: twin.visitorName, recordNo: twin.recordNo ?? null },
                    };
                }
            }
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(args.visitDate)) {
            throw new ConvexError("أدخل تاريخ الزيارة");
        }

        const scores = computeScores(ratings, criteriaRefs);
        const now = Date.now();
        const teacherName = teacher.fullName.replace(/\s+/g, " ").trim();
        const common = {
            visitorRole: args.visitorRole,
            visitorId: args.visitorId,
            visitorName: args.visitorName.trim(),
            recordedByVisitorId: existing ? existing.recordedByVisitorId : access.visitorId,
            recordedByName: existing ? existing.recordedByName : access.name,
            teacherId: args.teacherId,
            teacherName,
            teacherDepartment: (teacher.department ?? "").trim(),
            subjectName: args.subjectName.trim(),
            classId: args.classId,
            className: cls?.name ?? existing?.className ?? "",
            lessonTopic: args.lessonTopic.trim(),
            visitDate: args.visitDate,
            followUpType: args.followUpType ?? "full",
            deliveryMode: args.deliveryMode ?? "field",
            // the live-stream boxes only mean something for a remote lesson
            streamMode: args.deliveryMode === "remote" ? args.streamMode : undefined,
            ratings: JSON.stringify(ratings),
            averageScore: scores.average ?? 0,
            domainAverages: JSON.stringify(scores.domains),
            planningRec: args.planningRec?.trim(),
            executionRec: args.executionRec?.trim(),
            evalMgmtRec: args.evalMgmtRec?.trim(),
            managementRec: args.managementRec?.trim(),
            notes: [args.notes?.trim(), args.oldDateReason?.trim() ? `(إدخال لاحق: ${args.oldDateReason.trim()})` : ""]
                .filter(Boolean).join("\n") || undefined,
            status: args.status,
            updatedAt: now,
            updatedBy: args.actorName,
        };

        // Numbers and the frozen form are fixed at the moment of submitting
        const becomingSubmitted = args.status === "submitted" && existing?.status !== "submitted";
        let numbering: any = {};
        if (becomingSubmitted) {
            const all = await ctx.db.query("supervisionVisits")
                .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
                .collect();
            const thisYear = all.filter((x: any) => (x.academicYear ?? settings.academicYear) === settings.academicYear);
            const recordNo = thisYear.reduce((m: number, x: any) => Math.max(m, x.recordNo ?? 0), 0) + 1;
            const visitNumber = all.filter((x: any) =>
                x._id !== args.id && !x.deletedAt && x.status === "submitted"
                && x.visitorRole === args.visitorRole
                && (x.teacherId ? x.teacherId === args.teacherId : nameKey(x.teacherName) === nameKey(teacherName))
            ).length + 1;

            numbering = {
                recordNo,
                visitNumber,
                academicYear: settings.academicYear,
                submittedAt: now,
                snapshot: JSON.stringify({
                    schoolName: settings.schoolNameOnForm,
                    academicYear: settings.academicYear,
                    deputyName: settings.deputyName,
                    principalName: settings.principalName,
                    headerImageId: settings.headerImageId,
                    footerImageId: settings.footerImageId,
                    deputySignatureId: settings.deputySignatureId,
                    criteria: criteria.map((c: any) => ({ _id: c._id, domain: c.domain, text: c.text, order: c.order })),
                }),
            };
        }

        if (existing) {
            if (existing.status === "submitted") {
                const versions = await ctx.db.query("supervisionVisitVersions")
                    .withIndex("by_visit", (q: any) => q.eq("visitId", existing._id))
                    .collect();
                const { _id, _creationTime, ...before } = existing as any;
                await ctx.db.insert("supervisionVisitVersions", {
                    schoolId: school._id,
                    visitId: existing._id,
                    version: versions.length + 1,
                    data: JSON.stringify(before),
                    changedBy: args.actorName,
                    changedAt: now,
                    reason: args.editReason?.trim() || undefined,
                });
            }
            await ctx.db.patch(existing._id, { ...common, ...numbering });
            await audit(ctx, school._id, existing._id,
                becomingSubmitted ? "submitted" : "updated", args.actorName,
                `${becomingSubmitted ? "اعتماد" : "تعديل"} زيارة ${teacherName}`);
            return { ok: true as const, id: existing._id, recordNo: numbering.recordNo ?? existing.recordNo ?? null };
        }

        const id = await ctx.db.insert("supervisionVisits", {
            schoolId: school._id,
            ...common,
            visitNumber: numbering.visitNumber ?? 0,
            createdAt: now,
            ...numbering,
        });
        await audit(ctx, school._id, id, becomingSubmitted ? "submitted" : "created", args.actorName,
            `${becomingSubmitted ? "اعتماد" : "مسودة"} زيارة ${teacherName}`);
        return { ok: true as const, id, recordNo: numbering.recordNo ?? null };
    },
});

export const deleteVisit = deputyMutation({
    args: { id: v.id("supervisionVisits"), reason: v.string(), actorName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        args.actorName = (ctx as any).supervisionSession.name;
        if (!args.reason.trim()) throw new ConvexError("اكتب سبب الحذف");
        const visit = await ctx.db.get(args.id);
        if (!visit) throw new ConvexError("الزيارة غير موجودة");
        await ctx.db.patch(args.id, {
            deletedAt: Date.now(), deletedBy: args.actorName, deleteReason: args.reason.trim(),
        });
        await audit(ctx, visit.schoolId, args.id, "deleted", args.actorName,
            `حذف زيارة ${visit.teacherName}: ${args.reason.trim()}`);
    },
});

export const restoreVisit = deputyMutation({
    args: { id: v.id("supervisionVisits"), actorName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const visit = await ctx.db.get(args.id);
        if (!visit) throw new ConvexError("الزيارة غير موجودة");
        args.actorName = (ctx as any).supervisionSession.name;
        await ctx.db.patch(args.id, { deletedAt: undefined, deletedBy: undefined, deleteReason: undefined });
        await audit(ctx, visit.schoolId, args.id, "restored", args.actorName, `استرجاع زيارة ${visit.teacherName}`);
    },
});

// ── Settings ─────────────────────────────────────────────────────────────
export const updateSettings = deputyMutation({
    args: {
        academicYear: v.optional(v.string()),
        yearStart: v.optional(v.string()),
        yearEnd: v.optional(v.string()),
        schoolNameOnForm: v.optional(v.string()),
        principalName: v.optional(v.string()),
        deputyName: v.optional(v.string()),
        requiredCoordinator: v.optional(v.number()),
        requiredSupervisor: v.optional(v.number()),
        requiredDeputy: v.optional(v.number()),
        headerImageId: v.optional(v.union(v.id("_storage"), v.null())),
        footerImageId: v.optional(v.union(v.id("_storage"), v.null())),
        deputySignatureId: v.optional(v.union(v.id("_storage"), v.null())),
    },
    handler: async (ctx, args) => {
        if (args.deputyName !== undefined && !args.deputyName.trim()) throw new ConvexError("اسم النائب الأكاديمي مطلوب");
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("supervisionSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        const patch: any = {};
        for (const [k, val] of Object.entries(args)) {
            if (val === undefined) continue;
            patch[k] = val === null ? undefined : typeof val === "string" ? val.trim() : val;
        }
        if (existing) await ctx.db.patch(existing._id, patch);
        else await ctx.db.insert("supervisionSettings", {
            schoolId: school._id, academicYear: DEFAULT_YEAR, ...patch,
        });
    },
});

export const generateUploadUrl = deputyMutation({
    args: {},
    handler: async (ctx) => ctx.storage.generateUploadUrl(),
});
