import { exportAnnotatedPgn, pgnFileName } from '../analysis/exportPgn';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';

/** Analiz edilmiş oyunu sınıflar ve yorumlarla PGN dosyası olarak indirir. */
export function ExportButton() {
  const game = useGameStore((s) => s.game);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const status = useAnalysisStore((s) => s.status);
  if (!game || analyzedGame !== game || status !== 'done') return null;

  const download = () => {
    const { classification, evals } = useAnalysisStore.getState();
    const text = exportAnnotatedPgn(game, classification?.moves ?? [], evals);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = pgnFileName(game);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="rounded-md bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
      title="Sınıflar (!!, ?, ??), motor değerlendirmeleri ve kısa yorumlarla PGN dosyası"
    >
      Analizli PGN indir
    </button>
  );
}
