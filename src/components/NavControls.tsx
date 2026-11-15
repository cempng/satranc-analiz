import { useT } from '../i18n/react';
import { useGameStore } from '../store/gameStore';

function NavButton({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 flex-1 items-center justify-center rounded-md bg-slate-800 text-lg text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function NavControls() {
  const { t } = useT();
  const { game, ply, variant, first, prev, next, last, flip } = useGameStore();
  const total = game?.moves.length ?? 0;
  const atStart = !variant && ply === 0;
  const atEnd = variant ? variant.index >= variant.moves.length : ply >= total;

  return (
    <div className="flex gap-2">
      <NavButton label="⏮" title={t('navc.first')} onClick={first} disabled={atStart} />
      <NavButton label="◀" title={t('navc.prev')} onClick={prev} disabled={atStart} />
      <NavButton label="▶" title={t('navc.next')} onClick={next} disabled={atEnd} />
      <NavButton label="⏭" title={t('navc.last')} onClick={last} disabled={!variant && ply >= total} />
      <NavButton label="⇅" title={t('navc.flip')} onClick={flip} />
    </div>
  );
}
