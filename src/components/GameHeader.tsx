import { useT } from '../i18n/react';
import { useGameStore } from '../store/gameStore';

function known(value?: string) {
  return value && !/^\?+$/.test(value) && !value.includes('??') ? value : undefined;
}

function Player({ color, name, elo }: { color: 'w' | 'b'; name?: string; elo?: string }) {
  const { t } = useT();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`h-3 w-3 shrink-0 rounded-sm border border-slate-500 ${color === 'w' ? 'bg-slate-100' : 'bg-slate-900'}`}
      />
      <span className="truncate font-semibold text-slate-100">{known(name) ?? t(color === 'w' ? 'common.white' : 'common.black')}</span>
      {known(elo) && <span className="text-sm text-slate-400">({elo})</span>}
    </div>
  );
}

export function GameHeader() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const h = game.headers;
  const date = h.Date?.replace(/\.\?\?/g, '');
  const opening = [h.ECO, h.Opening].filter(Boolean).join(' · ');
  const meta = [known(h.Event), known(date)].filter(Boolean).join(' · ');

  return (
    <div className="space-y-1.5 rounded-lg bg-slate-800/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Player color="w" name={h.White} elo={h.WhiteElo} />
          <Player color="b" name={h.Black} elo={h.BlackElo} />
        </div>
        {h.Result && h.Result !== '*' && (
          <span className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 font-mono text-sm font-bold text-slate-100">
            {h.Result}
          </span>
        )}
      </div>
      {meta && <p className="text-xs text-slate-400">{meta}</p>}
      {opening && <p className="text-xs text-amber-300/80">{opening}</p>}
    </div>
  );
}
