import { useEffect, useState } from 'react';
import { COACH_MODEL } from '../analysis/coach';
import { useSettingsStore } from '../store/settingsStore';

export function SettingsDialog() {
  const { apiKey, setApiKey, settingsOpen, setSettingsOpen } = useSettingsStore();
  const [draft, setDraft] = useState(apiKey);

  useEffect(() => {
    if (settingsOpen) setDraft(apiKey);
  }, [settingsOpen, apiKey]);

  if (!settingsOpen) return null;
  const close = () => setSettingsOpen(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ayarlar"
        className="w-full max-w-md space-y-4 rounded-xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <h2 className="text-lg font-semibold">Ayarlar</h2>

        <div className="space-y-2">
          <label htmlFor="api-key" className="block text-sm font-medium text-slate-200">
            Anthropic API anahtarı (isteğe bağlı)
          </label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            className="w-full rounded-md bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <p className="text-xs leading-relaxed text-slate-400">
            Anahtar girersen her hamle için “Koç yorumu al” düğmesi çıkar; pozisyon, hamle ve motor bulguları {COACH_MODEL}{' '}
            modeline gönderilip daha doğal bir yorum alınır. Anahtar yalnızca bu tarayıcıda saklanır ve sadece
            Anthropic’e gönderilir. Her istek hesabından ücretlendirilir. Anahtar yoksa kural tabanlı yorumlar kullanılır.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          {apiKey && (
            <button
              type="button"
              onClick={() => {
                setApiKey('');
                close();
              }}
              className="mr-auto rounded-md px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Anahtarı sil
            </button>
          )}
          <button type="button" onClick={close} className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => {
              setApiKey(draft);
              close();
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
