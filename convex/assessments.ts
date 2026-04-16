import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get assessments matrix for a specific class
export const getClassAssessments = query({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
    },
    handler: async (ctx, args) => {
        const cls = await ctx.db.get(args.classId);
        if (!cls) throw new Error("الصف غير موجود");

        // Get subjects for this school and filter by the class's grade and track
        const allSubjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), args.schoolId))
            .collect();
            
        const targetString = `${cls.grade}-${cls.track || "عام"}`;
        
        const subjects = allSubjects.filter(sub => {
            if (!sub.targetClasses || sub.targetClasses.length === 0) return false;
            return sub.targetClasses.includes(targetString);
        });

        // Get active students for this class
        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        // Get all assessments for this class
        const assessments = await ctx.db.query("assessments")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .collect();

        // Build status lookup matrix
        // studentId_subjectId -> isCompleted
        const matrix = new Map<string, boolean>();
        for (const a of assessments) {
            matrix.set(`${a.studentId}_${a.subjectId}`, a.isCompleted);
        }

        const studentRows = students.map(student => {
            const subjectStatuses = subjects.map(sub => {
                const isCompleted = matrix.get(`${student._id}_${sub._id}`) || false;
                return {
                    subjectId: sub._id,
                    subjectName: sub.name,
                    isCompleted
                };
            });

            const completedCount = subjectStatuses.filter(s => s.isCompleted).length;
            const totalSubjects = subjects.length;
            const remainingCount = totalSubjects - completedCount;
            const completionPercentage = totalSubjects > 0 ? (completedCount / totalSubjects) * 100 : 0;

            return {
                studentId: student._id,
                studentName: student.fullName,
                statuses: subjectStatuses,
                completedCount,
                remainingCount,
                completionPercentage
            };
        });

        // Summary for class
        const totalStudents = students.length;
        const totalPossibleAssessments = totalStudents * subjects.length;
        const totalCompletedAssessments = assessments.filter(a => a.isCompleted).length;
        const overallPercentage = totalPossibleAssessments > 0 ? (totalCompletedAssessments / totalPossibleAssessments) * 100 : 0;

        return {
            className: cls.name,
            grade: cls.grade,
            subjects,
            students: studentRows,
            summary: {
                totalStudents,
                totalCompletedAssessments,
                overallPercentage
            }
        };
    }
});

// Toggle assessment for a student in a specific subject
export const toggleAssessment = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.id("students"),
        subjectId: v.id("subjects"),
    },
    handler: async (ctx, args) => {
        // Look for existing assessment record
        const existing = await ctx.db.query("assessments")
            .withIndex("by_class_subject_student", q =>
                q.eq("classId", args.classId)
                 .eq("subjectId", args.subjectId)
                 .eq("studentId", args.studentId)
            )
            .first();

        if (existing) {
            const newStatus = !existing.isCompleted;
            await ctx.db.patch(existing._id, { isCompleted: newStatus });
            return { newStatus };
        } else {
            // Create new record
            await ctx.db.insert("assessments", {
                schoolId: args.schoolId,
                classId: args.classId,
                studentId: args.studentId,
                subjectId: args.subjectId,
                isCompleted: true, // initial click sets to true
            });
            return { newStatus: true };
        }
    }
});

// Toggle assessment for ALL students in a class for a specific subject
export const toggleSubjectForAll = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        isCompleted: v.boolean(),
    },
    handler: async (ctx, args) => {
        // Get all active students for this class
        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();
            
        // Get all existing assessments for this specific subject & class
        const existing = await ctx.db.query("assessments")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("subjectId"), args.subjectId))
            .collect();
            
        const existingMap = new Map();
        for (const a of existing) {
            existingMap.set(a.studentId, a);
        }
        
        // Upsert for each student
        for (const student of students) {
            const ext = existingMap.get(student._id);
            if (ext) {
                if (ext.isCompleted !== args.isCompleted) {
                    await ctx.db.patch(ext._id, { isCompleted: args.isCompleted });
                }
            } else {
                await ctx.db.insert("assessments", {
                    schoolId: args.schoolId,
                    classId: args.classId,
                    studentId: student._id,
                    subjectId: args.subjectId,
                    isCompleted: args.isCompleted,
                });
            }
        }
        return "تم تحديث الكل";
    }
});
