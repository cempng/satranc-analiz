import { useMemo } from 'react';
import { PHASE_LABELS, type GamePhase } from '../analysis/accuracy';
import { MOVE_CLASS_META, MOVE_CLASS_ORDER } from '../analysis/moveClasses';
import { summarizeGame } from '../analysis/summary';
import { useT } from '../i18n/react';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';
import { MoveClassIcon } from './MoveClassIcon';

const fmt = (v?: number) => (v === undefined ? '–' : v.toFixed(1));

export function SummaryPanel() {
  const { t, san } = useT();
  const game = useGameStore((s) => s.game);
  const goTo = useGameStore((s) => s.goTo);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const classification = useAnalysisStore((s) => s.classification);
  const status = useAnalysisStore((s) => s.status);

  const summary = useMemo(
    () => (game && analyzedGame === game && classification ? summarizeGame(game, classification.moves) : null),
    [game, analyzedGame, classification],
  );

  if (!game) return <p className="p-3 text-sm text-slate-400">{t('common.noGame')}</p>;
  if (!summary) return <p className="p-3 text-sm text-slate-400">{t('summary.needAnalysis')}</p>;

  const names = { w: game.headers.White || t('common.white'), b: game.headers.Black || t('common.black') };

  return (
    <div className="space-y-4 p-1">
      {status === 'running' && (
        <p className="text-xs text-amber-400">{t('summary.partial')}</p>
      )}

      {/* Doğruluk */}
      <div className="grid grid-cols-2 gap-2">
        {(['w', 'b'] as const).map((color) => (
          <div key={color} className="rounded-lg bg-slate-800/70 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <span
                className={`h-2.5 w-2.5 rounded-sm border border-slate-500 ${color === 'w' ? 'bg-slate-100' : 'bg-slate-950'}`}
              />
              <span className="truncate">{names[color]}</span>
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-slate-100">
              {fmt(summary.accuracy[color].overall)}
            </div>
            <div className="text-xs text-slate-500">{t('common.accuracy')}</div>
          </div>
        ))}
      </div>

      {/* Evrelere göre doğruluk */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="py-1 text-left font-medium">{t('common.phase')}</th>
            <th className="py-1 text-right font-medium">{t('common.white')}</th>
            <th className="py-1 text-right font-medium">{t('common.black')}</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(PHASE_LABELS) as GamePhase[]).map((phase) => (
            <tr key={phase} className="border-t border-slate-800">
              <td className="py-1 text-slate-300">{PHASE_LABELS[phase]}</td>
              <td className="py-1 text-right tabular-nums text-slate-200">{fmt(summary.accuracy.w.byPhase[phase])}</td>
              <td className="py-1 text-right tabular-nums text-slate-200">{fmt(summary.accuracy.b.byPhase[phase])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sınıf sayıları */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="py-1 text-left font-medium">{t('common.class')}</th>
            <th className="py-1 text-right font-medium">{t('common.white')}</th>
            <th className="py-1 text-right font-medium">{t('common.black')}</th>
          </tr>
        </thead>
        <tbody>
          {MOVE_CLASS_ORDER.map((cls) => (
            <tr key={cls} className="border-t border-slate-800">
              <td className="py-1">
                <span className="flex items-center gap-2 text-slate-300">
                  <MoveClassIcon cls={cls} size={16} />
                  {MOVE_CLASS_META[cls].label}
                </span>
              </td>
              {(['w', 'b'] as const).map((color) => {
                const n = summary.counts[color][cls];
                return (
                  <td
                    key={color}
                    className="py-1 text-right font-semibold tabular-nums"
                    style={{ color: n ? MOVE_CLASS_META[cls].color : '#475569' }}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Kritik anlar */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-300">{t('summary.critical')}</h3>
        {summary.critical.length === 0 && <p className="text-xs text-slate-500">{t('summary.noCritical')}</p>}
        {summary.critical.map((m) => {
          const move = game.moves[m.ply - 1];
          return (
            <button
              key={m.ply}
              type="button"
              onClick={() => goTo(m.ply)}
              className="flex w-full items-center gap-2 rounded-md bg-slate-800/60 px-2.5 py-1.5 text-left text-sm hover:bg-slate-700"
            >
              <MoveClassIcon cls={m.cls} size={18} />
              <span className="font-mono text-slate-100">
                {move.moveNumber}
                {move.color === 'w' ? '.' : '…'} {san(move.san)}
              </span>
              <span style={{ color: MOVE_CLASS_META[m.cls].color }}>{MOVE_CLASS_META[m.cls].label}</span>
              <span className="ml-auto text-xs text-slate-500">
                {m.kind === 'error' ? `−${m.loss.toFixed(1)}` : move.color === 'w' ? names.w : names.b}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
