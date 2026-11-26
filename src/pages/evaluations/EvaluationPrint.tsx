import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSupervisionQuery as useQuery, SupervisionBoundary } from "../../lib/supervisionSession";
import { api } from "../../../convex/_generated/api";
import { FORM_PAGE_CSS, prepareOfficialForm } from "../visits/VisitFormPrint";
import EvaluationPages from "./EvaluationFormPrint";

// The printed appraisal forms: one teacher's (/print/<teacherId>) or a whole
// department's in one file (/print/department?d=…), as the Word files were kept.
// ?v=coordinator prints the coordinator's version as sent, before the deputy's
// review; ?download saves the PDF as soon as the forms are ready.
// The server returns only the forms this visitor may see.

export default function EvaluationPrint() { return <SupervisionBoundary><Content/></SupervisionBoundary>; }

function Content() {
    const { key } = useParams();
    const [params] = useSearchParams();
    const department = key === "department" ? params.get("d") ?? "" : "";
    const version = params.get("v") === "coordinator" ? "coordinator" as const : undefined;
    const forms = useQuery((api as any).teacherEvaluations.printForms, { ...(department ? { department } : { teacherId: key }), ...(version ? { version } : {}) }) as any[] | undefined;
    const root = useRef<HTMLDivElement>(null);
    const started = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const name = department || forms?.[0]?.teacherName || "";
    const suffix = version ? " - نسخة المنسق" : "";
    useEffect(() => { if (name) document.title = `استمارة تقييم أداء المعلم - ${name}${suffix}`; }, [name, suffix]);

    const pages = (forms ?? []).map(f => <EvaluationPages key={f._id} form={f}/>);
    const download = async () => {
        if (busy) return;
        setBusy(true); setError("");
        try {
            const { createFormPdf } = await import("../../lib/visitPdf");
            const url = URL.createObjectURL(await createFormPdf(<div dir="rtl" className="vfp"><style>{FORM_PAGE_CSS}</style>{pages}</div>));
            const link = document.createElement("a");
            link.href = url;
            link.download = `استمارة تقييم أداء ${name}${suffix}.pdf`.replace(/[<>:"/\\|?*]/g, "-");
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch { setError("تعذّر تجهيز ملف PDF. تأكد من الاتصال ثم حاول مرة أخرى."); }
        finally { setBusy(false); }
    };
    useEffect(() => {
        if (forms?.length && params.has("download") && !started.current) { started.current = true; void download(); }
    });

    if (forms === undefined) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الاستمارة…</p>;
    if (!forms.length) return <p dir="rtl" className="p-10 text-center font-bold text-slate-500">{version ? "لا توجد نسخة منسق محفوظة لهذه الاستمارة." : "لا توجد استمارات تقييم محفوظة للطباعة."}</p>;

    const print = async () => {
        try { if (root.current) await prepareOfficialForm(root.current); window.print(); }
        catch { setError("تعذّر تحميل الاستمارة بالكامل. أعد المحاولة قبل الطباعة."); }
    };

    return (
        <div ref={root} dir="rtl" className="vfp">
            <style>{FORM_PAGE_CSS}</style>
            <div className="no-print p-3 flex gap-2 items-center justify-center flex-wrap">
                <button onClick={download} disabled={busy} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm disabled:opacity-60">
                    {busy ? "جاري تجهيز PDF…" : "تنزيل PDF"}
                </button>
                <button onClick={print} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">طباعة</button>
                <span className="text-xs font-bold text-slate-600">{forms.length > 1 ? `${forms.length} استمارة` : ""}</span>
                {version
                    ? <span className="text-xs font-bold text-slate-600">نسخة المنسق كما أرسلها، قبل مراجعة النائب الأكاديمي</span>
                    : forms.some(f => f.status !== "approved") && <span className="text-xs font-bold text-amber-700">فيها استمارات لم يعتمدها النائب الأكاديمي بعد</span>}
                {error && <p role="alert" className="w-full text-center text-sm text-red-700">{error}</p>}
            </div>
            {pages}
        </div>
    );
}
