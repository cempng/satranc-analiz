import { en } from './en';
import { tr, type MessageKey } from './tr';

export type Lang = 'tr' | 'en';
export type { MessageKey };

export const LANGS: Record<Lang, string> = { tr: 'Türkçe', en: 'English' };

const DICTS: Record<Lang, Record<MessageKey, string>> = { tr, en };

let current: Lang = 'tr';

/** React dışındaki (saf) fonksiyonların kullandığı geçerli dil. Ayarlar deposu günceller. */
export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.title = DICTS[lang]['app.title'];
  }
}

export type Params = Record<string, string | number>;

/** Anahtarı geçerli (ya da verilen) dile çevirir; {ad} yer tutucularını doldurur. */
export function t(key: MessageKey, params?: Params, lang: Lang = current): string {
  const text = DICTS[lang][key] ?? tr[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : text;
}

/** Tarayıcı dili Türkçe değilse İngilizce önerilir. */
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'tr';
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const TR_PIECES: Record<string, string> = { K: 'Ş', Q: 'V', R: 'K', B: 'F', N: 'A' };

/** İngilizce SAN'ı Türkçe taş harflerine çevirir (N→A, B→F, R→K, Q→V, K→Ş). */
export function toTurkishSan(san: string): string {
  if (san.startsWith('O-O')) return san;
  return san.replace(/[KQRBN]/g, (p) => TR_PIECES[p]);
}

/** SAN'ı arayüz dilinin notasyonuyla yazar (Türkçe: Ş V K F A; İngilizce: K Q R B N). */
export function localSan(san: string, lang: Lang = current): string {
  return lang === 'tr' ? toTurkishSan(san) : san;
}
