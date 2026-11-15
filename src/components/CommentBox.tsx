import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCoachComment } from '../analysis/coach';
import { buildComment } from '../analysis/comments';
import { MOVE_CLASS_META } from '../analysis/moveClasses';
import { toTurkishSan } from '../lib/pgn';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { MoveClassIcon } from './MoveClassIcon';

type CoachState = { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; message: string };

/** Ekrandaki hamle için yorum kutusu: kural tabanlı yorum + isteğe bağlı koç yorumu. */
export function CommentBox() {
  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const inVariant = useGameStore((s) => s.variant !== null);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const evals = useAnalysisStore((s) => s.evals);
  const classification = useAnalysisStore((s) => s.classification);
  const running = useAnalysisStore((s) => s.status === 'running');
  const apiKey = useSettingsStore((s) => s.apiKey);
  const thresholds = useSettingsStore((s) => s.thresholds);
  const openSettings = useSettingsStore((s) => s.setSettingsOpen);

  // Koç yorumları oyun başına hamle indeksine göre saklanır.
  const [coach, setCoach] = useState<Record<number, CoachState>>({});
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setCoach({});
    return () => abortRef.current?.abort();
  }, [game]);

  const isThisGame = game !== null && analyzedGame === game;
  const move = game && ply > 0 ? game.moves[ply - 1] : undefined;
  const info = isThisGame && ply > 0 ? classification?.moves[ply - 1] : undefined;
  const before = isThisGame ? evals[ply - 1] : undefined;
  const after = isThisGame ? evals[ply] : undefined;
  const openingName = isThisGame ? classification?.openings[ply]?.name : undefined;

  const comment = useMemo(
    () => (move && info && before && after ? buildComment({ move, info, before, after, openingName, config: thresholds }) : null),
    [move, info, before, after, openingName, thresholds],
  );

  if (!game || inVariant) return null;
  if (!move) {
    return (
      <div className="rounded-lg bg-slate-900 p-3 text-sm text-slate-400">
        Başlangıç pozisyonu. Hamleler arasında gezinerek her hamlenin yorumunu görebilirsin.
      </div>
    );
  }
  if (!info || !comment) {
    return (
      <div className="rounded-lg bg-slate-900 p-3 text-sm text-slate-400">
        {running ? 'Bu hamle henüz analiz edilmedi…' : 'Yorum için oyunu analiz et.'}
      </div>
    );
  }

  const meta = MOVE_CLASS_META[info.cls];
  const coachState = coach[ply];

  const askCoach = async () => {
    const index = ply;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCoach((c) => ({ ...c, [index]: { status: 'loading' } }));
    try {
      const text = await fetchCoachComment(apiKey, { move, info, comment }, controller.signal);
      setCoach((c) => ({ ...c, [index]: { status: 'done', text } }));
    } catch (e) {
      if (controller.signal.aborted) return;
      setCoach((c) => ({ ...c, [index]: { status: 'error', message: (e as Error).message } }));
    }
  };

  return (
    <div className="space-y-2.5 rounded-lg bg-slate-900 p-3" style={{ boxShadow: `inset 3px 0 0 ${meta.color}` }}>
      <div className="flex items-center gap-2">
        <MoveClassIcon cls={info.cls} size={22} />
        <span className="font-mono font-semibold text-slate-100">
          {move.moveNumber}
          {move.color === 'w' ? '.' : '…'} {toTurkishSan(move.san)}
        </span>
        <span className="font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
        {comment.evalChange && (
          <span className="ml-auto font-mono text-xs text-slate-400" title="Değerlendirme (beyaz perspektifi)">
            {comment.evalChange}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-slate-200">{comment.headline}</p>
      {comment.details.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
          {comment.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {comment.line && (
        <p className="text-xs leading-relaxed text-slate-400">
          <span className="text-slate-500">{comment.line.label}: </span>
          <span className="font-mono">{comment.line.text}</span>
        </p>
      )}
      <p className="text-xs text-slate-500">
        Kazanma şansı: %{Math.round(info.winBefore)} → %{Math.round(info.winAfter)}
        {info.loss >= 0.5 && ` (kayıp ${info.loss.toFixed(1)})`}
      </p>

      <div className="border-t border-slate-800 pt-2">
        {apiKey ? (
          <>
            {coachState?.status === 'done' ? (
              <p className="rounded-md bg-sky-500/10 p-2.5 text-sm leading-relaxed text-sky-100">
                <span className="font-semibold text-sky-300">Koç: </span>
                {coachState.text}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void askCoach()}
                disabled={coachState?.status === 'loading'}
                className="rounded-md bg-sky-700 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              >
                {coachState?.status === 'loading' ? 'Koç düşünüyor…' : 'Koç yorumu al'}
              </button>
            )}
            {coachState?.status === 'error' && <p className="mt-1 text-xs text-red-300">{coachState.message}</p>}
          </>
        ) : (
          <button type="button" onClick={() => openSettings(true)} className="text-xs text-slate-500 hover:text-sky-400">
            Daha doğal bir koç yorumu için Ayarlar’dan API anahtarı ekleyebilirsin.
          </button>
        )}
      </div>
    </div>
  );
}
