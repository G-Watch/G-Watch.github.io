"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * View state that should outlive a remount. USER-OWNED: this file is not listed
 * in goodoc.manifest.json, so `npm run upgrade` never touches it.
 *
 * Switching locale changes the `[lang]` route segment, so the whole client tree
 * unmounts and every `useState` goes back to its initial value. The reader loses
 * the tab they were on, the zoom they had set, the platform they picked — and a
 * trace panel re-fetches a payload that can run to tens of megabytes. The query
 * string carries what is worth sharing; this carries the rest.
 *
 * Module scope rather than sessionStorage on purpose: a fresh load should start
 * clean, and a Set of lane ids should not have to survive serialisation. The
 * store lives as long as the tab does, which is exactly as long as a locale
 * switch takes.
 *
 * Keys are the caller's to choose and must name the thing being viewed, not the
 * component — two traces open in turn are two different keys.
 */
const KEPT = new Map<string, unknown>();

/** `useState`, except the value is remembered across a remount. */
export function useKeptState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (KEPT.has(key)) return KEPT.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  // Written after the render that produced it, so the updater stays pure and a
  // double invocation under StrictMode cannot write twice to different effect.
  useEffect(() => {
    KEPT.set(key, value);
  }, [key, value]);
  return [value, setValue];
}

/** What is already held for a key, without subscribing to it. */
export function keptValue<T>(key: string): T | undefined {
  return KEPT.get(key) as T | undefined;
}
