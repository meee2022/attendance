import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireSession } from "./supervisionAccess";

export function redactPlatformResult(value: any, privileged: boolean): any {
    if (Array.isArray(value)) return value.map(x => redactPlatformResult(x, privileged));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) =>
        !/^(adminPin|teacherPin|coordinatorPin|supervisorPin|deputyPin|pin|credentialHash|tokenHash)$/i.test(key)
        && (privileged || !/^(nationalId|guardianPhone|phone|phoneNumber|mobile|parentPhone)$/i.test(key)))
        .map(([key, child]) => [key, redactPlatformResult(child, privileged)]));
}

function secure(builder: any, access: "member" | "staff" | "admin", write: boolean) {
    return (config: any) => builder({ ...config, args: { ...config.args, sessionToken: v.string() },
        handler: async (ctx: any, raw: any) => {
            const { sessionToken, ...args } = raw;
            const session = await requireSession(ctx, sessionToken);
            const privileged = session.role === "admin" || session.role === "deputy";
            if (access === "admin" && session.role !== "admin" || access === "staff" && !privileged) throw new ConvexError("هذه العملية غير متاحة لصفتك الحالية");
            // The platform currently serves one school; reject a forged explicit school ID.
            if (args.schoolId && args.schoolId !== session.schoolId) throw new ConvexError("المدرسة غير متاحة");
            if (write && "updatedBy" in args) args.updatedBy = session.name;
            const result = await config.handler({ ...ctx, platformSession: session }, args);
            return redactPlatformResult(result, privileged);
        },
    });
}
export const memberQuery: typeof query = secure(query, "member", false);
export const memberMutation: typeof mutation = secure(mutation, "member", true);
export const staffQuery: typeof query = secure(query, "staff", false);
export const staffMutation: typeof mutation = secure(mutation, "staff", true);
export const adminMutation: typeof mutation = secure(mutation, "admin", true);
