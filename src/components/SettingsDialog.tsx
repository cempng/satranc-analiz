import { useEffect, useState, type ReactNode } from 'react';
import { COACH_MODEL } from '../analysis/coach';
import { CLASSIFY, type ClassifyConfig } from '../analysis/config';
import { LANGS, t as translate, type Lang, type MessageKey } from '../i18n/core';
import { useT } from '../i18n/react';
import { BOARD_THEMES, useSettingsStore, type BoardTheme } from '../store/settingsStore';

type GroupKey = 'brilliant' | 'great' | 'missed';

/** Ayarlar ekranında düzenlenebilen eşikler (etiket: `th.<grup>.<alan>`, ipucu: `….hint`). */
const THRESHOLD_FIELDS: { group?: GroupKey; key: string; min: number; max: number; hint?: boolean }[] = [
  { key: 'excellentMaxLoss', min: 0, max: 50, hint: true },
  { key: 'goodMaxLoss', min: 0, max: 50, hint: true },
  { key: 'inaccuracyMaxLoss', min: 0, max: 60, hint: true },
  { key: 'mistakeMaxLoss', min: 0, max: 80, hint: true },
  { group: 'brilliant', key: 'maxLoss', min: 0, max: 20, hint: true },
  { group: 'brilliant', key: 'maxWinBefore', min: 50, max: 100, hint: true },
  { group: 'brilliant', key: 'minWinAfter', min: 0, max: 100 },
  { group: 'brilliant', key: 'minSacrifice', min: 1, max: 9, hint: true },
  { group: 'great', key: 'minGapToSecond', min: 0, max: 50, hint: true },
  { group: 'missed', key: 'minBestWin', min: 50, max: 100 },
  { group: 'missed', key: 'minLoss', min: 0, max: 60 },
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
  const { t } = useT();
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
        aria-label={t('settings.title')}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <button type="button" onClick={close} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800" aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* Her iki dilde de iki dilli başlık: yanlış dili seçen kişi de bulabilsin. */}
          <Section title={`${translate('settings.language', undefined, 'tr')} / ${translate('settings.language', undefined, 'en')}`}>
            <div className="flex gap-2" role="radiogroup" aria-label={t('settings.language')}>
              {(Object.keys(LANGS) as Lang[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.language === id}
                  onClick={() => s.update({ language: id })}
                  className={`rounded-md px-3 py-1.5 text-sm ring-2 ${
                    s.language === id ? 'bg-slate-800 ring-sky-500' : 'ring-transparent hover:ring-slate-600'
                  }`}
                >
                  {LANGS[id]}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('settings.board')}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((id) => {
                const theme = BOARD_THEMES[id];
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
                      <span style={{ background: theme.light }} />
                      <span style={{ background: theme.dark }} />
                      <span style={{ background: theme.dark }} />
                      <span style={{ background: theme.light }} />
                    </span>
                    {theme.label}
                  </button>
                );
              })}
            </div>
            <Toggle checked={s.sounds} onChange={(v) => s.update({ sounds: v })}>
              {t('settings.sounds')}
            </Toggle>
          </Section>

          <Section title={t('settings.engine')}>
            {(
              [
                ['lite', 'settings.engineLite', 'settings.engineLiteHint'],
                ['full', 'settings.engineFull', 'settings.engineFullHint'],
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
                  <span className="font-medium text-slate-100">{t(label)}</span>
                  <span className="block text-xs text-slate-400">{t(hint)}</span>
                </span>
              </label>
            ))}
            <Toggle checked={s.tablebase} onChange={(v) => s.update({ tablebase: v })}>
              {t('settings.tablebase')}
              <span className="block text-xs text-slate-400">{t('settings.tablebaseHint')}</span>
            </Toggle>
          </Section>

          <Section title={t('settings.thresholds')}>
            <p className="text-xs text-slate-400">{t('settings.thresholdsHint')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowThresholds((v) => !v)}
                className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                {showThresholds ? t('common.hide') : t('settings.editThresholds')}
              </button>
              {thresholdsChanged && (
                <button
                  type="button"
                  onClick={() => s.update({ thresholds: CLASSIFY })}
                  className="rounded-md px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
                >
                  {t('settings.resetThresholds')}
                </button>
              )}
            </div>
            {showThresholds && (
              <div className="space-y-1.5">
                {THRESHOLD_FIELDS.map((f) => {
                  const id = `th.${f.group ? `${f.group}.` : ''}${f.key}`;
                  const value = readField(s.thresholds, f.group, f.key);
                  const def = readField(CLASSIFY, f.group, f.key);
                  return (
                    <label key={id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-300">
                        {t(id as MessageKey)}
                        {f.hint && <span className="block text-slate-500">{t(`${id}.hint` as MessageKey)}</span>}
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

          <Section title={t('settings.coach')}>
            <label htmlFor="api-key" className="block text-xs text-slate-400">
              {t('settings.coachDesc', { model: COACH_MODEL })}
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
                {t('settings.save')}
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
                {t('settings.deleteKey')}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
