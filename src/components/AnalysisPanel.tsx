import { useAnalysisStore } from '../store/analysisStore';
import { useEngineStore } from '../store/engineStore';
import { useGameStore } from '../store/gameStore';

/** Tam-oyun analizi: başlat / ilerleme / iptal ve açılış adı. */
export function AnalysisPanel() {
  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const depth = useEngineStore((s) => s.depth);
  const engineReady = useEngineStore((s) => s.status === 'ready');
  const { status, current, evals, classification, start, cancel } = useAnalysisStore();
  const analyzedGame = useAnalysisStore((s) => s.game);
  const analyzedDepth = useAnalysisStore((s) => s.depth);

  if (!game) return null;
  const isThisGame = analyzedGame === game;
  const total = game.moves.length;
  const running = isThisGame && status === 'running';
  const done = isThisGame && status === 'done';
  const finishedCount = evals.filter(Boolean).length;
  const pct = running ? Math.round((finishedCount / (total + 1)) * 100) : 0;

  const opening = isThisGame ? classification?.openings[ply] : undefined;

  return (
    <div className="space-y-3 rounded-lg bg-slate-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">Oyun analizi</h2>
        {running ? (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
          >
            İptal
          </button>
        ) : (
          <button
            type="button"
            disabled={!engineReady}
            onClick={() => void start(game, depth, { force: isThisGame && analyzedDepth === depth })}
            className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {done || (isThisGame && status === 'cancelled') ? 'Yeniden analiz et' : 'Oyunu analiz et'} (derinlik {depth})
          </button>
        )}
      </div>

      {running && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-sky-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400">
            Hamle {current}/{total} analiz ediliyor… (derinlik {analyzedDepth})
          </p>
        </div>
      )}
      {done && <p className="text-xs text-emerald-400">Analiz tamamlandı (derinlik {analyzedDepth}).</p>}
      {isThisGame && status === 'cancelled' && (
        <p className="text-xs text-amber-400">
          Analiz iptal edildi ({finishedCount}/{total + 1} pozisyon hazır).
        </p>
      )}

      {opening && (
        <p className="text-xs text-amber-300/80">
          Açılış: {opening.eco} · {opening.name}
        </p>
      )}
    </div>
  );
}
