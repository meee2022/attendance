import * as XLSX from "xlsx";

const OFFLINE_KEY = "supervision_offline_drafts";

export type OfflineDraft = {
    localId: string;
    visitorRole: "coordinator" | "supervisor" | "deputy";
    visitorName: string;
    teacherName: string;
    teacherDepartment: string;
    subjectName: string;
    className: string;
    lessonTopic: string;
    visitDate: string;
    followUpType: "full" | "partial";
    ratings: Record<string, number | "not_measured">;
    planningRec?: string;
    executionRec?: string;
    evalMgmtRec?: string;
    notes?: string;
    savedAt: number;
};

export function getOfflineDrafts(): OfflineDraft[] {
    try {
        const raw = localStorage.getItem(OFFLINE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveOfflineDraft(draft: OfflineDraft) {
    const all = getOfflineDrafts();
    const idx = all.findIndex(d => d.localId === draft.localId);
    if (idx >= 0) all[idx] = draft;
    else all.push(draft);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(all));
}

export function deleteOfflineDraft(localId: string) {
    const all = getOfflineDrafts().filter(d => d.localId !== localId);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(all));
}

export function newDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Excel Export ──────────────────────────────────────────────────────────
const ROLE_AR: Record<string, string> = {
    coordinator: "المنسق",
    supervisor: "الموجه",
    deputy: "النائب الأكاديمي",
};
const FOLLOW_UP_AR: Record<string, string> = { full: "كليّة", partial: "جزئيّة" };

export function exportVisitsToExcel(visits: any[], criteria: any[]) {
    const sortedCriteria = [...criteria].sort((a, b) => {
        const order = { planning: 0, execution: 1, evaluation: 2, management: 3 };
        return (order[a.domain as keyof typeof order] - order[b.domain as keyof typeof order]) || a.order - b.order;
    });

    const headers = [
        "اسم المعلم", "القسم", "صفة الزائر", "اسم الزائر", "المادة", "الصف",
        "عنوان الدرس", "التاريخ", "نوع المتابعة", "رقم الزيارة",
        "المعدل العام %", "التخطيط %", "تنفيذ الدرس %", "التقويم %", "الإدارة الصفية %",
        ...sortedCriteria.map(c => c.text),
        "توصيات التخطيط", "توصيات التنفيذ", "توصيات التقويم والإدارة",
        "ملاحظات", "تاريخ الإرسال", "موقَّعة من المعلم",
    ];

    const rows = visits.map(v => {
        let ratings: Record<string, any> = {};
        try { ratings = JSON.parse(v.ratings || "{}"); } catch {}
        let domAvgs: Record<string, number> = {};
        try { domAvgs = JSON.parse(v.domainAverages || "{}"); } catch {}

        return [
            v.teacherName,
            v.teacherDepartment,
            ROLE_AR[v.visitorRole] || v.visitorRole,
            v.visitorName,
            v.subjectName,
            v.className,
            v.lessonTopic,
            v.visitDate,
            FOLLOW_UP_AR[v.followUpType] || v.followUpType,
            v.visitNumber,
            ((v.averageScore || 0) * 100).toFixed(0) + "%",
            ((domAvgs.planning || 0) * 100).toFixed(0) + "%",
            ((domAvgs.execution || 0) * 100).toFixed(0) + "%",
            ((domAvgs.evaluation || 0) * 100).toFixed(0) + "%",
            ((domAvgs.management || 0) * 100).toFixed(0) + "%",
            ...sortedCriteria.map(c => {
                const r = ratings[c._id];
                if (r === undefined) return "";
                if (r === "not_measured") return "لم يقَس";
                return r;
            }),
            v.planningRec || "",
            v.executionRec || "",
            v.evalMgmtRec || "",
            v.notes || "",
            v.submittedAt ? new Date(v.submittedAt).toLocaleString("ar-EG") : "",
            v.teacherSignedAt ? new Date(v.teacherSignedAt).toLocaleString("ar-EG") : "",
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({ wch: i < 10 ? 18 : i < 15 ? 12 : 30 }));
    if (ws["!ref"]) {
        ws["!views"] = [{ RTL: true } as any];
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "زيارات الإشراف");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `supervision-visits-${stamp}.xlsx`);
}
