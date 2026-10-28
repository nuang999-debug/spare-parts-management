import { useSyncExternalStore } from "react";

/* UI language switch (TH/EN). Part names and other data from the source files are never
   translated — only the app's own labels and generated text are.

   `tr(th, en)` reads a module-level current language so it also works in plain functions
   (column headers, narrative builders, label helpers). Components that render translated text
   must re-render when the language changes: AppShell subscribes via `useLang()`, and since every
   page renders under it, the whole tree re-renders on a switch. Anything memoised (useMemo,
   table column defs) must either call `tr` at render time or include the language in its deps. */

export type Lang = "th" | "en";

const KEY = "spareparts_lang";

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

let current: Lang = readLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* per-viewer convenience only */
  }
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current language, re-rendering the caller whenever it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Pick the Thai or English text for the current language. */
export function tr(th: string, en: string): string {
  return current === "en" ? en : th;
}

/** Locale for toLocaleDateString / toLocaleString. */
export function dateLocale(): string {
  return current === "en" ? "en-GB" : "th-TH";
}

document.documentElement.lang = current;
