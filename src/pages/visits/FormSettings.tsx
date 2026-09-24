import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import { CheckCircle2, ImageUp, Loader2, Save, Trash2 } from "lucide-react";

// What changes on the form from one year to the next — the year, the names in
// the signature row, the official header and footer — kept out of the code.
// A visit freezes these when it is submitted, so changing them here only
// affects visits made from now on.

export default function FormSettings() {
    // @ts-ignore
    const setup = useQuery(api.visits.getSetup) as any;
    // @ts-ignore
    const update = useMutation(api.visits.updateSettings);
    // @ts-ignore
    const uploadUrl = useMutation(api.visits.generateUploadUrl);

    const [draft, setDraft] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploading, setUploading] = useState<"header" | "footer" | null>(null);

    useEffect(() => { if (setup && !draft) setDraft({ ...setup.settings }); }, [setup, draft]);

    if (!setup || !draft) return <div className="h-40 rounded-2xl bg-slate-50 animate-pulse"/>;

    const set = (k: string, v: any) => { setDraft((d: any) => ({ ...d, [k]: v })); setSaved(false); };

    const save = async () => {
        setSaving(true);
        try {
            await update({
                academicYear: draft.academicYear, yearStart: draft.yearStart, yearEnd: draft.yearEnd,
                schoolNameOnForm: draft.schoolNameOnForm, principalName: draft.principalName, deputyName: draft.deputyName,
                requiredCoordinator: Number(draft.requiredCoordinator) || 0,
                requiredSupervisor: Number(draft.requiredSupervisor) || 0,
                requiredDeputy: Number(draft.requiredDeputy) || 0,
            });
            setSaved(true);
        } finally { setSaving(false); }
    };

    const upload = async (kind: "header" | "footer", file: File) => {
        setUploading(kind);
        try {
            const url = await uploadUrl({});
            const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
            const { storageId } = await res.json();
            await update(kind === "header" ? { headerImageId: storageId } : { footerImageId: storageId });
        } finally { setUploading(null); }
    };

    const input = "w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon";

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <L label="العام الأكاديمي"><input className={input} value={draft.academicYear} onChange={e => set("academicYear", e.target.value)} placeholder="2026 - 2027"/></L>
                <L label="بداية العام"><input type="date" className={input} value={draft.yearStart} onChange={e => set("yearStart", e.target.value)}/></L>
                <L label="نهاية العام"><input type="date" className={input} value={draft.yearEnd} onChange={e => set("yearEnd", e.target.value)}/></L>
                <L label="اسم المدرسة على الاستمارة"><input className={input} value={draft.schoolNameOnForm} onChange={e => set("schoolNameOnForm", e.target.value)}/></L>
                <L label="نائب المدير للشؤون الأكاديمية"><input className={input} value={draft.deputyName} onChange={e => set("deputyName", e.target.value)} placeholder="يظهر في خانة التوقيع"/></L>
                <L label="مدير المدرسة"><input className={input} value={draft.principalName} onChange={e => set("principalName", e.target.value)}/></L>
            </div>

            <div>
                <p className="text-xs font-black text-slate-500 mb-2">عدد الزيارات المطلوب لكل معلم في العام</p>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                    <L label="من المنسق"><input type="number" min={0} className={input} value={draft.requiredCoordinator} onChange={e => set("requiredCoordinator", e.target.value)}/></L>
                    <L label="من الموجّه"><input type="number" min={0} className={input} value={draft.requiredSupervisor} onChange={e => set("requiredSupervisor", e.target.value)}/></L>
                    <L label="من النائب"><input type="number" min={0} className={input} value={draft.requiredDeputy} onChange={e => set("requiredDeputy", e.target.value)}/></L>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}حفظ
                </button>
                {saved && <span className="flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 className="w-4 h-4"/>حُفظت</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(["header", "footer"] as const).map(kind => {
                    const url = kind === "header" ? setup.settings.headerUrl : setup.settings.footerUrl;
                    return (
                        <div key={kind} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                            <p className="text-sm font-black text-slate-700">
                                {kind === "header" ? "رأس الاستمارة (الهيدر)" : "تذييل الاستمارة (الفوتر)"}
                            </p>
                            <p className="text-[11px] font-bold text-slate-500">
                                صورة الشريط الرسمي بعرض الصفحة. تسري على الزيارات التي تُعتمد بعد رفعها فقط.
                            </p>
                            {url ? <img src={url} alt="" className="w-full rounded-lg border border-slate-100"/> : (
                                <p className="text-xs font-bold text-slate-400">لم تُرفع صورة — تُستخدم ترويسة نصية بديلة.</p>
                            )}
                            <div className="flex gap-2">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-xs font-black text-slate-700 cursor-pointer hover:border-qatar-maroon">
                                    {uploading === kind ? <Loader2 className="w-4 h-4 animate-spin"/> : <ImageUp className="w-4 h-4"/>}
                                    رفع صورة
                                    <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) upload(kind, f); e.target.value = ""; }}/>
                                </label>
                                {url && (
                                    <button onClick={() => update(kind === "header" ? { headerImageId: null } : { footerImageId: null })}
                                        className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-rose-100 text-xs font-black text-rose-600">
                                        <Trash2 className="w-4 h-4"/>إزالة
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="block"><span className="block text-xs font-black text-slate-500 mb-1.5">{label}</span>{children}</label>;
}
