import { useT } from '../i18n/react';
import { useGameStore } from '../store/gameStore';

/** Varyant modundayken gösterilen kutu: oynanan hamleler ve "Ana hatta dön". */
export function VariantPanel() {
  const { t, san } = useT();
  const variant = useGameStore((s) => s.variant);
  const game = useGameStore((s) => s.game);
  const exitVariant = useGameStore((s) => s.exitVariant);

  if (!variant) {
    return (
      <p className="px-1 text-xs text-slate-500">
        {t('variant.hint')}
      </p>
    );
  }

  const base = variant.basePly > 0 && game ? game.moves[variant.basePly - 1] : undefined;
  const from = base
    ? t('variant.fromMove', { move: `${base.moveNumber}${base.color === 'w' ? '.' : '…'} ${san(base.san)}` })
    : t('variant.fromStart');

  return (
    <div className="space-y-2 rounded-lg bg-violet-500/10 p-3 ring-1 ring-violet-500/40">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-violet-200">{t('variant.title', { from })}</h2>
        <button
          type="button"
          onClick={exitVariant}
          className="shrink-0 rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500"
        >
          {t('variant.back')}
        </button>
      </div>
      <p className="flex flex-wrap gap-x-1.5 gap-y-1 font-mono text-sm">
        {variant.moves.map((m, i) => (
          <button
            key={i}
            type="button"
            onClick={() => useGameStore.setState({ variant: { ...variant, index: i + 1 } })}
            className={`rounded px-1 ${i + 1 === variant.index ? 'bg-violet-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
          >
            {m.color === 'w' || i === 0 ? `${m.moveNumber}${m.color === 'w' ? '.' : '…'} ` : ''}
            {san(m.san)}
          </button>
        ))}
      </p>
    </div>
  );
}
