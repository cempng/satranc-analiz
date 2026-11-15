import { useMemo, useState } from 'react';
import { MOVE_CLASS_META } from '../analysis/moveClasses';
import { buildPuzzles, type PuzzleFilter } from '../analysis/practice';
import { toTurkishSan } from '../lib/pgn';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';
import { usePracticeStore } from '../store/practiceStore';
import { MoveClassIcon } from './MoveClassIcon';

/** Analiz bitince "Hatanı bul" alıştırmasını başlatan kutu. */
export function PracticeLauncher() {
  const game = useGameStore((s) => s.game);
  const { game: analyzedGame, status, classification, evals } = useAnalysisStore();
  const start = usePracticeStore((s) => s.start);
  const [filter, setFilter] = useState<PuzzleFilter>('all');

  const count = useMemo(
    () => (game && analyzedGame === game && classification ? buildPuzzles(game, classification.moves, evals, filter).length : 0),
    [game, analyzedGame, classification, evals, filter],
  );
  if (!game || analyzedGame !== game || status !== 'done') return null;

  const names = { w: game.headers.White || 'Beyaz', b: game.headers.Black || 'Siyah' };

  return (
    <div className="space-y-2 rounded-lg bg-slate-900 p-3">
      <h2 className="text-sm font-semibold text-slate-300">Hatanı bul (alıştırma)</h2>
      <p className="text-xs text-slate-400">
        Oyundaki Hata, Büyük Hata ve Kaçırılan Fırsat anlarına dön; o pozisyonda doğru hamleyi sen bul.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PuzzleFilter)}
          className="rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Kimin hataları"
        >
          <option value="all">İki oyuncunun hataları</option>
          <option value="w">{names.w} (Beyaz)</option>
          <option value="b">{names.b} (Siyah)</option>
        </select>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => start(filter)}
          className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Başla ({count} bulmaca)
        </button>
      </div>
      {count === 0 && <p className="text-xs text-slate-500">Bu seçimde alıştırma yapılacak hata yok.</p>}
    </div>
  );
}

/** Alıştırma sürerken sağ panelde gösterilen kutu. */
export function PracticePanel() {
  const p = usePracticeStore();
  const puzzle = p.puzzles[p.index];
  if (!p.active || !puzzle) return null;

  const side = puzzle.color === 'w' ? 'Beyaz' : 'Siyah';
  const played = `${puzzle.played.moveNumber}${puzzle.color === 'w' ? '.' : '…'} ${toTurkishSan(puzzle.played.san)}`;
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
          Bulmaca {p.index + 1}/{p.puzzles.length}
        </h2>
        <span className="text-xs text-slate-400">İlk denemede çözülen: {p.solvedFirstTry}</span>
      </div>

      <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-200">
        <MoveClassIcon cls={puzzle.cls} size={20} className="mt-0.5" />
        <span>
          Oyunda burada <span className="font-mono font-semibold">{played}</span> oynandı (
          <span style={{ color: meta.color }}>{meta.label}</span>). <strong>{side}</strong> oynuyor: daha iyisini bul ve
          taşı tahtada sürükle.
        </span>
      </p>

      {(p.message || p.status === 'checking') && (
        <p className={`rounded-md px-3 py-2 text-sm ${tone}`} role="status">
          {p.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {solving && !p.hint && (
          <button type="button" onClick={p.showHint} className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
            İpucu (hangi taş?)
          </button>
        )}
        {solving && (
          <button type="button" onClick={p.reveal} className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
            Çözümü göster
          </button>
        )}
        {p.index > 0 && (
          <button
            type="button"
            onClick={() => p.goToPuzzle(p.index - 1)}
            className="rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            ◀ Önceki
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
            Sonraki ▶
          </button>
        )}
        <button type="button" onClick={p.stop} className="ml-auto rounded-md px-3 py-1 text-xs text-slate-400 hover:bg-slate-800">
          Alıştırmadan çık
        </button>
      </div>
      {p.index === p.puzzles.length - 1 && !solving && (
        <p className="text-xs text-emerald-300">
          Son bulmacaydı. {p.puzzles.length} bulmacanın {p.solvedFirstTry} tanesini ilk denemede çözdün.
        </p>
      )}
    </div>
  );
}
