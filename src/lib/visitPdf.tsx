import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { OfficialVisitForm } from "../pages/visits/VisitFormPrint";

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
        const sheet = host.querySelector<HTMLElement>(".sheet")!;
        for (const img of sheet.querySelectorAll("img")) {
            await img.decode(); // Fail visibly instead of archiving a form with a missing official image.
        }
        const width = sheet.offsetWidth, height = sheet.offsetHeight;
        const image = await toPng(sheet, { pixelRatio: 3, backgroundColor: "#ffffff", width, height,
            style: { margin: "0", boxShadow: "none", zoom: "1" } });
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        // Match the official print margins and keep the full form on one page.
        const scale = Math.min(186 / width, 285 / height);
        pdf.addImage(image, "PNG", 12, 6, width * scale, height * scale, undefined, "FAST");
        return pdf.output("blob");
    } finally { root.unmount(); host.remove(); }
}
