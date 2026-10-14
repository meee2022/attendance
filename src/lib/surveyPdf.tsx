import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

// Paginate the actual report. A question stays together; long lists are split
// into smaller sections before pagination so no text is cropped at an A4 edge.
export async function createSurveyPdf(content: ReactNode): Promise<Blob> {
    const [{toJpeg},{jsPDF}] = await Promise.all([import("html-to-image"),import("jspdf")]);
    const host=document.createElement("div");
    host.style.cssText="position:fixed;left:-15000px;top:0;width:794px;background:white;pointer-events:none;font-family:Tahoma,Arial,sans-serif";
    host.className="survey-analysis"; host.setAttribute("aria-hidden","true");
    document.body.appendChild(host); const root=createRoot(host);
    try {
        flushSync(()=>root.render(content)); await document.fonts.ready;
        const report=host.querySelector(".sv-report")!;
        const blocks: HTMLElement[]=[];
        for (const child of Array.from(report.children) as HTMLElement[]) {
            const list=child.querySelector(".sv-highlights ul, .sv-answers, .sv-bars") ?? (child.classList.contains("sv-highlights") ? child.querySelector("ul") : null);
            if(list && list.children.length>12) {
                const items=Array.from(list.children);
                for(let i=0;i<items.length;i+=12) {
                    const copy=child.cloneNode(true) as HTMLElement;
                    const target=copy.querySelector("ul, .sv-bars")!;
                    target.replaceChildren(...items.slice(i,i+12).map(x=>x.cloneNode(true)));
                    blocks.push(copy);
                }
            } else blocks.push(child.cloneNode(true) as HTMLElement);
        }
        root.unmount(); host.replaceChildren();
        const pages: HTMLElement[]=[];
        let page: HTMLElement;
        const newPage=()=>{page=document.createElement("div");page.dir="rtl";page.style.cssText="width:794px;height:1123px;padding:44px;box-sizing:border-box;background:white;display:block;font-family:Tahoma,Arial,sans-serif";host.appendChild(page);pages.push(page);};
        newPage();
        for(const block of blocks) {
            block.style.marginBottom="14px";
            page!.appendChild(block);
            if(page!.scrollHeight>1123) {
                block.remove(); newPage(); page!.appendChild(block);
                if(page!.scrollHeight>1123) throw new Error("أحد الأسئلة طويل جدًا لتصديره؛ قلّل طول النص قبل تنزيل التقرير.");
            }
        }
        const pdf=new jsPDF({unit:"mm",format:"a4",compress:true});
        for(const [i,p] of pages.entries()) {
            const png=await toJpeg(p,{pixelRatio:1.5,quality:0.9,backgroundColor:"#fff",skipFonts:true});
            if(i)pdf.addPage();pdf.addImage(png,"JPEG",0,0,210,297,undefined,"FAST");
            pdf.setFontSize(9);pdf.text(`${i+1} / ${pages.length}`,105,292,{align:"center"});
        }
        return pdf.output("blob");
    } finally { host.remove(); }
}
