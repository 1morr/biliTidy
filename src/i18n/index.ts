import { storage } from 'wxt/utils/storage';
import { en, type Messages } from './en';
import { zhHant } from './zh-Hant';

export type { Messages } from './en';

export type Language = 'en' | 'zh-Hant';

/** Shown in the Settings page's language selector, in this order. */
export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh-Hant', label: '繁體中文' },
];

const CATALOGUES: Record<Language, Messages> = { en, 'zh-Hant': zhHant };

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh-Hant';
}

/**
 * The active language for *this* JS context (the App tab, the service worker, or a
 * content script each have their own — there is no shared memory between them).
 * A single module-level value rather than an explicit parameter threaded through every
 * call: most of the strings in this catalogue are produced many layers deep in
 * `core/`/`ai/`/`bilibili/` (e.g. `AppError` messages built inside `bilibili/http.ts`),
 * and those call chains already don't thread `Settings` or anything else UI-shaped
 * through themselves. Threading a `Messages` argument through all of them would touch
 * dozens of signatures for a purely presentational concern — the same trade-off the
 * codebase already makes for `shared/activity.ts`'s request log and `bilibili/http.ts`'s
 * cached WBI keys. Each context loads its saved preference once via `initLanguage()`
 * and (for the App tab and the service worker, which can both be open while Settings is
 * changed) stays in sync via `watchLanguage()`.
 */
let current: Language = 'en';
const listeners = new Set<() => void>();

/** Synchronous access to the active language's strings — used by React and plain TS alike. */
export function t(): Messages {
  return CATALOGUES[current];
}

export function currentLanguage(): Language {
  return current;
}

function setCurrent(lang: Language): void {
  if (current === lang) return;
  current = lang;
  for (const fn of listeners) fn();
}

/** For `useSyncExternalStore`; not React-specific itself so non-UI code can use it too. */
export function subscribeLanguage(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** BCP 47 tag for `Intl`/`toLocaleString` calls that should follow the active language. */
export function localeTag(lang: Language = current): string {
  return lang === 'zh-Hant' ? 'zh-Hant' : 'en-US';
}

const languageItem = storage.defineItem<Language>('local:language', { fallback: 'en' });

/** Loads the saved preference and makes it active for this JS context. Call once at startup. */
export async function initLanguage(): Promise<Language> {
  const saved = await languageItem.getValue();
  setCurrent(isLanguage(saved) ? saved : 'en');
  return current;
}

export async function setLanguage(lang: Language): Promise<void> {
  setCurrent(lang);
  await languageItem.setValue(lang);
}

/** Keeps this JS context's language in sync when it's changed elsewhere (e.g. Settings, in another tab). */
export function watchLanguage(): () => void {
  return languageItem.watch((value) => setCurrent(isLanguage(value) ? value : 'en'));
}
