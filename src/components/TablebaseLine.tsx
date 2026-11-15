import { useEffect, useState } from 'react';
import { bestTablebaseMove, describeTablebase, fetchTablebase, isTablebasePosition, type TablebaseResult } from '../lib/tablebase';
import { useT } from '../i18n/react';
import { useCurrentFen } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

type State = { fen: string; result?: TablebaseResult; error?: boolean };

/** 7 veya daha az taşlı pozisyonlarda lichess oyun sonu veritabanından kesin sonucu gösterir. */
export function TablebaseLine() {
  const { t } = useT();
  const fen = useCurrentFen();
  const enabled = useSettingsStore((s) => s.tablebase);
  const eligible = enabled && isTablebasePosition(fen);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    // Hızlı gezinirken her pozisyon için istek atmamak için kısa bekleme.
    const timer = setTimeout(() => {
      fetchTablebase(fen, controller.signal)
        .then((result) => setState({ fen, result }))
        .catch(() => !controller.signal.aborted && setState({ fen, error: true }));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fen, eligible]);

  if (!eligible) return null;
  const current = state?.fen === fen ? state : null;
  const best = current?.result ? bestTablebaseMove(current.result) : undefined;

  return (
    <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-100">
      <span className="font-semibold text-amber-300">{t('tablebase.label')}</span>
      {!current && t('tablebase.loading')}
      {current?.error && t('tablebase.error')}
      {current?.result && (
        <>
          {describeTablebase(current.result, fen)}
          {best && <span className="text-amber-200/80"> · {t('tablebase.best', { move: best })}</span>}
        </>
      )}
    </p>
  );
}
