import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// A signature drawn with a finger, a pen or the mouse. What is kept is a small
// transparent PNG cropped to the ink, so it sits in the form's signature cell
// the way an uploaded signature does.

export type SignaturePadHandle = { toBlob: () => Promise<Blob | null>; clear: () => void };

const W = 900, H = 300, INK = "#14285a";

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (drawn: boolean) => void; hint?: string }>(
    function SignaturePad({ onChange, hint = "وقّع هنا بالإصبع أو القلم أو الفأرة" }, ref) {
        const canvas = useRef<HTMLCanvasElement>(null);
        const last = useRef<{ x: number; y: number } | null>(null);
        const box = useRef({ x0: W, y0: H, x1: 0, y1: 0 });
        const [drawn, setDrawn] = useState(false);

        const point = (e: React.PointerEvent) => {
            const r = canvas.current!.getBoundingClientRect();
            return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
        };
        const grow = (p: { x: number; y: number }) => {
            const b = box.current;
            b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y);
            b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y);
        };
        const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
            const ctx = canvas.current!.getContext("2d")!;
            ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath();
            if (from.x === to.x && from.y === to.y) { ctx.arc(to.x, to.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
            grow(to);
        };
        const clear = () => {
            canvas.current?.getContext("2d")?.clearRect(0, 0, W, H);
            box.current = { x0: W, y0: H, x1: 0, y1: 0 };
            last.current = null;
            setDrawn(false); onChange?.(false);
        };

        useImperativeHandle(ref, () => ({
            clear,
            toBlob: async () => {
                if (!canvas.current || !drawn) return null;
                const b = box.current, pad = 12;
                const x = Math.max(0, b.x0 - pad), y = Math.max(0, b.y0 - pad);
                const w = Math.min(W, b.x1 + pad) - x, h = Math.min(H, b.y1 + pad) - y;
                const out = document.createElement("canvas");
                out.width = Math.max(1, Math.round(w)); out.height = Math.max(1, Math.round(h));
                out.getContext("2d")!.drawImage(canvas.current, x, y, w, h, 0, 0, out.width, out.height);
                return new Promise<Blob | null>(resolve => out.toBlob(resolve, "image/png"));
            },
        }));

        return (
            <div className="space-y-1.5">
                <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
                    <canvas ref={canvas} width={W} height={H} aria-label="لوحة التوقيع"
                        className="block w-full cursor-crosshair" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
                        onPointerDown={e => {
                            e.preventDefault();
                            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the stroke still follows inside the pad */ }
                            const p = point(e); last.current = p; stroke(p, p);
                            if (!drawn) { setDrawn(true); onChange?.(true); }
                        }}
                        onPointerMove={e => { if (!last.current) return; const p = point(e); stroke(last.current, p); last.current = p; }}
                        onPointerUp={() => { last.current = null; }}
                        onPointerCancel={() => { last.current = null; }}/>
                    {!drawn && <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-300 pointer-events-none">{hint}</p>}
                    <span className="absolute bottom-[22%] inset-x-8 border-b border-slate-200 pointer-events-none"/>
                </div>
                <button type="button" onClick={clear} disabled={!drawn}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 disabled:opacity-40 hover:text-qatar-maroon">
                    <Eraser className="w-3.5 h-3.5"/>مسح وإعادة التوقيع
                </button>
            </div>
        );
    });
