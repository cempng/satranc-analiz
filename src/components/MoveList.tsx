import { useEffect, useRef } from 'react';
import { toTurkishSan, type PlyMove } from '../lib/pgn';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';
import { MoveClassIcon } from './MoveClassIcon';

interface Row {
  moveNumber: number;
  white?: { move: PlyMove; ply: number };
  black?: { move: PlyMove; ply: number };
}

function buildRows(moves: PlyMove[]): Row[] {
  const rows: Row[] = [];
  moves.forEach((move, i) => {
    const entry = { move, ply: i + 1 };
    if (move.color === 'w' || rows.length === 0) {
      rows.push({ moveNumber: move.moveNumber, [move.color === 'w' ? 'white' : 'black']: entry });
    } else {
      rows[rows.length - 1].black = entry;
    }
  });
  return rows;
}

export function MoveList() {
  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const goTo = useGameStore((s) => s.goTo);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const classification = useAnalysisStore((s) => s.classification);
  const classes = analyzedGame === game ? classification?.moves : undefined;
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ply]);

  if (!game) return <p className="p-4 text-sm text-slate-400">Henüz oyun yüklenmedi.</p>;

  const rows = buildRows(game.moves);

  const cell = (entry?: { move: PlyMove; ply: number }) => {
    if (!entry) return <span className="px-2 py-1 text-slate-600">…</span>;
    const active = entry.ply === ply;
    return (
      <button
        type="button"
        ref={active ? activeRef : undefined}
        onClick={() => goTo(entry.ply)}
        className={`w-full rounded px-2 py-1 text-left font-mono text-sm transition ${
          active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {classes?.[entry.ply - 1] ? (
            <MoveClassIcon cls={classes[entry.ply - 1]!.cls} size={15} />
          ) : (
            <span className="inline-block w-[15px]" />
          )}
          {toTurkishSan(entry.move.san)}
        </span>
      </button>
    );
  };

  return (
    <div className="max-h-80 overflow-y-auto lg:max-h-[420px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="w-10 py-1 text-left font-medium">#</th>
            <th className="py-1 text-left font-medium">Beyaz</th>
            <th className="py-1 text-left font-medium">Siyah</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-slate-800/40' : ''}>
              <td className="py-0.5 pl-1 text-xs text-slate-500">{row.moveNumber}.</td>
              <td className="py-0.5">{cell(row.white)}</td>
              <td className="py-0.5">{cell(row.black)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
