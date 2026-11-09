import { useEffect, useRef, useState } from "react";

/**
 * Measures the active option inside a segmented control so a single indicator
 * can slide between options. Options are marked with `data-seg`. Until the first
 * measurement (and without JS) `box` is null and callers style the active option directly.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeIndex: number) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = ref.current?.querySelectorAll<HTMLElement>("[data-seg]")[activeIndex];
    if (!el) return;
    // ResizeObserver reports once on observe and again whenever the option resizes.
    const observer = new ResizeObserver(() => setBox({ left: el.offsetLeft, width: el.offsetWidth }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeIndex]);

  return { ref, box };
}
