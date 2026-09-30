import type { Rating } from "../../convex/visitMath";
import type { PdfPage, VisitPdfDocument } from "./visitPdfLayout";
import { pdfHorizontalRules } from "./pdfTableGeometry";

export const normalizePdfText = (text: string) => text.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640\u200e\u200f]/g, "")
    .replace(/[٠-٩]/g, x => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/[إأآ]/g, "ا").replace(/\s+/g, " ").trim();

// Only unique exact names and explicitly labelled values are proposed. A tick
// in an unknown column must never become a score inferred from reading order.
export function proposeVisit(text: string, setup: { teachers: { _id: string; fullName: string }[]; visitors: { _id: string; fullName: string; role: string }[]; criteria: { _id: string; text: string }[] }) {
    const normalized = normalizePdfText(text);
    const uniqueName = (rows: { _id: string; fullName: string }[]) => {
        const matches = rows.filter(x => (` ${normalized} `).includes(` ${normalizePdfText(x.fullName)} `));
        return matches.length === 1 ? matches[0]._id : "";
    };
    const dates = [...normalized.matchAll(/(?:تاريخ الزيارة|تاريخ الحضور|التاريخ)\s*[:：]?\s*(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})/g)].map(m => {
        const y = m[1].length === 4 ? +m[1] : +m[3], month = +m[2], d = m[1].length === 4 ? +m[3] : +m[1];
        const date = new Date(Date.UTC(y, month - 1, d));
        return y >= 2000 && date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 && date.getUTCDate() === d ? `${y}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}` : "";
    }).filter(Boolean);
    const ratings: Record<string, Rating> = {};
    const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const c of setup.criteria) {
        const matches = [...normalized.matchAll(new RegExp(`${escape(normalizePdfText(c.text))}\\s*(?:[:：]\\s*)?(?:التقدير|الدرجة)\\s*[:：]?\\s*(لم يتم قياسه|[0-3](?![0-9]))`, "g"))];
        if (matches.length === 1) ratings[c._id] = matches[0][1] === "لم يتم قياسه" ? "not_measured" : +matches[0][1] as Rating;
    }
    const field = (label: string) => {
        const rows = text.split(/\r?\n/).filter(line => normalizePdfText(line).startsWith(normalizePdfText(label) + ":"));
        return rows.length === 1 ? rows[0].slice(rows[0].indexOf(":") + 1).trim() : "";
    };
    return { teacherId: uniqueName(setup.teachers), supervisorId: uniqueName(setup.visitors.filter(v => v.role === "supervisor")), visitDate: new Set(dates).size === 1 ? dates[0] : "", ratings,
        subjectName: field("المادة"), lessonTopic: field("موضوع الدرس"), planningRec: field("توصيات التخطيط"), executionRec: field("توصيات تنفيذ الدرس"), evalMgmtRec: field("توصيات التقويم"), managementRec: field("توصيات الإدارة الصفية"), notes: "" };
}

export async function readVisitPdf(file: File) {
    return (await readVisitPdfDocument(file)).text;
}

export async function readVisitPdfDocument(file: File): Promise<VisitPdfDocument> {
    if (file.size > 6 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 6 ميجابايت. صدّره من Word بحجم أصغر.");
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("اختر ملف PDF صحيحاً.");
    const pdfjs = await import("pdfjs-dist");
    const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const task = pdfjs.getDocument({ data: bytes });
    try {
        const doc = await task.promise;
        if (doc.numPages > 20) throw new Error("اختر ملف زيارة واحدة بحد أقصى 20 صفحة.");
        const pages: string[] = [];
        const layout: PdfPage[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n), content = await page.getTextContent();
            const viewport = page.getViewport({scale:1});
            const pieces: PdfPage["pieces"] = [];
            const lines: { y: number; pieces: { x: number; str: string }[] }[] = [];
            for (const item of content.items) {
                if (!("str" in item)) continue;
                pieces.push({text:item.str,x:item.transform[4],y:viewport.height-item.transform[5]-item.height/2,width:item.width,height:item.height,rotated:Math.abs(item.transform[1])>Math.abs(item.transform[0])});
                let line = lines.find(l => Math.abs(l.y - item.transform[5]) < 3);
                if (!line) { line = { y: item.transform[5], pieces: [] }; lines.push(line); }
                line.pieces.push({ x: item.transform[4], str: item.str });
            }
            pages.push(lines.sort((a,b) => b.y-a.y).map(l => l.pieces.sort((a,b) => b.x-a.x).map(p => p.str).join(" ")).join("\n"));
            const rules=pdfHorizontalRules(await page.getOperatorList(),pdfjs.OPS,viewport.height);
            layout.push({width:viewport.width,height:viewport.height,pieces,rules});
        }
        return { text: pages.join("\n\n"), pages: layout };
    } finally { await task.destroy(); }
}
