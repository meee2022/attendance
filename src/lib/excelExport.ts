// Styled .xlsx writer shared by every "save a copy" button. The SheetJS
// community build cannot write cell styles, so a sheet that reads like the
// school's own forms — right-to-left, a coloured header, borders, frozen names,
// landscape on one page — needs exceljs. It is loaded only when a teacher
// actually exports, so it never weighs on the normal page load.

export type ExcelCell = string | number | null | undefined;

export type ExcelTone = "good" | "warn" | "bad" | "muted";

export type ExcelColumn = {
    header: string;
    width?: number;
    align?: "right" | "center";
    bold?: boolean;
    numFmt?: string;
};

export type ExcelBandSegment = { label: string; span: number };

export type ExcelSheetSpec = {
    name: string;
    title: string;
    meta?: string[];
    // Extra header rows above the column headers (skill or subject bands)
    bands?: ExcelBandSegment[][];
    columns: ExcelColumn[];
    rows: ExcelCell[][];
    freezeColumns?: number;
    orientation?: "portrait" | "landscape";
    tone?: (row: ExcelCell[], columnIndex: number) => ExcelTone | undefined;
    notes?: string[];
    signatures?: string[];
};

export const SIGNATURE_LINES = ["معلم المادة", "منسق المادة", "النائب الأكاديمي"];

const FONT = "Arial";
const MAROON = "FF5C1523";
const MAROON_SOFT = "FFFBE9EC";
const ZEBRA = "FFF8FAFC";
const LINE = { style: "thin", color: { argb: "FFCBD5E1" } };

const TONES: Record<ExcelTone, { fill: string; font: string }> = {
    good:  { fill: "FFD1FAE5", font: "FF047857" },
    warn:  { fill: "FFFEF3C7", font: "FFB45309" },
    bad:   { fill: "FFFEE2E2", font: "FFB91C1C" },
    muted: { fill: "FFF1F5F9", font: "FF64748B" },
};

export function safeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

// Excel rejects \ / ? * [ ] : in sheet names, caps them at 31 characters and
// refuses duplicates.
function uniqueSheetName(raw: string, used: Set<string>): string {
    const base = raw.replace(/[\\/?*[\]:]/g, "-").trim().slice(0, 31) || "ورقة";
    let name = base;
    for (let i = 2; used.has(name); i++) {
        const suffix = ` (${i})`;
        name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name);
    return name;
}

function box(cell: any) {
    cell.border = { top: LINE, bottom: LINE, left: LINE, right: LINE };
}

// Builds the workbook without touching the DOM, so it can be produced and
// checked outside the browser as well.
export async function buildWorkbook(sheets: ExcelSheetSpec[]): Promise<any> {
    const mod: any = await import("exceljs");
    const ExcelJS = mod.default ?? mod;

    const wb = new ExcelJS.Workbook();
    wb.creator = "مدرسة ابن تيمية الثانوية للبنين";
    wb.created = new Date();
    const used = new Set<string>();

    for (const spec of sheets) {
        const width = spec.columns.length;
        const ws = wb.addWorksheet(uniqueSheetName(spec.name, used), {
            views: [{ rightToLeft: true }],
            pageSetup: {
                paperSize: 9,
                orientation: spec.orientation ?? "landscape",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                horizontalCentered: true,
                margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
            },
        });
        ws.headerFooter.oddFooter = "&Cصفحة &P من &N";
        ws.columns = spec.columns.map(c => ({ width: c.width ?? 12 }));

        let r = 1;
        const fullRow = (value: string, font: any, height?: number) => {
            if (width > 1) ws.mergeCells(r, 1, r, width);
            const cell = ws.getCell(r, 1);
            cell.value = value;
            cell.font = font;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            if (height) ws.getRow(r).height = height;
            r++;
        };

        fullRow(spec.title, { name: FONT, size: 15, bold: true, color: { argb: MAROON } }, 30);
        for (const line of spec.meta ?? []) {
            fullRow(line, { name: FONT, size: 10, bold: true, color: { argb: "FF475569" } }, 18);
        }
        r++;

        const headerStart = r;
        for (const band of spec.bands ?? []) {
            let col = 1;
            for (const seg of band) {
                if (seg.span <= 0 || col > width) continue;
                const end = Math.min(col + seg.span - 1, width);
                if (end > col) ws.mergeCells(r, col, r, end);
                ws.getCell(r, col).value = seg.label;
                for (let k = col; k <= end; k++) {
                    const cell = ws.getCell(r, k);
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: seg.label ? MAROON_SOFT : "FFFFFFFF" } };
                    cell.font = { name: FONT, size: 9, bold: true, color: { argb: MAROON } };
                    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                    box(cell);
                }
                col = end + 1;
            }
            ws.getRow(r).height = 22;
            r++;
        }

        const header = ws.getRow(r);
        spec.columns.forEach((c, i) => {
            const cell = header.getCell(i + 1);
            cell.value = c.header;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAROON } };
            cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            box(cell);
        });
        header.height = 34;
        const headerEnd = r;
        r++;

        spec.rows.forEach((row, rowIndex) => {
            const line = ws.getRow(r);
            spec.columns.forEach((c, i) => {
                const value = row[i];
                const cell = line.getCell(i + 1);
                cell.value = value === undefined || value === "" ? null : value;
                if (typeof value === "number" && c.numFmt) cell.numFmt = c.numFmt;

                const tone = spec.tone?.(row, i);
                const fill = tone ? TONES[tone].fill : rowIndex % 2 === 1 ? ZEBRA : undefined;
                if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
                cell.font = {
                    name: FONT,
                    size: 10,
                    bold: Boolean(c.bold || (tone && tone !== "muted")),
                    color: { argb: tone ? TONES[tone].font : "FF1E293B" },
                };
                cell.alignment = { horizontal: c.align ?? "right", vertical: "middle", wrapText: true };
                box(cell);
            });
            line.height = 20;
            r++;
        });

        if (spec.rows.length === 0) {
            fullRow("لا توجد بيانات", { name: FONT, size: 10, italic: true, color: { argb: "FF94A3B8" } });
        }

        if (spec.notes?.length) {
            r++;
            for (const note of spec.notes) {
                fullRow(note, { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } });
            }
        }

        const signatures = spec.signatures ?? [];
        if (signatures.length) {
            r += 2;
            const segment = Math.max(1, Math.floor(width / signatures.length));
            signatures.forEach((label, k) => {
                const start = k * segment + 1;
                if (start > width) return;
                const end = k === signatures.length - 1 ? width : start + segment - 1;
                if (end > start) ws.mergeCells(r, start, r, end);
                const cell = ws.getCell(r, start);
                cell.value = `${label}\n\n..............................`;
                cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FF334155" } };
                cell.alignment = { horizontal: "center", vertical: "top", wrapText: true };
            });
            ws.getRow(r).height = 54;
        }

        // Names stay visible while scrolling across, headers while scrolling down,
        // and the header rows repeat on every printed page.
        ws.views = [{
            rightToLeft: true,
            state: "frozen",
            xSplit: spec.freezeColumns ?? 0,
            ySplit: headerEnd,
        }];
        ws.pageSetup.printTitlesRow = `${headerStart}:${headerEnd}`;
    }

    return wb;
}

export async function downloadWorkbook(fileName: string, sheets: ExcelSheetSpec[]): Promise<void> {
    const wb = await buildWorkbook(sheets);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
