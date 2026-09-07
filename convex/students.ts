import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
    UNASSIGNED_LABEL,
    majorityTrack,
    normalizeClassName,
    primaryPhone,
    resolveClass,
} from "./classHelpers";

export const importStudentsFromSheet = mutation({
    args: {
        schoolId: v.id("schools"),
        rows: v.array(v.object({
            fullName: v.string(),
            className: v.string(),              // "10/1" | "10-1" | "12/ESE" | "-"
            phones: v.string(),
            nationalId: v.optional(v.string()), // "الرقم"
            sourceGrade: v.optional(v.string()) // raw "الصف" cell, e.g. "12-Science"
        })),
        // Mark classes that no longer appear in the roster as inactive so they
        // disappear from attendance / messaging / exam screens too.
        deactivateMissingClasses: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        const classByName = new Map<string, typeof existingClasses[number]>();
        for (const cls of existingClasses) classByName.set(normalizeClassName(cls.name), cls);

        // ── 1. Resolve every row to a target class ────────────────────────
        type Resolved = {
            fullName: string;
            nationalId?: string;
            phones: string;
            className: string;
            grade: number;
            track: string;
        };

        const resolved: Resolved[] = [];
        for (const row of args.rows) {
            const fullName = row.fullName.trim();
            if (!fullName) continue;

            const target = resolveClass(row.sourceGrade || "", row.className);
            if (!target) continue;

            resolved.push({
                fullName,
                nationalId: row.nationalId?.trim() || undefined,
                phones: row.phones,
                ...target,
            });
        }

        // ── 2. Majority track per class ───────────────────────────────────
        // Sections are usually homogeneous, but a handful of students carry a
        // different track than their classmates; the class takes the majority.
        const tallies = new Map<string, { grade: number; tracks: Record<string, number> }>();
        for (const r of resolved) {
            const t = tallies.get(r.className) ?? { grade: r.grade, tracks: {} };
            t.tracks[r.track] = (t.tracks[r.track] || 0) + 1;
            tallies.set(r.className, t);
        }

        const classPlan = new Map<string, { grade: number; track: string }>();
        for (const [name, t] of tallies) {
            classPlan.set(name, { grade: t.grade, track: majorityTrack(t.tracks) });
        }

        // ── 3. Create missing classes / fix grade + track on existing ones ──
        const createdClasses: string[] = [];
        const updatedClasses: string[] = [];
        const classIdByName = new Map<string, any>();

        for (const [name, plan] of classPlan) {
            const existing = classByName.get(name);
            if (!existing) {
                const id = await ctx.db.insert("classes", {
                    schoolId: args.schoolId,
                    name,
                    grade: plan.grade,
                    track: plan.track,
                    isActive: true,
                });
                classIdByName.set(name, id);
                createdClasses.push(name);
            } else {
                const patch: Record<string, unknown> = {};
                if (existing.grade !== plan.grade) patch.grade = plan.grade;
                if (existing.track !== plan.track) patch.track = plan.track;
                if (existing.isActive !== true) patch.isActive = true;
                if (Object.keys(patch).length > 0) {
                    await ctx.db.patch(existing._id, patch);
                    updatedClasses.push(name);
                }
                classIdByName.set(name, existing._id);
            }
        }

        // ── 4. Retire classes that are not in the new roster ──────────────
        const deactivatedClasses: string[] = [];
        if (args.deactivateMissingClasses) {
            for (const cls of existingClasses) {
                const name = normalizeClassName(cls.name);
                if (classPlan.has(name)) continue;
                if (cls.isActive === false) continue;
                await ctx.db.patch(cls._id, { isActive: false });
                deactivatedClasses.push(cls.name);
            }
        }

        // ── 5. Upsert the students ────────────────────────────────────────
        // Re-running the same sheet must not duplicate the school: match on the
        // national id ("الرقم"), falling back to the name for rows without one.
        const existingStudents = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        const byNationalId = new Map<string, typeof existingStudents[number]>();
        const byName = new Map<string, typeof existingStudents[number]>();
        for (const s of existingStudents) {
            if (s.nationalId) byNationalId.set(s.nationalId.trim(), s);
            byName.set(s.fullName.trim(), s);
        }

        let importedCount = 0;
        let updatedCount = 0;
        let unassignedCount = 0;

        for (const r of resolved) {
            const classId = classIdByName.get(r.className);
            const existing = (r.nationalId && byNationalId.get(r.nationalId))
                || (!r.nationalId ? byName.get(r.fullName) : undefined);

            if (existing) {
                await ctx.db.patch(existing._id, {
                    classId: classId as any,
                    fullName: r.fullName,
                    nationalId: r.nationalId ?? existing.nationalId,
                    guardianPhone: primaryPhone(r.phones) ?? existing.guardianPhone,
                    isActive: true,
                });
                updatedCount++;
            } else {
                await ctx.db.insert("students", {
                    schoolId: args.schoolId,
                    classId: classId as any,
                    fullName: r.fullName,
                    nationalId: r.nationalId,
                    guardianPhone: primaryPhone(r.phones),
                    isActive: true,
                });
                importedCount++;
            }

            if (r.className.includes(UNASSIGNED_LABEL)) unassignedCount++;
        }

        return {
            importedCount,
            updatedCount,
            skippedCount: args.rows.length - resolved.length,
            unassignedCount,
            createdClasses,
            updatedClasses,
            deactivatedClasses,
            totalClasses: classPlan.size,
        };
    }
});

// Batched reset so a large school does not blow the per-transaction write
// limit: call repeatedly until `done` is true.
export const deleteAllStudentsAndAttendance = mutation({
    args: {
        schoolId: v.id("schools"),
        batchSize: v.optional(v.number()),
        // Last year's marks / practical absences belong to the old roster too.
        includeGrades: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const batchSize = args.batchSize ?? 40;

        let students = 0;
        let attendance = 0;
        let assessments = 0;
        let periods = 0;
        let grades = 0;
        let practical = 0;

        // Students (with everything hanging off them), a slice at a time
        const batch = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .take(batchSize);

        for (const s of batch) {
            const atts = await ctx.db.query("attendance")
                .withIndex("by_student", q => q.eq("studentId", s._id))
                .collect();
            for (const a of atts) { await ctx.db.delete(a._id); attendance++; }

            const asmts = await ctx.db.query("assessments")
                .withIndex("by_student", q => q.eq("studentId", s._id))
                .collect();
            for (const a of asmts) { await ctx.db.delete(a._id); assessments++; }

            await ctx.db.delete(s._id);
            students++;
        }

        if (batch.length > 0) {
            return { students, attendance, assessments, periods, grades, practical, done: false };
        }

        // Roster is empty — clean up the records keyed by name instead of id
        if (args.includeGrades) {
            const sg = await ctx.db.query("studentGrades")
                .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
                .take(batchSize * 5);
            for (const g of sg) { await ctx.db.delete(g._id); grades++; }

            const pa = await ctx.db.query("practicalAbsences")
                .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
                .take(batchSize * 5);
            for (const p of pa) { await ctx.db.delete(p._id); practical++; }

            if (grades > 0 || practical > 0) {
                return { students, attendance, assessments, periods, grades, practical, done: false };
            }
        }

        // Finally the (now orphaned) periods, class by class
        const allClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        for (const cls of allClasses) {
            const clsPeriods = await ctx.db.query("periods")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .take(batchSize * 5);
            for (const p of clsPeriods) { await ctx.db.delete(p._id); periods++; }
            if (periods >= batchSize * 5) {
                return { students, attendance, assessments, periods, grades, practical, done: false };
            }
        }

        return { students, attendance, assessments, periods, grades, practical, done: true };
    },
});

export const deleteDummyStudents = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        let studentCount = 0;
        let attendanceCount = 0;

        for (const student of students) {
            // Seeded students have nationalId starting with 12345 or names starting with "طالب"
            const isDummy =
                student.fullName.startsWith("طالب") ||
                student.nationalId?.startsWith("12345");

            if (isDummy) {
                // Delete all attendance records for this dummy student
                const atts = await ctx.db.query("attendance")
                    .withIndex("by_student", q => q.eq("studentId", student._id))
                    .collect();

                for (const a of atts) {
                    await ctx.db.delete(a._id);
                    attendanceCount++;
                }

                await ctx.db.delete(student._id);
                studentCount++;
            }
        }
        return { studentCount, attendanceCount };
    },
});

export const getStudentsByClass = query({
    args: { classId: v.id("classes") },
    handler: async (ctx, args) => {
        return await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();
    }
});

export const addStudent = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        fullName: v.string(),
        guardianPhone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const studentId = await ctx.db.insert("students", {
            schoolId: args.schoolId,
            classId: args.classId,
            fullName: args.fullName.trim(),
            guardianPhone: args.guardianPhone?.trim() || undefined,
            isActive: true,
        });
        return studentId;
    }
});

// Moving a student carries their records along: grades and practical absences
// store the class denormalised (className / grade / track), so those rows have
// to be re-stamped or the student disappears from their new class' sheets.
export const updateStudentClass = mutation({
    args: {
        studentId: v.id("students"),
        newClassId: v.id("classes"),
    },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        if (!student) throw new Error("الطالب غير موجود");

        const newClass = await ctx.db.get(args.newClassId);
        if (!newClass) throw new Error("الصف الجديد غير موجود");

        await ctx.db.patch(args.studentId, { classId: args.newClassId });

        const movedRecords = await moveStudentRecords(ctx, student, newClass);

        return {
            message: "تم النقل بنجاح",
            ...movedRecords,
        };
    }
});

// Re-stamp every record that carries a copy of the student's class.
async function moveStudentRecords(ctx: any, student: any, newClass: any) {
    let grades = 0;
    let practical = 0;
    let assessments = 0;
    let attendance = 0;

    // درجات الطالب — mapped by name within the school (studentId is optional there)
    const gradeRows = await ctx.db.query("studentGrades")
        .withIndex("by_student", (q: any) =>
            q.eq("schoolId", student.schoolId).eq("studentName", student.fullName))
        .collect();

    for (const row of gradeRows) {
        if (row.studentId && row.studentId !== student._id) continue;
        await ctx.db.patch(row._id, {
            studentId: student._id,
            className: newClass.name,
            grade: newClass.grade,
            track: newClass.track ?? row.track,
            updatedAt: Date.now(),
        });
        grades++;
    }

    // غياب الاختبارات العملية / الشفوية
    const practicalRows = await ctx.db.query("practicalAbsences")
        .withIndex("by_student", (q: any) =>
            q.eq("schoolId", student.schoolId).eq("studentName", student.fullName))
        .collect();

    for (const row of practicalRows) {
        if (row.studentId && row.studentId !== student._id) continue;
        await ctx.db.patch(row._id, {
            studentId: student._id,
            className: newClass.name,
            grade: newClass.grade,
        });
        practical++;
    }

    // التقييمات المستمرة
    const assessmentRows = await ctx.db.query("assessments")
        .withIndex("by_student", (q: any) => q.eq("studentId", student._id))
        .collect();

    for (const row of assessmentRows) {
        await ctx.db.patch(row._id, { classId: newClass._id });
        assessments++;
    }

    // سجل الحضور — the row keeps its original period (that lesson really did
    // happen in the old class), only the denormalised classId is re-pointed so
    // per-class reports follow the student.
    const attendanceRows = await ctx.db.query("attendance")
        .withIndex("by_student", (q: any) => q.eq("studentId", student._id))
        .collect();

    for (const row of attendanceRows) {
        if (row.classId === newClass._id) continue;
        await ctx.db.patch(row._id, { classId: newClass._id });
        attendance++;
    }

    return { grades, practical, assessments, attendance };
}

export const updateStudentDetails = mutation({
    args: {
        studentId: v.id("students"),
        fullName: v.string(),
        guardianPhone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        if (!student) throw new Error("الطالب غير موجود");

        const newName = args.fullName.trim();

        // Grades and practical absences are keyed by name — rename them too,
        // otherwise the old rows are orphaned the moment a typo is fixed.
        if (newName && newName !== student.fullName) {
            const gradeRows = await ctx.db.query("studentGrades")
                .withIndex("by_student", q =>
                    q.eq("schoolId", student.schoolId).eq("studentName", student.fullName))
                .collect();
            for (const row of gradeRows) {
                if (row.studentId && row.studentId !== student._id) continue;
                await ctx.db.patch(row._id, { studentName: newName, studentId: student._id });
            }

            const practicalRows = await ctx.db.query("practicalAbsences")
                .withIndex("by_student", q =>
                    q.eq("schoolId", student.schoolId).eq("studentName", student.fullName))
                .collect();
            for (const row of practicalRows) {
                if (row.studentId && row.studentId !== student._id) continue;
                await ctx.db.patch(row._id, { studentName: newName, studentId: student._id });
            }
        }

        await ctx.db.patch(args.studentId, {
            fullName: newName,
            guardianPhone: args.guardianPhone?.trim() || undefined,
        });
        return "تم تحديث البيانات";
    }
});

export const deleteStudent = mutation({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        // Delete student's attendance records first
        const atts = await ctx.db.query("attendance")
            .withIndex("by_student", q => q.eq("studentId", args.studentId))
            .collect();
        for (const a of atts) {
            await ctx.db.delete(a._id);
        }

        // Delete student's assessments
        const assessments = await ctx.db.query("assessments")
            .withIndex("by_student", q => q.eq("studentId", args.studentId))
            .collect();
        for (const as of assessments) {
            await ctx.db.delete(as._id);
        }

        // Delete the student
        await ctx.db.delete(args.studentId);
        return "تم حذف الطالب";
    }
});
