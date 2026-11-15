import { create } from 'zustand';

const API_KEY_STORAGE = 'satranc-analiz:anthropic-api-key';

function readKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

interface SettingsState {
  /** İsteğe bağlı Anthropic API anahtarı (yalnızca bu tarayıcıda saklanır). */
  apiKey: string;
  settingsOpen: boolean;
  setApiKey: (key: string) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
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
}));
