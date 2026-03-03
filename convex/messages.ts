import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_ABSENT_BODY =
    `السيد ولي أمر الطالب/ {{studentName}}
يرجى العلم بأنه قد تم تسجيل ابنكم (غياب) عن يوم {{dayName}} الموافق {{date}} في المواد التالية: {{subjects}}
لمزيد من الاستفسار يمكنكم الاتصال على رقم المدرسة.
— {{schoolName}}`;

const DEFAULT_PRESENT_BODY =
    `السيد ولي أمر الطالب/ {{studentName}}
يسعدنا إبلاغكم بأن ابنكم حضر جميع حصص يوم {{dayName}} الموافق {{date}}.
شكراً على متابعتكم — {{schoolName}}`;

export const getTemplates = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { absent: null, present: null, schoolId: null };

        const templates = await ctx.db.query("messageTemplates")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        return {
            schoolId: school._id,
            absent:  templates.find(t => t.type === "absent")  ?? null,
            present: templates.find(t => t.type === "present") ?? null,
            defaultAbsent:  DEFAULT_ABSENT_BODY,
            defaultPresent: DEFAULT_PRESENT_BODY,
        };
    },
});

export const upsertTemplate = mutation({
    args: {
        type: v.union(v.literal("present"), v.literal("absent")),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");

        const existing = await ctx.db.query("messageTemplates")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .filter(q => q.eq(q.field("type"), args.type))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { body: args.body, isActive: true });
            return existing._id;
        } else {
            return await ctx.db.insert("messageTemplates", {
                schoolId: school._id,
                name: args.type === "absent" ? "رسالة غياب" : "رسالة حضور",
                type: args.type,
                body: args.body,
                isActive: true,
            });
        }
    },
});

export const getStudentsForMessages = query({
    args: {
        date: v.string(),
        grade: v.optional(v.number()),
        type: v.union(v.literal("absent"), v.literal("present")),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const allClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        const filteredClasses = args.grade
            ? allClasses.filter(c => c.grade === args.grade)
            : allClasses;

        const allPeriods = await ctx.db.query("periods")
            .filter(q => q.eq(q.field("date"), args.date))
            .collect();

        const allSubjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();
        const subjectMap = new Map(allSubjects.map(s => [s._id.toString(), s.name]));

        const result: {
            studentId: string;
            studentName: string;
            className: string;
            grade: number;
            phone: string;
            subjects: string;
        }[] = [];

        for (const cls of filteredClasses) {
            const students = await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .filter(q => q.eq(q.field("isActive"), true))
                .collect();

            const classPeriods = allPeriods.filter(p => p.classId === cls._id);
            if (classPeriods.length === 0) continue;

            for (const student of students) {
                const periodAttendance: { status: string; subjectId: string }[] = [];

                for (const period of classPeriods) {
                    const att = await ctx.db.query("attendance")
                        .withIndex("by_period", q => q.eq("periodId", period._id))
                        .filter(q => q.eq(q.field("studentId"), student._id))
                        .first();
                    if (att) {
                        periodAttendance.push({
                            status: att.status,
                            subjectId: period.subjectId.toString(),
                        });
                    }
                }

                const isAbsent  = periodAttendance.some(a => a.status === "absent");
                const isPresent = periodAttendance.some(a => a.status === "present");

                if (args.type === "absent"  && !isAbsent)  continue;
                if (args.type === "present" && !isPresent) continue;

                const absentSubjectNames = [
                    ...new Set(
                        periodAttendance
                            .filter(a => a.status === "absent")
                            .map(a => subjectMap.get(a.subjectId) || "")
                            .filter(Boolean)
                    ),
                ];

                result.push({
                    studentId: student._id as string,
                    studentName: student.fullName,
                    className: cls.name,
                    grade: cls.grade,
                    phone: student.guardianPhone || "",
                    subjects: absentSubjectNames.join("، "),
                });
            }
        }

        return result.sort((a, b) => {
            if (a.grade !== b.grade) return a.grade - b.grade;
            const sA = parseInt(a.className.split("-")[1] || "0");
            const sB = parseInt(b.className.split("-")[1] || "0");
            if (sA !== sB) return sA - sB;
            return a.studentName.localeCompare(b.studentName, "ar");
        });
    },
});
