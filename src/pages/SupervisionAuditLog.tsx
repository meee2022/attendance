import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { History, Plus, Pencil, Trash2, FileSignature, Send } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    created:   { label: "إنشاء",   color: "#10b981", icon: Plus },
    updated:   { label: "تعديل",  color: "#3b82f6", icon: Pencil },
    deleted:   { label: "حذف",    color: "#ef4444", icon: Trash2 },
    signed:    { label: "توقيع",  color: "#8b5cf6", icon: FileSignature },
    submitted: { label: "إرسال",  color: "#5C1A1B", icon: Send },
};

const ROLE_LABELS: Record<string, string> = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب" };

export default function SupervisionAuditLog() {
    const log = useQuery(api.supervision.getAuditLog, { limit: 200 }) as any[] | undefined;

    if (!log) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    return (
        <div dir="rtl" className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{log.length}</span>
                    <span className="font-black text-white text-sm flex items-center gap-2">
                        <History className="w-4 h-4 text-white/60"/>سجل المراجعات
                    </span>
                </div>
                {log.length === 0 ? (
                    <p className="text-center py-10 text-slate-400 font-bold text-sm">لا توجد سجلات بعد</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {log.map(entry => {
                            const action = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "#64748b", icon: History };
                            const Icon = action.icon;
                            return (
                                <div key={entry._id} className="px-4 py-3 flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: `${action.color}15`, color: action.color }}>
                                        <Icon className="w-4 h-4"/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: action.color }}>
                                                {action.label}
                                            </span>
                                            {entry.actorRole && (
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {ROLE_LABELS[entry.actorRole] ?? entry.actorRole}
                                                </span>
                                            )}
                                            {entry.actorName && (
                                                <span className="text-[10px] font-bold text-slate-700">· {entry.actorName}</span>
                                            )}
                                        </div>
                                        {entry.details && (
                                            <p className="text-xs font-bold text-slate-600">{entry.details}</p>
                                        )}
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                            {new Date(entry.timestamp).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
