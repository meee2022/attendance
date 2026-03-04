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

        // 1. Get relevant classes (indexed by school, filter by grade in memory — small set)
        const allClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const filteredClasses = allClasses.filter(c =>
            c.isActive !== false &&
            (args.grade == null || c.grade === args.grade)
        );
        if (filteredClasses.length === 0) return [];

        // 2. Subjects map (small collection — indexed by school)
        const subjectDocs = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();
        const subjectMap = new Map(subjectDocs.map(s => [s._id.toString(), s.name]));

        const result: {
            studentId: string;
            studentName: string;
            className: string;
            grade: number;
            phone: string;
            subjects: string;
        }[] = [];

        // 3. Per class: use by_class_date index — no full periods scan
        for (const cls of filteredClasses) {

            // 3a. Periods for this class on this date (indexed — typically ≤10 records)
            const classPeriods = await ctx.db.query("periods")
                .withIndex("by_class_date", q =>
                    q.eq("classId", cls._id).eq("date", args.date)
                )
                .collect();

            if (classPeriods.length === 0) continue;

            // 3b. Attendance for ALL periods of this class at once
            //     by_period index — one query per period, returns ≤35 records each
            const studentAttMap = new Map<string, { status: string; subjectId: string }[]>();

            for (const period of classPeriods) {
                const attRecords = await ctx.db.query("attendance")
                    .withIndex("by_period", q => q.eq("periodId", period._id))
                    .collect();

                for (const att of attRecords) {
                    if (!att.studentId) continue;
                    const key = att.studentId.toString();
                    if (!studentAttMap.has(key)) studentAttMap.set(key, []);
                    studentAttMap.get(key)!.push({
                        status: att.status,
                        subjectId: period.subjectId.toString(),
                    });
                }
            }

            if (studentAttMap.size === 0) continue;

            // 3c. Students for this class (indexed — typically ≤35 records)
            const students = await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .collect();

            for (const student of students) {
                if (student.isActive === false) continue;

                const periodAttendance = studentAttMap.get(student._id.toString()) ?? [];

                // Students with no records → skip entirely
                if (periodAttendance.length === 0) continue;

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

        return result
            .slice(0, 5000) // safety cap
            .sort((a, b) => {
                if (a.grade !== b.grade) return a.grade - b.grade;
                const sA = parseInt(a.className.split("-")[1] || "0");
                const sB = parseInt(b.className.split("-")[1] || "0");
                if (sA !== sB) return sA - sB;
                return a.studentName.localeCompare(b.studentName, "ar");
            });
    },
});
