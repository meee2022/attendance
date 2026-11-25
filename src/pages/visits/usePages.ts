import { useLayoutEffect, useRef, useState } from "react";

// Printed forms whose rows grow with their text. Page p holds the items
// [starts[p], starts[p + 1]); a page taller than `maxHeight` points hands its
// last item to the next page, one at a time, until every page fits.
export function usePages(count: number, maxHeight: number, initial: number[]) {
    const [first] = useState(initial);
    const [starts, setStarts] = useState(first);
    const bodies = useRef<(HTMLElement | null)[]>([]);
    useLayoutEffect(() => {
        for (let p = 0; p < starts.length; p++) {
            const el = bodies.current[p];
            const end = starts[p + 1] ?? count;
            if (!el || el.scrollHeight * 72 / 96 <= maxHeight || end - starts[p] < 2) continue;
            setStarts(p + 1 < starts.length ? starts.map((s, i) => (i === p + 1 ? s - 1 : s)) : [...starts, end - 1]);
            return;
        }
    });
    // fonts arriving can change every row's height: lay the pages out again
    useLayoutEffect(() => {
        const reset = () => setStarts(first);
        void document.fonts.ready.then(reset);
        window.addEventListener("visit-form-layout", reset);
        return () => window.removeEventListener("visit-form-layout", reset);
    }, [first]);
    return { starts, bodyOf: (p: number) => (el: HTMLElement | null) => { bodies.current[p] = el; } };
}
