import { useEffect, useState } from "react";
import { useMutation } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";

export default function DiagnosticMarks({ test }: { test: any }) {
    const save = useMutation(api.diagnostics.configureMarks);
    const [open, setOpen] = useState(false);
    const [marks, setMarks] = useState<{ n: number; maxMark: number }[]>([]);
    const [target, setTarget] = useState(20);
    const [expected, setExpected] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    useEffect(() => { setOpen(false); setMessage(""); setError(""); }, [test._id]);
    const total = Math.round(marks.reduce((s, q) => s + q.maxMark, 0) * 100) / 100;
    const valid = Number.isFinite(target) && target > 0 && marks.length > 0 && marks.every(q => Number.isFinite(q.maxMark) && q.maxMark > 0) && Math.abs(total - target) < 0.001;
    function start() {
        setMarks(test.questions.map((q: any) => ({ n: q.n, maxMark: q.maxMark })));
        setTarget(test.totalMarks || 20); setExpected(JSON.stringify(test.questions));
        setMessage(""); setError(""); setOpen(true);
    }
    function distribute() {
        const units = Math.round(target * 100);
        if (!Number.isFinite(units) || units < marks.length || !marks.length) return;
        const base = Math.floor(units / marks.length), rest = units % marks.length;
        setMarks(marks.map((q, i) => ({ ...q, maxMark: (base + (i < rest ? 1 : 0)) / 100 })));
    }
    async function submit() {
        if (!valid || busy) return;
        setBusy(true); setError("");
        try { await save({ testId: test._id, expectedQuestions: expected, marks }); setOpen(false); setMessage("تم حفظ الدرجة النهائية وتوزيع الأسئلة."); }
        catch (e: any) { setError(e.message || "تعذّر الحفظ."); }
        finally { setBusy(false); }
    }
    return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label="الدرجة النهائية للاختبار">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold text-slate-800">الدرجة النهائية: {test.totalMarks}</h2><p className="text-sm text-slate-600">حدد درجة الاختبار وتوزيعها قبل بدء الرصد. التحليل يُحسب بالنسبة المئوية.</p></div>
            <button onClick={start} disabled={busy || !test.questions.length || !test.isActive} className="rounded-lg border border-qatar-maroon px-3 py-2 text-sm text-qatar-maroon disabled:opacity-40">تحديد الدرجة النهائية</button>
        </div>
        {open && <div className="space-y-3 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">هذا الإعداد يطبق على جميع فصول الاختبار. راجع درجة كل سؤال؛ لن تتغير درجات الطلاب المسجلة.</p>
            <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">الدرجة النهائية المطلوبة<input aria-label="الدرجة النهائية المطلوبة" type="number" min="0.01" step="0.01" value={target || ""} onChange={e => setTarget(Number(e.target.value))} className="block w-32 rounded-lg border border-slate-300 px-3 py-2"/></label>
                {[20, 50, 100].map(n => <button key={n} onClick={() => setTarget(n)} className="rounded-lg border px-3 py-2 text-sm">{n}</button>)}
                <button onClick={distribute} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">توزيع بالتساوي على الأسئلة</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-auto">
                {marks.map((q, i) => <label key={q.n} className="text-sm">سؤال {q.n}{test.questions[i]?.subjectName && <span className="block text-xs text-slate-500">{test.questions[i].subjectName}</span>}
                    <input aria-label={`درجة السؤال ${q.n}`} type="number" min="0.01" step="0.01" value={q.maxMark || ""} onChange={e => setMarks(marks.map(x => x.n === q.n ? { ...x, maxMark: Number(e.target.value) } : x))} className="block w-full rounded-lg border border-slate-300 px-3 py-2"/>
                </label>)}
            </div>
            <p className={`text-sm ${valid ? "text-slate-600" : "text-amber-800"}`}>مجموع درجات الأسئلة: {total} من {target} {valid ? "" : "— يجب أن يساوي الدرجة المطلوبة."}</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2"><button disabled={!valid || busy} onClick={submit} className="rounded-lg bg-qatar-maroon text-white px-4 py-2 text-sm disabled:opacity-40">{busy ? "جاري الحفظ…" : "حفظ التوزيع"}</button><button disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button></div>
        </div>}
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    </section>;
}
