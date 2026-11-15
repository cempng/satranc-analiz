import { useMemo, useState } from 'react';
import { MOVE_CLASS_META } from '../analysis/moveClasses';
import { buildPuzzles, type PuzzleFilter } from '../analysis/practice';
import { useT } from '../i18n/react';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';
import { usePracticeStore } from '../store/practiceStore';
import { MoveClassIcon } from './MoveClassIcon';

/** Analiz bitince "Hatanı bul" alıştırmasını başlatan kutu. */
export function PracticeLauncher() {
  const { t } = useT();
  const game = useGameStore((s) => s.game);
  const { game: analyzedGame, status, classification, evals } = useAnalysisStore();
  const start = usePracticeStore((s) => s.start);
  const [filter, setFilter] = useState<PuzzleFilter>('all');

  const count = useMemo(
    () => (game && analyzedGame === game && classification ? buildPuzzles(game, classification.moves, evals, filter).length : 0),
    [game, analyzedGame, classification, evals, filter],
  );
  if (!game || analyzedGame !== game || status !== 'done') return null;

  const names = { w: game.headers.White || t('common.white'), b: game.headers.Black || t('common.black') };

  return (
    <div className="space-y-2 rounded-lg bg-slate-900 p-3">
      <h2 className="text-sm font-semibold text-slate-300">{t('practice.title')}</h2>
      <p className="text-xs text-slate-400">{t('practice.desc')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PuzzleFilter)}
          className="rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label={t('practice.whose')}
        >
          <option value="all">{t('practice.both')}</option>
          <option value="w">
            {names.w} ({t('common.white')})
          </option>
          <option value="b">
            {names.b} ({t('common.black')})
          </option>
        </select>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => start(filter)}
          className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {t('practice.start', { n: count })}
        </button>
      </div>
      {count === 0 && <p className="text-xs text-slate-500">{t('practice.none')}</p>}
    </div>
  );
}

/** Alıştırma sürerken sağ panelde gösterilen kutu. */
export function PracticePanel() {
  const { t, san } = useT();
  const p = usePracticeStore();
  const puzzle = p.puzzles[p.index];
  if (!p.active || !puzzle) return null;

  const side = t(puzzle.color === 'w' ? 'common.white' : 'common.black');
  const played = `${puzzle.played.moveNumber}${puzzle.color === 'w' ? '.' : '…'} ${san(puzzle.played.san)}`;
  const meta = MOVE_CLASS_META[puzzle.cls];
  const solving = p.status === 'solving' || p.status === 'wrong';
  const tone =
    p.status === 'correct'
      ? 'bg-emerald-500/15 text-emerald-200'
      : p.status === 'wrong'
        ? 'bg-red-500/15 text-red-200'
        : p.status === 'revealed'
          ? 'bg-sky-500/15 text-sky-200'
          : 'bg-slate-800 text-slate-300';

  return (
    <div className="space-y-3 rounded-lg bg-slate-900 p-3 ring-1 ring-emerald-500/40">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-emerald-300">
          {t('practice.puzzle', { i: p.index + 1, n: p.puzzles.length })}
        </h2>
        <span className="text-xs text-slate-400">{t('practice.solved', { n: p.solvedFirstTry })}</span>
      </div>

      <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-200">
        <MoveClassIcon cls={puzzle.cls} size={20} className="mt-0.5" />
        <span>{t('practice.prompt', { move: played, cls: meta.label, side })}</span>
      </p>

      {(p.message || p.status === 'checking') && (
        <p className={`rounded-md px-3 py-2 text-sm ${tone}`} role="status">
          {p.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {solving && !p.hint && (
          <button type="button" onClick={p.showHint} className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
            {t('practice.hint')}
          </button>
        )}
        {solving && (
          <button type="button" onClick={p.reveal} className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
            {t('practice.reveal')}
          </button>
        )}
        {p.index > 0 && (
          <button
            type="button"
            onClick={() => p.goToPuzzle(p.index - 1)}
            className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            {t('practice.prev')}
          </button>
        )}
        {p.index < p.puzzles.length - 1 && (
          <button
            type="button"
            onClick={() => p.goToPuzzle(p.index + 1)}
            className={`rounded-md px-3 py-1 text-xs ${
              solving ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 font-semibold text-white hover:bg-emerald-500'
            }`}
          >
            {t('practice.next')}
          </button>
        )}
        <button type="button" onClick={p.stop} className="ml-auto rounded-md px-3 py-1 text-xs text-slate-400 hover:bg-slate-800">
          {t('practice.exit')}
        </button>
      </div>
      {p.index === p.puzzles.length - 1 && !solving && (
        <p className="text-xs text-emerald-300">
          {t('practice.finished', { n: p.puzzles.length, solved: p.solvedFirstTry })}
        </p>
      )}
    </div>
  );
}
