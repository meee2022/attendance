import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { api } from "../../convex/_generated/api";

// What a guardian opens from their link: their son's teachers' view, gathered
// across all subjects, in the school's colours. Read-only, no sign-in.

const LEVELS: Record<number, string> = { 5: "ممتاز", 4: "جيد جداً", 3: "جيد", 2: "مقبول", 1: "ضعيف" };
const DISTRACTION: Record<string, string> = { no: "لا", sometimes: "أحياناً", yes: "نعم" };
const tone = (n: number | null) => n == null ? "bg-slate-100 text-slate-500" : n >= 4 ? "bg-emerald-50 text-emerald-800" : n === 3 ? "bg-slate-100 text-slate-700" : "bg-rose-50 text-rose-800";
const distractionTone = (d: string | null) => d === "yes" ? "bg-rose-50 text-rose-800" : d === "sometimes" ? "bg-amber-50 text-amber-800" : d === "no" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500";

export default function GuardianReport() {
    const token = window.location.hash.slice(1);
    const data = useQuery((api as any).guardianReports.report, { token }) as any;
    const opened = useMutation((api as any).guardianReports.opened);
    useEffect(() => { if (data) void opened({ token }).catch(() => {}); }, [Boolean(data)]); // eslint-disable-line react-hooks/exhaustive-deps
    if (data === undefined) return <p dir="rtl" className="p-10 text-center text-slate-600">جاري تحميل التقرير…</p>;
    if (!data) return <p dir="rtl" className="p-10 text-center text-slate-600">الرابط غير صالح أو انتهت صلاحيته، أو لم يُنشر التقرير بعد. تواصل مع المدرسة.</p>;
    return <ReportView data={data}/>;
}

export function ReportView({ data }: { data: any }) {

    const subjects: any[] = data.subjects;
    const strong = subjects.filter(s => s.academic >= 4).map(s => s.subject);
    const weak = subjects.filter(s => (s.academic != null && s.academic <= 2) || (s.behavior != null && s.behavior <= 2)).map(s => s.subject);
    const distracted = subjects.filter(s => s.distraction === "yes").map(s => s.subject);

    return <main dir="rtl" className="min-h-screen bg-[#f5f2ed] py-6 px-4 print:bg-white print:p-0">
        <style>{`@media print { .no-print { display:none } @page { size: A4; margin: 12mm } }`}</style>
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
            <header className="px-5 sm:px-8 py-5 text-white flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4" style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)" }}>
                <img src="/forms/moe-logo.png" alt="وزارة التربية والتعليم والتعليم العالي" className="h-10 sm:h-12 self-start sm:self-auto bg-white rounded-lg p-1.5 shrink-0"/>
                <div className="min-w-0">
                    <p className="text-xs text-white/75">{data.school}</p>
                    <h1 className="text-lg sm:text-xl font-bold leading-snug">{data.title}</h1>
                </div>
            </header>
            <div className="px-5 sm:px-8 py-5 space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#ad8f50]/40 pb-3">
                    <p className="text-lg font-bold text-slate-900">{data.studentName}</p>
                    <p className="text-sm text-slate-500">الشعبة {data.className} · عدد المواد {subjects.length}</p>
                </div>

                {subjects.length > 0 && <section className="rounded-xl bg-[#f5f2ed] p-4 space-y-1.5 text-sm leading-relaxed">
                    <h2 className="font-bold text-[#5C1523]">الخلاصة</h2>
                    {strong.length > 0 && <p>مستوى متميز (ممتاز أو جيد جداً) في: <b>{strong.join("، ")}</b></p>}
                    {weak.length > 0 && <p className="text-rose-800">يحتاج متابعة في: <b>{weak.join("، ")}</b></p>}
                    {distracted.length > 0 && <p className="text-rose-800">لاحظ معلمو هذه المواد مشتتات داخل الصف: <b>{distracted.join("، ")}</b></p>}
                    {!weak.length && !distracted.length && <p className="text-emerald-800">لا توجد ملاحظات تستدعي القلق — بارك الله فيه.</p>}
                </section>}

                {subjects.length ? <ul className="space-y-3">
                    {subjects.map(s => <li key={s.subject} className="rounded-xl border border-slate-200 p-4 space-y-3 break-inside-avoid">
                        <h3 className="font-bold text-slate-900">{s.subject}</h3>
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                            <span className={`px-2.5 py-1 rounded-full ${tone(s.academic)}`}>المستوى الأكاديمي: {LEVELS[s.academic] ?? "—"}</span>
                            <span className={`px-2.5 py-1 rounded-full ${tone(s.behavior)}`}>السلوك: {LEVELS[s.behavior] ?? "—"}</span>
                            <span className={`px-2.5 py-1 rounded-full ${distractionTone(s.distraction)}`}>مشتتات داخل الصف: {DISTRACTION[s.distraction] ?? "—"}</span>
                        </div>
                        {s.advice && <p className="text-sm leading-relaxed text-slate-700 border-r-2 border-[#ad8f50] pr-3"><b className="text-[#5C1523]">نصيحة المعلم: </b>{s.advice}</p>}
                    </li>)}
                </ul> : <p className="text-center text-slate-500 py-6">لم تُسجَّل آراء المعلمين لهذا الطالب بعد.</p>}

                <p className="text-xs text-slate-500 leading-relaxed">هذا التقرير خاص بولي أمر الطالب. للاستفسار يُرجى التواصل مع إدارة المدرسة.</p>
                <button onClick={() => window.print()} className="no-print inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-[#5C1523] text-[#5C1523] text-sm font-bold">
                    <Printer className="w-4 h-4"/>طباعة التقرير</button>
            </div>
        </div>
    </main>;
}
