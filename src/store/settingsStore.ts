import { create } from 'zustand';
import { CLASSIFY, type ClassifyConfig } from '../analysis/config';
import type { EngineFlavor } from '../engine/stockfish';

export type { EngineFlavor };

const API_KEY_STORAGE = 'satranc-analiz:anthropic-api-key';
const SETTINGS_STORAGE = 'satranc-analiz:settings';

export type BoardTheme = 'mavi' | 'kahve' | 'yesil' | 'mor';

export const BOARD_THEMES: Record<BoardTheme, { label: string; light: string; dark: string }> = {
  mavi: { label: 'Mavi-gri', light: '#d9e1e8', dark: '#5b7083' },
  kahve: { label: 'Ahşap', light: '#ecd9b9', dark: '#ae8a68' },
  yesil: { label: 'Yeşil', light: '#e6ecd2', dark: '#6f9a5a' },
  mor: { label: 'Mor', light: '#e4dcef', dark: '#8a72b0' },
};

/** Tarayıcıda saklanan ayarlar. */
export interface Settings {
  boardTheme: BoardTheme;
  sounds: boolean;
  engine: EngineFlavor;
  /** 7 ve daha az taşlı pozisyonlarda lichess oyun sonu veritabanını sorgula. */
  tablebase: boolean;
  thresholds: ClassifyConfig;
}

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'mavi',
  sounds: true,
  engine: 'lite',
  tablebase: true,
  thresholds: CLASSIFY,
};

/** Kayıtlı (belki eksik ya da eski) ayarları varsayılanlarla birleştirir. */
export function mergeSettings(saved: unknown): Settings {
  if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
  const s = saved as Partial<Settings>;
  const t = (s.thresholds ?? {}) as Partial<ClassifyConfig>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const group = <K extends 'brilliant' | 'great' | 'missed' | 'decided'>(key: K): ClassifyConfig[K] => {
    const defaults = CLASSIFY[key];
    const given = (t[key] ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, num(given[k], v as number)]),
    ) as ClassifyConfig[K];
  };
  return {
    boardTheme: s.boardTheme && s.boardTheme in BOARD_THEMES ? s.boardTheme : DEFAULT_SETTINGS.boardTheme,
    sounds: typeof s.sounds === 'boolean' ? s.sounds : DEFAULT_SETTINGS.sounds,
    engine: s.engine === 'full' ? 'full' : 'lite',
    tablebase: typeof s.tablebase === 'boolean' ? s.tablebase : DEFAULT_SETTINGS.tablebase,
    thresholds: {
      excellentMaxLoss: num(t.excellentMaxLoss, CLASSIFY.excellentMaxLoss),
      goodMaxLoss: num(t.goodMaxLoss, CLASSIFY.goodMaxLoss),
      inaccuracyMaxLoss: num(t.inaccuracyMaxLoss, CLASSIFY.inaccuracyMaxLoss),
      mistakeMaxLoss: num(t.mistakeMaxLoss, CLASSIFY.mistakeMaxLoss),
      brilliant: group('brilliant'),
      great: group('great'),
      missed: group('missed'),
      decided: group('decided'),
    },
  };
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

interface SettingsState extends Settings {
  /** İsteğe bağlı Anthropic API anahtarı (yalnızca bu tarayıcıda saklanır). */
  apiKey: string;
  settingsOpen: boolean;
  setApiKey: (key: string) => void;
  setSettingsOpen: (open: boolean) => void;
  update: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...mergeSettings(readJson(SETTINGS_STORAGE)),
  apiKey: readKey(),
  settingsOpen: false,
  setApiKey: (key) => {
    const trimmed = key.trim();
    try {
      if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed);
      else localStorage.removeItem(API_KEY_STORAGE);
    } catch {
      /* depolama kapalıysa yalnızca bu oturumda kullanılır */
    }
    set({ apiKey: trimmed });
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  update: (patch) => {
    set(patch);
    const { boardTheme, sounds, engine, tablebase, thresholds } = get();
    try {
      localStorage.setItem(SETTINGS_STORAGE, JSON.stringify({ boardTheme, sounds, engine, tablebase, thresholds }));
    } catch {
      /* depolama kapalıysa ayar yalnızca bu oturumda geçerli */
    }
  },
}));
