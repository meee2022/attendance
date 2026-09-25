export function archiveSegment(value: unknown, fallback = "غير محدد") {
    let name = String(value ?? "").normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/g, "").trim().slice(0, 80).replace(/[. ]+$/g, "");
    if (!name || /^\.+$/.test(name)) name = fallback;
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
    return name;
}

export function visitArchivePath(data: any) {
    const v = data.visit;
    return ["أرشيف الزيارات", archiveSegment(data.form.academicYear).slice(0, 24), archiveSegment(v.teacherDepartment ?? v.department).slice(0, 40),
        `${archiveSegment(v.teacherName).slice(0, 36)} - ${archiveSegment(v.teacherId).slice(-12)}`,
        `${archiveSegment(v.visitDate)} - ${archiveSegment(({ coordinator: "منسق", supervisor: "موجه", deputy: "نائب" } as Record<string, string>)[v.visitorRole] ?? v.visitorRole)} - ${archiveSegment(v._id)} - ${archiveSegment(v.updatedAt)}.pdf`];
}

export type ArchiveDirectory = FileSystemDirectoryHandle & {
    queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
    requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};
export type ArchiveConfig = { directory: ArchiveDirectory; enabled: boolean };
export function supportsVisitArchive() { return "showDirectoryPicker" in window; }
export async function chooseArchiveDirectory(): Promise<ArchiveDirectory> {
    return (window as any).showDirectoryPicker({ id: "school-visit-archive", mode: "readwrite" });
}

async function database() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("school-visit-archive", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("settings");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function archiveConfig(key: string, value?: ArchiveConfig | null): Promise<ArchiveConfig | undefined> {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction("settings", value === undefined ? "readonly" : "readwrite");
            const store = tx.objectStore("settings");
            const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(value, key);
            tx.oncomplete = () => resolve(value === undefined ? request.result : value ?? undefined);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error ?? new Error("تعذّر حفظ إعداد الأرشيف"));
        });
    } finally { db.close(); }
}

// A single revision has a single file. Other revisions and unrelated files are never replaced.
export async function writeVisitPdf(directory: ArchiveDirectory, data: any, makePdf: () => Promise<Blob>) {
    if (data.visit.status !== "submitted") throw new Error("الأرشيف مخصص للزيارات المعتمدة.");
    if (await directory.queryPermission({ mode: "readwrite" }) !== "granted") throw new Error("انتهى إذن المجلد. اضغط إعادة محاولة الحفظ للسماح بالوصول مجددًا.");
    const path = visitArchivePath(data);
    let parent: FileSystemDirectoryHandle = directory;
    for (const segment of path.slice(0, -1)) parent = await parent.getDirectoryHandle(segment, { create: true });
    const filename = path[path.length - 1];
    try {
        const previous = await parent.getFileHandle(filename);
        const existing = await previous.getFile();
        if (existing.size > 0) {
            if (await existing.slice(0, 5).text() !== "%PDF-") throw new Error("يوجد ملف مختلف بالاسم نفسه في الأرشيف؛ لم يتم استبداله.");
            return path.join(" / ");
        }
    } catch (error) { if ((error as DOMException).name !== "NotFoundError") throw error; }
    const pdf = await makePdf();
    const file = await parent.getFileHandle(filename, { create: true });
    const stream = await file.createWritable();
    try { await stream.write(pdf); await stream.close(); }
    catch (error) { try { await stream.abort(); } catch { /* Already closed. */ } throw error; }
    return path.join(" / ");
}
