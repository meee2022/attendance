import { useState } from "react";
import { useMutation } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { previewScores, type ImportColumn, type ImportStudent } from "../lib/scoreImport";

type Props = { mode: "grades" | "diagnostics"; className: string; subjectName?: string; testId?: string; title: string; columns: ImportColumn[]; students: ImportStudent[] };
export default function ScoreExcelImport(props: Props) {
    const save = useMutation(api.scoreImports.save);
    const [open, setOpen] = useState(false);
    const [sheets, setSheets] = useState<Record<string, unknown[][]>>({});
    const [sheet, setSheet] = useState("");
    const [filename, setFilename] = useState("");
    const [header, setHeader] = useState(1);
    const [nameCol, setNameCol] = useState(-1);
    const [mapping, setMapping] = useState<Record<string, number>>({});
    const [preview, setPreview] = useState<ReturnType<typeof previewScores> | null>(null);
    const [overwrite, setOverwrite] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const grid = sheets[sheet] ?? [];
    const labels = grid[header - 1] ?? [];
    const reset = () => { setPreview(null); setConfirmed(false); setError(""); setMessage(""); };
    function detect(grid: unknown[][], row: number) {
        const cells = grid[row - 1] ?? [];
        setNameCol(cells.findIndex(v => /^(اسم الطالب|الاسم|student name|name)$/i.test(String(v ?? "").trim())));
        const map: Record<string, number> = {};
        for (const c of props.columns) map[c.key] = cells.findIndex(v => String(v ?? "").trim() === c.label);
        setMapping(map); reset();
    }
    async function load(file?: File) {
        if (!file) return;
        reset(); setSheets({}); setSheet(""); setFilename(""); setBusy(true);
        try {
            if (!/\.xlsx?$/i.test(file.name) || file.size > 8 * 1024 * 1024) throw new Error("اختر ملف Excel بصيغة XLSX أو XLS لا يتجاوز 8 ميجابايت.");
            const X = await import("xlsx");
            const book = X.read(await file.arrayBuffer(), { type: "array", cellDates: false });
            const result: Record<string, unknown[][]> = {};
            if (book.SheetNames.length > 40) throw new Error("الملف يحتوي على أوراق كثيرة؛ احتفظ بورقة الفصل المطلوب فقط.");
            for (const name of book.SheetNames) {
                const ws = book.Sheets[name];
                if (!ws["!ref"]) continue;
                const range = X.utils.decode_range(ws["!ref"]);
                if (range.e.r > 2000 || range.e.c > 250) throw new Error("الملف كبير؛ استخدم كشف الفصل فقط، بحد أقصى 2000 صف و250 عمودًا.");
                const rows: unknown[][] = X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: true, range: 0 });
                for (const [address, cell] of Object.entries(ws)) {
                    if (address.startsWith("!")) continue;
                    const c = cell as any;
                    if (c.t === "e" || c.f && c.v == null) { const pos = X.utils.decode_cell(address); if (rows[pos.r]) rows[pos.r][pos.c] = "خطأ أو معادلة بلا نتيجة محفوظة"; }
                }
                result[name] = rows;
            }
            const first = Object.keys(result)[0];
            if (!first) throw new Error("الملف لا يحتوي على بيانات.");
            setSheets(result); setSheet(first); setFilename(file.name); setHeader(1); detect(result[first], 1);
        } catch (e: any) { setError(e.message || "تعذّرت قراءة ملف Excel."); }
        finally { setBusy(false); }
    }
    async function template() {
        setBusy(true); setError("");
        try {
            const X = await import("xlsx"); const book = X.utils.book_new();
            const ws = X.utils.aoa_to_sheet([["اسم الطالب", ...props.columns.map(c => c.label)], ...props.students.map(s => [s.name, ...props.columns.map(() => "")])]);
            ws["!cols"] = [{ wch: 40 }, ...props.columns.map(() => ({ wch: 15 }))];
            X.utils.book_append_sheet(book, ws, "الدرجات");
            X.writeFile(book, `درجات-${props.className}-${props.mode}.xlsx`);
        } catch { setError("تعذّر تحميل القالب."); } finally { setBusy(false); }
    }
    async function submit() {
        if (!preview || preview.errors.length || !confirmed || busy) return;
        setBusy(true); setError("");
        try {
            const result = await save({ mode: props.mode, className: props.className, subjectName: props.subjectName, testId: props.testId as any, overwrite, rows: preview.rows.map(({ name, sourceRow, ...r }) => ({ ...r, studentId: r.studentId as any })) });
            setMessage(`تم حفظ ${result.changed} درجة، وتُركت ${result.skipped} درجة موجودة دون تغيير.`); setPreview(null); setConfirmed(false); setSheets({}); setSheet(""); setFilename("");
        } catch (e: any) { setError(e.message || "تعذّر الاستيراد. لم يُحفظ أي تغيير."); setConfirmed(false); }
        finally { setBusy(false); }
    }
    const select = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full";
    return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="text-sm font-bold">استيراد درجات من Excel</h2><button disabled={busy} onClick={() => setOpen(!open)} className="rounded-lg border border-qatar-maroon text-qatar-maroon px-3 py-2 text-sm">{open ? "إغلاق الاستيراد" : "استيراد Excel"}</button></div>
        {open && <div className="space-y-4">
            <p className="text-sm font-semibold text-qatar-maroon">{props.title} · الفصل <bdi>{props.className}</bdi></p>
            <p className="text-sm text-slate-600">حمّل قالب الفصل أو اختر ملفك وحدد أعمدته. طابق الأسماء مع القائمة؛ لا نعتمد ترتيب الصفوف. الخانات الفارغة لا تغيّر الدرجات. {props.mode === "diagnostics" ? "يلزم توزيع الدرجة على الأسئلة؛ المجموع وحده لا يكفي لتحليل المهارات." : "يمكن استخدام «غ» للغياب و«م» للمعذور."}</p>
            <div className="flex flex-wrap gap-3 items-center"><button disabled={busy} onClick={template} className="rounded-lg border px-3 py-2 text-sm">تحميل قالب بأسماء طلاب الفصل</button><label className="text-sm">اختر الملف<input aria-label="ملف درجات Excel" disabled={busy} type="file" accept=".xlsx,.xls" onChange={e => { void load(e.target.files?.[0]); e.target.value = ""; }} className="block mt-1"/></label></div>
            {sheet && <>
                <p className="text-sm text-slate-600">الملف المختار: <bdi>{filename}</bdi></p>
                <div className="grid sm:grid-cols-3 gap-3"><label className="text-sm">ورقة العمل<select className={select} value={sheet} onChange={e => { setSheet(e.target.value); setHeader(1); detect(sheets[e.target.value], 1); }}>{Object.keys(sheets).map(n => <option key={n}>{n}</option>)}</select></label>
                    <label className="text-sm">رقم صف العناوين<input className={select} type="number" min={1} max={grid.length} value={header} onChange={e => { const n = Math.max(1, Math.min(grid.length, Number(e.target.value) || 1)); setHeader(n); detect(grid, n); }}/></label>
                    <label className="text-sm">عمود اسم الطالب<select className={select} value={nameCol} onChange={e => { setNameCol(Number(e.target.value)); reset(); }}><option value={-1}>اختر العمود</option>{labels.map((l, i) => <option key={i} value={i}>عمود {i + 1}: {String(l || "بلا عنوان")}</option>)}</select></label></div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-72 overflow-auto">{props.columns.map(c => <label key={c.key} className="text-sm">{c.label} (من {c.max})<select className={select} value={mapping[c.key] ?? -1} onChange={e => { setMapping({ ...mapping, [c.key]: Number(e.target.value) }); reset(); }}><option value={-1}>لا تستورد هذا العمود</option>{labels.map((l, i) => <option key={i} value={i}>عمود {i + 1}: {String(l || "بلا عنوان")}</option>)}</select></label>)}</div>
                <button disabled={busy} onClick={() => { reset(); setPreview(previewScores(grid, header, nameCol, mapping, props.columns, props.students, props.mode === "diagnostics")); }} className="rounded-lg bg-qatar-maroon text-white px-4 py-2 text-sm">فحص الملف ومعاينة الدرجات</button>
            </>}
            {preview && <div className="space-y-3">
                {preview.errors.length > 0 && <div role="alert" className="rounded-lg bg-rose-50 text-rose-800 p-3 text-sm max-h-56 overflow-auto"><p className="font-bold">صحّح هذه الملاحظات قبل الحفظ ({preview.errors.length}):</p>{preview.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
                <p className="text-sm">المعاينة: {preview.rows.length} طالب · {preview.rows.reduce((n, r) => n + r.cells.length, 0)} درجة · {preview.rows.reduce((n, r) => n + r.cells.filter(c => c.expected !== null || r.expectedAbsent).length, 0)} خانة لها بيانات سابقة</p>
                <div className="max-h-72 overflow-auto border rounded-lg"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-right">الطالب</th><th className="p-2 text-right">الدرجات المراد استيرادها</th></tr></thead><tbody>{preview.rows.map(r => <tr key={r.studentId} className="border-t"><td className="p-2">{r.name}{r.expectedAbsent && <span className="block text-amber-800">مسجّل غائبًا حاليًا</span>}</td><td className="p-2">{r.cells.map(c => `${props.columns.find(x => x.key === c.key)?.label}: ${c.value === "absent" ? "غ" : c.value === "excused" ? "م" : c.value}${c.expected !== null ? ` (السابق: ${c.expected})` : ""}`).join("، ")}</td></tr>)}</tbody></table></div>
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={e => { setOverwrite(e.target.checked); setConfirmed(false); }}/>استبدال الدرجات الموجودة في الخانات المستوردة{props.mode === "diagnostics" ? " وتغيير الغائب إلى حاضر عند استيراد درجاته" : ""}</label>
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>راجعت الفصل والمادة والأسماء وتوزيع الأعمدة والدرجات في المعاينة.</label>
                <button disabled={busy || !confirmed || preview.errors.length > 0 || !preview.rows.length} onClick={submit} className="rounded-lg bg-qatar-maroon text-white px-4 py-2 text-sm disabled:opacity-40">{busy ? "جاري الحفظ…" : "تأكيد الاستيراد"}</button>
            </div>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        </div>}
    </section>;
}
