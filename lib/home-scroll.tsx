"use client";

// User-owned scroll choreography for the home page's two parts.
//
// Hands scroll progress to CSS as custom properties, so every effect is a pure
// function of where the page is scrolled -- it plays forwards going down and
// backwards going up:
//
//   --lead-out  on <html>: 0 → 1 as part one (#home-lead) scrolls away
//   --rise      on each [data-rise] in part two, and on the footer: 0 → 1 as
//               that element's top climbs from the bottom edge into view
//
// Part two's pieces each rise on their own position, so a tall one is still
// rising when the reader gets to it rather than having finished off screen.
//
// The styles that read them live in app/theme.css under `html.home-scroll`.
// The class is only set when motion is allowed, so without it (reduced
// motion, or before hydration) the page renders plain and fully visible.
import { useEffect } from "react";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Distance from the top of the document by layout, ignoring transforms -- the
 * risers are themselves translated by the effect, and measuring the drawn box
 * would feed that offset back into their own progress.
 */
function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (let at: HTMLElement | null = el; at; at = at.offsetParent as HTMLElement | null) {
    top += at.offsetTop;
  }
  return top;
}

export function HomeScroll() {
  // Part two is sized to fill the screen together with the footer, so it needs
  // the footer's height -- which depends on how its content wraps.
  useEffect(() => {
    const root = document.documentElement;
    const footer = document.querySelector<HTMLElement>("footer");
    if (!footer) return;
    const measure = () =>
      root.style.setProperty("--footer-h", `${footer.offsetHeight}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(footer);
    return () => {
      watch.disconnect();
      root.style.removeProperty("--footer-h");
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const lead = document.getElementById("home-lead");
    const quick = document.getElementById("home-quickstart");
    if (!lead || !quick) return;
    const risers = [
      ...quick.querySelectorAll<HTMLElement>("[data-rise]"),
      ...document.querySelectorAll<HTMLElement>("footer"),
    ];

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const l = lead.getBoundingClientRect();
      // Part one is gone once 70% of it has scrolled past the top.
      root.style.setProperty("--lead-out", clamp01(-l.top / (l.height * 0.7)).toFixed(4));
      // By layout, not scrollHeight: a riser still translated down would
      // stretch the scrollable area and push its own finish line away.
      const end = Math.max(...risers.map((el) => layoutTop(el) + el.offsetHeight));
      const maxScroll = end - vh;
      for (const el of risers) {
        const at = layoutTop(el);
        // In once its top has climbed a third of the way up the screen -- or,
        // for what sits too near the end of the page to climb that far (the
        // footer), by the time the page is scrolled all the way down.
        const run = Math.max(1, Math.min(vh * 0.33, vh - (at - maxScroll)));
        el.style.setProperty("--rise", clamp01((vh - (at - window.scrollY)) / run).toFixed(4));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    root.classList.add("home-scroll");
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.classList.remove("home-scroll");
      root.style.removeProperty("--lead-out");
      for (const el of risers) el.style.removeProperty("--rise");
    };
  }, []);
  return null;
}
