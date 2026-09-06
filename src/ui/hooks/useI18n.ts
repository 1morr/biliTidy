import { useSyncExternalStore } from 'react';
import { currentLanguage, subscribeLanguage, t, type Language, type Messages } from '@/i18n';

/** The active language's strings; the component re-renders when the user switches language in Settings. */
export function useMessages(): Messages {
  useSyncExternalStore(subscribeLanguage, currentLanguage, currentLanguage);
  return t();
}

/** The active language itself — for the Settings page's language selector. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, currentLanguage, currentLanguage);
}
