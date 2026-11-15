import { useEffect, useState, type ReactNode } from 'react';
import { COACH_MODEL } from '../analysis/coach';
import { CLASSIFY, type ClassifyConfig } from '../analysis/config';
import { BOARD_THEMES, useSettingsStore, type BoardTheme } from '../store/settingsStore';

type GroupKey = 'brilliant' | 'great' | 'missed';

/** Ayarlar ekranında düzenlenebilen eşikler. */
const THRESHOLD_FIELDS: { label: string; hint: string; group?: GroupKey; key: string; min: number; max: number }[] = [
  { label: 'Mükemmel: kayıp en fazla', hint: 'Bunun altı Mükemmel', key: 'excellentMaxLoss', min: 0, max: 50 },
  { label: 'İyi: kayıp en fazla', hint: 'Bunun altı İyi', key: 'goodMaxLoss', min: 0, max: 50 },
  { label: 'Belirsiz: kayıp en fazla', hint: 'Bunun altı Belirsiz', key: 'inaccuracyMaxLoss', min: 0, max: 60 },
  { label: 'Hata: kayıp en fazla', hint: 'Bunun üstü Büyük Hata', key: 'mistakeMaxLoss', min: 0, max: 80 },
  { label: 'Brillant: en fazla kayıp', hint: 'Feda eden hamlenin izin verilen kaybı', group: 'brilliant', key: 'maxLoss', min: 0, max: 20 },
  { label: 'Brillant: hamleden önce kazanma şansı en fazla %', hint: 'Zaten ezici üstünken yapılan feda Brillant sayılmaz', group: 'brilliant', key: 'maxWinBefore', min: 50, max: 100 },
  { label: 'Brillant: hamleden sonra kazanma şansı en az %', hint: '', group: 'brilliant', key: 'minWinAfter', min: 0, max: 100 },
  { label: 'Brillant: en az feda (puan)', hint: 'Piyon 1, at/fil 3, kale 5, vezir 9', group: 'brilliant', key: 'minSacrifice', min: 1, max: 9 },
  { label: 'Harika: ikinci hamleyle en az fark', hint: 'Tek iyi hamle sayılması için', group: 'great', key: 'minGapToSecond', min: 0, max: 50 },
  { label: 'Kaçırılan Fırsat: en iyi devamla kazanma şansı en az %', hint: '', group: 'missed', key: 'minBestWin', min: 50, max: 100 },
  { label: 'Kaçırılan Fırsat: kayıp en az', hint: '', group: 'missed', key: 'minLoss', min: 0, max: 60 },
];

function readField(t: ClassifyConfig, group: GroupKey | undefined, key: string): number {
  return group ? (t[group] as Record<string, number>)[key] : (t as unknown as Record<string, number>)[key];
}

function withField(t: ClassifyConfig, group: GroupKey | undefined, key: string, value: number): ClassifyConfig {
  if (!group) return { ...t, [key]: value };
  return { ...t, [group]: { ...t[group], [key]: value } };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-slate-800 pt-3 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300 select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-sky-500" />
      <span>{children}</span>
    </label>
  );
}

export function SettingsDialog() {
  const s = useSettingsStore();
  const [draftKey, setDraftKey] = useState(s.apiKey);
  const [showThresholds, setShowThresholds] = useState(false);

  useEffect(() => {
    if (s.settingsOpen) setDraftKey(s.apiKey);
  }, [s.settingsOpen, s.apiKey]);

  if (!s.settingsOpen) return null;
  const close = () => s.setSettingsOpen(false);
  const thresholdsChanged = JSON.stringify(s.thresholds) !== JSON.stringify(CLASSIFY);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ayarlar"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-lg font-semibold">Ayarlar</h2>
          <button type="button" onClick={close} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800" aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <Section title="Tahta">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((id) => {
                const t = BOARD_THEMES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => s.update({ boardTheme: id })}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ring-2 ${
                      s.boardTheme === id ? 'ring-sky-500' : 'ring-transparent hover:ring-slate-600'
                    }`}
                  >
                    <span className="grid h-6 w-6 grid-cols-2 overflow-hidden rounded-sm">
                      <span style={{ background: t.light }} />
                      <span style={{ background: t.dark }} />
                      <span style={{ background: t.dark }} />
                      <span style={{ background: t.light }} />
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <Toggle checked={s.sounds} onChange={(v) => s.update({ sounds: v })}>
              Hamle sesleri
            </Toggle>
          </Section>

          <Section title="Motor">
            {(
              [
                ['lite', 'Stockfish 19 lite', 'Küçük (~2 MB), hızlı açılır. Her insandan çok daha güçlüdür.'],
                ['full', 'Stockfish 19 tam', 'Daha isabetli, ama ~100 MB indirir; ilk açılışta biraz bekletir ve analiz daha yavaştır.'],
              ] as const
            ).map(([id, label, hint]) => (
              <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="engine"
                  checked={s.engine === id}
                  onChange={() => s.update({ engine: id })}
                  className="mt-0.5 accent-sky-500"
                />
                <span>
                  <span className="font-medium text-slate-100">{label}</span>
                  <span className="block text-xs text-slate-400">{hint}</span>
                </span>
              </label>
            ))}
            <Toggle checked={s.tablebase} onChange={(v) => s.update({ tablebase: v })}>
              Oyun sonu veritabanı
              <span className="block text-xs text-slate-400">
                7 veya daha az taş kalan pozisyonlarda kesin sonucu lichess’in oyun sonu veritabanından getirir (pozisyon
                lichess’e gönderilir).
              </span>
            </Toggle>
          </Section>

          <Section title="Sınıflandırma eşikleri">
            <p className="text-xs text-slate-400">
              Değerler kazanma şansı (%) puanı cinsindendir. Değiştirdiğin anda tüm hamleler yeniden sınıflandırılır.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowThresholds((v) => !v)}
                className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {showThresholds ? 'Gizle' : 'Eşikleri düzenle'}
              </button>
              {thresholdsChanged && (
                <button
                  type="button"
                  onClick={() => s.update({ thresholds: CLASSIFY })}
                  className="rounded-md px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
                >
                  Varsayılanlara dön
                </button>
              )}
            </div>
            {showThresholds && (
              <div className="space-y-1.5">
                {THRESHOLD_FIELDS.map((f) => {
                  const value = readField(s.thresholds, f.group, f.key);
                  const def = readField(CLASSIFY, f.group, f.key);
                  return (
                    <label key={`${f.group ?? ''}.${f.key}`} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-300">
                        {f.label}
                        {f.hint && <span className="block text-slate-500">{f.hint}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {value !== def && <span className="text-slate-500">({def})</span>}
                        <input
                          type="number"
                          min={f.min}
                          max={f.max}
                          step={0.5}
                          value={value}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v)) s.update({ thresholds: withField(s.thresholds, f.group, f.key, Math.min(f.max, Math.max(f.min, v))) });
                          }}
                          className="w-16 rounded bg-slate-950 px-2 py-1 text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Koç yorumu (isteğe bağlı)">
            <label htmlFor="api-key" className="block text-xs text-slate-400">
              Anthropic API anahtarı girersen her hamle için “Koç yorumu al” düğmesi çıkar; pozisyon, hamle ve motor bulguları{' '}
              {COACH_MODEL} modeline gönderilir. Anahtar yalnızca bu tarayıcıda saklanır ve sadece Anthropic’e gönderilir. Her
              istek hesabından ücretlendirilir.
            </label>
            <div className="flex gap-2">
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="sk-ant-…"
                className="min-w-0 flex-1 rounded-md bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                disabled={draftKey.trim() === s.apiKey}
                onClick={() => s.setApiKey(draftKey)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                Kaydet
              </button>
            </div>
            {s.apiKey && (
              <button
                type="button"
                onClick={() => {
                  s.setApiKey('');
                  setDraftKey('');
                }}
                className="text-xs text-red-300 hover:underline"
              >
                Anahtarı sil
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
