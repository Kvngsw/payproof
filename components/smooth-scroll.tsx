"use client";

import { useEffect } from "react";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SmoothScroll() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;

      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;

      const target = document.querySelector(hash);
      if (!(target instanceof HTMLElement)) return;

      event.preventDefault();

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        target.scrollIntoView();
        history.pushState(null, "", hash);
        return;
      }

      const header = document.querySelector("header");
      const offset = header instanceof HTMLElement ? header.offsetHeight : 0;
      const startY = window.scrollY;
      const targetY = Math.max(
        0,
        Math.min(
          target.getBoundingClientRect().top + startY - offset - 24,
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
      const distance = targetY - startY;

      if (Math.abs(distance) < 2) {
        history.pushState(null, "", hash);
        return;
      }

      const duration = Math.min(900, Math.max(550, Math.abs(distance) * 0.35));
      let startTime: number | null = null;

      function frame(timestamp: number) {
        if (startTime === null) startTime = timestamp;
        const progress = Math.min(1, (timestamp - startTime) / duration);
        window.scrollTo({
          top: startY + distance * easeInOutCubic(progress),
          behavior: "instant",
        });
        if (progress < 1) requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
      history.pushState(null, "", hash);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
