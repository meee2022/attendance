import { useEffect, useRef, useState } from "react";

export default function ImportPdfPreview({ file }: { file: File }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [page, setPage] = useState(1), [pages, setPages] = useState(1), [error, setError] = useState("");
    useEffect(() => {
        let cancelled = false;
        let dispose: (() => void) | undefined;
        void (async () => {
            try {
                const pdfjs = await import("pdfjs-dist");
                const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
                if (cancelled) return;
                pdfjs.GlobalWorkerOptions.workerSrc = worker;
                const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
                dispose = () => { void task.destroy(); };
                if (cancelled) { dispose(); return; }
                const pdf = await task.promise;
                if (cancelled) return;
                setPages(pdf.numPages);
                const current = await pdf.getPage(page);
                if (cancelled || !canvas.current) return;
                const viewport = current.getViewport({ scale: 1.4 });
                canvas.current.width = viewport.width; canvas.current.height = viewport.height;
                await current.render({ canvas: canvas.current, viewport }).promise;
            } catch { if (!cancelled) setError("تعذرت المعاينة هنا. افتح الأصل من الرابط أعلاه للمراجعة."); }
        })();
        return () => { cancelled = true; dispose?.(); };
    }, [file, page]);
    return <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-2 bg-slate-50 text-xs"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 disabled:opacity-40">السابقة</button><span>صفحة {page} من {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-2 disabled:opacity-40">التالية</button></div>
        {error ? <p role="alert" className="p-4 text-sm">{error}</p> : <div className="max-h-[560px] overflow-auto"><canvas ref={canvas} role="img" aria-label={`معاينة الصفحة ${page} من ملف الموجه`} className="w-full h-auto"/></div>}
    </div>;
}
