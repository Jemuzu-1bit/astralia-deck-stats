import { useEffect, type RefObject } from "react";

// Keep keyboard navigation and scrolling inside the active dialog.
export function useModalFocus(ref: RefObject<HTMLElement | null>, paused = false) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = element.querySelector<HTMLElement>('button:not([disabled]), input:not([hidden]), [tabindex="0"]');
    (first ?? element).focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [ref]);

  useEffect(() => {
    if (paused) return;
    const element = ref.current;
    if (!element) return;
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]):not([hidden]), select:not([disabled]), textarea, [tabindex="0"]')).filter(item => item.getClientRects().length > 0);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === element)) {
        event.preventDefault(); items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault(); items[0].focus();
      }
    };
    element.addEventListener("keydown", trap);
    return () => element.removeEventListener("keydown", trap);
  }, [ref, paused]);
}
