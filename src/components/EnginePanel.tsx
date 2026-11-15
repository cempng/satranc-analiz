import { DEPTH_OPTIONS } from '../analysis/config';
import { formatScore } from '../engine/uci';
import { formatUciLine } from '../lib/notation';
import { useAnalysisStore, useDisplayedAnalysis } from '../store/analysisStore';
import { useEngineStore } from '../store/engineStore';
import { useCurrentFen } from '../store/gameStore';

export function EnginePanel() {
  const fen = useCurrentFen();
  const { status, errorMessage, depth, setDepth, showBestArrow, toggleBestArrow } = useEngineStore();
  const current = useDisplayedAnalysis();
  const gameAnalysisRunning = useAnalysisStore((s) => s.status === 'running');
  // Oynanacak hamle yoksa motor yalnızca "mat 0" ya da "cp 0" (pat) döndürür.
  const gameOver = current?.done && !current.lines[0]?.pv.length;
  const mated = gameOver && current.lines[0]?.score.type === 'mate';

  return (
    <div className="space-y-2 rounded-lg bg-slate-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'ready' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-500' : 'animate-pulse bg-amber-400'
            }`}
          />
          Stockfish 19
          <span className="font-normal text-slate-500">
            {status === 'loading' && 'yükleniyor…'}
            {status === 'ready' && current && !gameOver && `derinlik ${current.depth}/${current.targetDepth}`}
          </span>
        </h2>
        <div className="flex items-center gap-1 rounded-md bg-slate-800 p-0.5" role="group" aria-label="Derinlik">
          {DEPTH_OPTIONS.map((o) => (
            <button
              key={o.depth}
              type="button"
              onClick={() => setDepth(o.depth)}
              className={`rounded px-2 py-0.5 text-xs transition ${
                depth === o.depth ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
              title={`Derinlik ${o.depth}`}
            >
              {o.label} {o.depth}
            </button>
          ))}
        </div>
      </div>

      {status === 'error' && (
        <p className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">
          Motor başlatılamadı: {errorMessage}
        </p>
      )}

      <ul className="space-y-1">
        {gameOver && (
          <li className="text-sm text-slate-300">{mated ? 'Mat – oyun bitti.' : 'Oynanacak hamle yok – oyun berabere bitti (pat).'}</li>
        )}
        {!gameOver && (current?.lines ?? []).map((line) => (
          <li key={line.multipv} className="flex items-start gap-2 text-sm">
            <span
              className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-xs font-bold ${
                formatScore(line.score).startsWith('-') ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
              }`}
            >
              {formatScore(line.score)}
            </span>
            <span className="min-w-0 truncate font-mono text-xs leading-5 text-slate-300">
              {formatUciLine(fen, line.pv, 10)}
            </span>
          </li>
        ))}
        {status === 'ready' && !current && (
          <li className="text-sm text-slate-500">
            {gameAnalysisRunning ? 'Oyun analizi sürüyor; bu pozisyon analiz bitince hesaplanacak.' : 'Hesaplanıyor…'}
          </li>
        )}
      </ul>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none">
        <input type="checkbox" checked={showBestArrow} onChange={toggleBestArrow} className="accent-emerald-500" />
        En iyi hamleyi yeşil okla göster
      </label>
    </div>
  );
}
