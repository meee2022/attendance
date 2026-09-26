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
        const pages = [...host.querySelectorAll<HTMLElement>(".form-page")];
        for (const img of host.querySelectorAll("img")) {
            await img.decode(); // Fail visibly instead of archiving a form with a missing official page.
        }
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        for (const [i, page] of pages.entries()) {
            const image = await toPng(page, { pixelRatio: 3, backgroundColor: "#ffffff",
                width: page.offsetWidth, height: page.offsetHeight, style: { margin: "0", boxShadow: "none" } });
            if (i > 0) pdf.addPage("a4", "portrait");
            // Each page of the ministry form fills an A4 sheet, as it does when printed.
            pdf.addImage(image, "PNG", 0, 0, 210, 297, undefined, "FAST");
        }
        return pdf.output("blob");
    } finally { root.unmount(); host.remove(); }
}
