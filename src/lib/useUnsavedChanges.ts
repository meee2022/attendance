import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean, onChange?: (dirty: boolean) => void) {
    useEffect(() => {
        onChange?.(dirty);
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (dirty) { event.preventDefault(); event.returnValue = ""; }
        };
        const navigate = (event: MouseEvent) => {
            const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!dirty || !anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === location.href) return;
            if (!window.confirm("يوجد تعديل لم يُحفظ. هل تريد مغادرة الصفحة؟")) {
                event.preventDefault(); event.stopPropagation();
            }
        };
        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("click", navigate, true);
        return () => {
            onChange?.(false);
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", navigate, true);
        };
    }, [dirty, onChange]);
}
