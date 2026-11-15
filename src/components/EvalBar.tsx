import { useRef } from 'react';
import { winPct } from '../analysis/winPct';
import { formatScore, type Score } from '../engine/uci';
import { useDisplayedAnalysis } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';

/** Dikey değerlendirme çubuğu: beyaz kısmın yüksekliği beyazın kazanma olasılığıdır. */
export function EvalBar() {
  const analysis = useDisplayedAnalysis();
  const orientation = useGameStore((s) => s.orientation);

  // Yeni pozisyonun ilk sonucu gelene kadar önceki değeri göster (çubuk 50'ye zıplamasın).
  const lastScore = useRef<Score | null>(null);
  const fresh = analysis?.lines[0]?.score;
  if (fresh) lastScore.current = fresh;
  const score = lastScore.current;

  const white = score ? winPct(score) : 50;
  const whiteAhead = white >= 50;
  const label = score ? formatScore(score, 1).replace(/^[+-]/, '') : '';
  const flipped = orientation === 'black';

  return (
    <div
      className={`relative flex w-6 shrink-0 overflow-hidden rounded bg-slate-700 sm:w-7 ${flipped ? 'flex-col' : 'flex-col-reverse'}`}
      title={score ? `Değerlendirme: ${formatScore(score)}` : 'Motor hesaplıyor…'}
    >
      <div className="bg-slate-100 transition-[height] duration-300 ease-out" style={{ height: `${white}%` }} />
      <div className="flex-1 bg-slate-800" />
      {label && (
        <span
          className={`absolute left-0 right-0 text-center text-[10px] font-bold leading-tight ${
            whiteAhead ? 'text-slate-800' : 'text-slate-100'
          } ${whiteAhead !== flipped ? 'bottom-1' : 'top-1'}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
