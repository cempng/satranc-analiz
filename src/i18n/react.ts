import { useSettingsStore } from '../store/settingsStore';
import { localSan, t, type Lang, type MessageKey, type Params } from './core';

/** Bileşenler için çeviri kancası: dil değişince bileşen yeniden çizilir. */
export function useT() {
  const lang = useSettingsStore((s) => s.language);
  return {
    lang,
    t: (key: MessageKey, params?: Params) => t(key, params, lang),
    san: (s: string) => localSan(s, lang),
  };
}

export type { Lang };
