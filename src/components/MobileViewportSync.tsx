"use client";

import { useEffect } from "react";

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select';

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.matches(EDITABLE_SELECTOR) || el.isContentEditable;
}

/**
 * Keeps CSS variables (--vvh, --vv-top) in sync with window.visualViewport
 * and ensures focused inputs on mobile screens smoothly scroll into view
 * above the virtual keyboard instead of getting hidden behind it.
 */
export function MobileViewportSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let baselineHeight = window.innerHeight;
    let scrollTimer1: ReturnType<typeof setTimeout> | null = null;
    let scrollTimer2: ReturnType<typeof setTimeout> | null = null;

    const updateViewportVars = () => {
      const vv = window.visualViewport;
      const visibleHeight = vv ? Math.round(vv.height) : window.innerHeight;
      const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;

      // Track the largest observed height for the current orientation as baseline
      if (window.innerHeight > baselineHeight) {
        baselineHeight = window.innerHeight;
      }

      root.style.setProperty("--vvh", `${visibleHeight}px`);
      root.style.setProperty("--vv-top", `${offsetTop}px`);

      const active = document.activeElement;
      const heightDiff = Math.max(window.innerHeight, baselineHeight) - visibleHeight;
      const isMobileWidth = window.innerWidth < 1024;
      const keyboardLikelyOpen =
        isMobileWidth && (heightDiff > 120 || isEditableElement(active));

      if (keyboardLikelyOpen) {
        root.setAttribute("data-keyboard-open", "true");
      } else {
        root.removeAttribute("data-keyboard-open");
      }
    };

    const scrollActiveIntoView = (target: HTMLElement) => {
      if (window.innerWidth >= 1024) return;

      const doScroll = () => {
        if (document.activeElement !== target) return;
        try {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch {
          target.scrollIntoView();
        }
      };

      if (scrollTimer1) clearTimeout(scrollTimer1);
      if (scrollTimer2) clearTimeout(scrollTimer2);

      // Run twice: once right after focus and once after the keyboard finishes animating
      scrollTimer1 = setTimeout(doScroll, 120);
      scrollTimer2 = setTimeout(doScroll, 350);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      updateViewportVars();
      if (isEditableElement(target)) {
        scrollActiveIntoView(target);
      }
    };

    const handleFocusOut = () => {
      setTimeout(updateViewportVars, 120);
    };

    const handleOrientationChange = () => {
      baselineHeight = window.innerHeight;
      setTimeout(updateViewportVars, 200);
    };

    const handleVisualViewportChange = () => {
      updateViewportVars();
      const active = document.activeElement;
      if (isEditableElement(active) && window.innerWidth < 1024) {
        try {
          active.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch {
          active.scrollIntoView();
        }
      }
    };

    updateViewportVars();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", handleVisualViewportChange);
    vv?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);
    window.addEventListener("orientationchange", handleOrientationChange);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);

    return () => {
      if (scrollTimer1) clearTimeout(scrollTimer1);
      if (scrollTimer2) clearTimeout(scrollTimer2);
      vv?.removeEventListener("resize", handleVisualViewportChange);
      vv?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("orientationchange", handleOrientationChange);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
    };
  }, []);

  return null;
}

