import { describe, expect, it, vi } from "vitest";
import { archiveSegment, visitArchivePath, writeVisitPdf } from "../src/lib/visitArchive";

const data = { form: { academicYear: "2026 / 2027" }, visit: { _id: "visit1", teacherId: "teacher1", teacherName: "معلم اختبار", teacherDepartment: "العلوم", visitDate: "2026-09-25", visitorRole: "supervisor", updatedAt: 12, status: "submitted" } };
function directory(permission = "granted") {
    const files = new Map<string, Blob>();
    function node(path: string): any { return {
        queryPermission: async () => permission,
        getDirectoryHandle: async (name: string) => node(`${path}/${name}`),
        getFileHandle: async (name: string, options?: { create?: boolean }) => {
            const key = `${path}/${name}`;
            if (!options?.create && !files.has(key)) throw new DOMException("missing", "NotFoundError");
            return { getFile: async () => files.get(key), createWritable: async () => {
                let content: Blob;
                return { write: async (b: Blob) => { content = b; }, close: async () => { files.set(key, content); }, abort: async () => {} };
            } };
        },
    }; }
    return { root: node(""), files };
}
describe("local visit archive", () => {
    it("sanitizes Windows paths and uses the official visit's department", () => {
        expect(archiveSegment("../CON: test/")).not.toMatch(/[\\/:]/);
        expect(archiveSegment("CON")).toBe("_CON");
        expect(visitArchivePath(data)[2]).toBe("العلوم");
    });
    it("writes once per revision and preserves older revisions", async () => {
        const { root, files } = directory();
        const pdf = vi.fn(async () => new Blob(["%PDF-test"]));
        await writeVisitPdf(root, data, pdf);
        await writeVisitPdf(root, data, pdf);
        expect(pdf).toHaveBeenCalledTimes(1);
        await writeVisitPdf(root, { ...data, visit: { ...data.visit, updatedAt: 13 } }, pdf);
        expect(files.size).toBe(2);
    });
    it("never writes without permission or archives drafts", async () => {
        const pdf = vi.fn(async () => new Blob());
        await expect(writeVisitPdf(directory("denied").root, data, pdf)).rejects.toThrow("إذن");
        await expect(writeVisitPdf(directory().root, { ...data, visit: { ...data.visit, status: "draft" } }, pdf)).rejects.toThrow("المعتمدة");
        expect(pdf).not.toHaveBeenCalled();
    });
});
