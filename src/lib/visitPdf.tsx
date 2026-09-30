import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { OfficialVisitForm, prepareOfficialForm } from "../pages/visits/VisitFormPrint";

// Render the existing official form, rather than maintaining a second PDF template.
export async function createVisitPdf(data: any): Promise<Blob> {
    const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-15000px;top:0;width:1200px;background:white;pointer-events:none;";
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
        flushSync(() => root.render(<OfficialVisitForm data={data} toolbar={false}/>));
        await document.fonts.ready;
        const pages = [...host.querySelectorAll<HTMLElement>(".form-page")];
        for (const img of host.querySelectorAll("img")) {
            await withTimeout(img.decode(), 30_000, "تحميل صور الاستمارة"); // Fail visibly instead of archiving a form with a missing official page.
        }
        await withTimeout(prepareOfficialForm(host), 30_000, "ضبط النص وحجم الصفحة");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        for (const [i, page] of pages.entries()) {
            // skipFonts: the form's own text is drawn as shapes and the visit's in a
            // system font, so the site's web fonts need not be fetched and embedded
            const image = await withTimeout(toPng(page, { pixelRatio: 3, backgroundColor: "#ffffff", skipFonts: true,
                width: page.offsetWidth, height: page.offsetHeight, style: { margin: "0", boxShadow: "none" } }), 90_000, "تجهيز صورة الاستمارة");
            if (i > 0) pdf.addPage("a4", "portrait");
            // Each page of the ministry form fills an A4 sheet, as it does when printed.
            pdf.addImage(image, "PNG", 0, 0, 210, 297, undefined, "FAST");
        }
        return pdf.output("blob");
    } finally { root.unmount(); host.remove(); }
}

// A step that never settles would leave an empty archive folder and no message
function withTimeout<T>(work: Promise<T>, ms: number, step: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`انتهت مهلة ${step}`)), ms);
        work.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
    });
}
