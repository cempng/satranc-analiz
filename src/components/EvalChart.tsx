import { useMemo } from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MOVE_CLASS_META, type MoveClass } from '../analysis/moveClasses';
import { winPct } from '../analysis/winPct';
import { formatScore } from '../engine/uci';
import { useT } from '../i18n/react';
import { useAnalysisStore } from '../store/analysisStore';
import { useGameStore } from '../store/gameStore';

/** Grafikte renkli noktayla işaretlenen sınıflar. */
const MARKED: MoveClass[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'missed'];

interface Point {
  ply: number;
  /** Beyazın kazanma olasılığı; analiz edilmemişse undefined. */
  win?: number;
  label: string;
  evalText?: string;
  cls?: MoveClass;
}

/** Değerlendirme grafiği: x = hamle, y = beyazın kazanma olasılığı. Tıklanan hamleye gider. */
export function EvalChart() {
  const { t, san, lang } = useT();
  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const goTo = useGameStore((s) => s.goTo);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const evals = useAnalysisStore((s) => s.evals);
  const classification = useAnalysisStore((s) => s.classification);

  const data = useMemo<Point[]>(() => {
    if (!game || analyzedGame !== game) return [];
    return [game.startFen, ...game.moves.map((m) => m.fenAfter)].map((_, i) => {
      const score = evals[i]?.lines[0]?.score;
      const move = i > 0 ? game.moves[i - 1] : undefined;
      return {
        ply: i,
        win: score ? winPct(score) : undefined,
        label: move ? `${move.moveNumber}${move.color === 'w' ? '.' : '…'} ${san(move.san)}` : t('common.start'),
        evalText: score ? formatScore(score, 1) : undefined,
        cls: i > 0 ? classification?.moves[i - 1]?.cls : undefined,
      };
    });
  }, [game, analyzedGame, evals, classification, lang]);

  if (!game || data.every((d) => d.win === undefined)) return null;

  return (
    <div className="h-28 w-full rounded-lg bg-slate-900 p-1 sm:h-32" aria-label={t('chart.label')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 6, right: 6, bottom: 0, left: 6 }}
          onClick={(state) => {
            if (state.activeTooltipIndex !== undefined) goTo(Number(state.activeTooltipIndex));
          }}
          style={{ cursor: 'pointer' }}
        >
          <XAxis dataKey="ply" type="number" domain={[0, game.moves.length]} hide />
          <YAxis domain={[0, 100]} hide />
          <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />
          <ReferenceLine x={ply} stroke="#38bdf8" strokeWidth={1.5} />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="rounded-md bg-slate-950/95 px-2 py-1 text-xs text-slate-200 shadow ring-1 ring-slate-700">
                  <span className="font-mono">{p.label}</span>
                  {p.evalText && <span className="ml-2 font-mono text-slate-400">{p.evalText}</span>}
                  {p.cls && (
                    <span className="ml-2" style={{ color: MOVE_CLASS_META[p.cls].color }}>
                      {MOVE_CLASS_META[p.cls].label}
                    </span>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="win"
            baseValue={0}
            stroke="#cbd5e1"
            strokeWidth={1}
            fill="#e2e8f0"
            fillOpacity={0.9}
            isAnimationActive={false}
            connectNulls
            activeDot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a' }}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: Point }) => {
              const p = props.payload;
              if (!p?.cls || !MARKED.includes(p.cls) || props.cx === undefined || props.cy === undefined) {
                return <g key={`d${props.index}`} />;
              }
              return (
                <circle
                  key={`d${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={MOVE_CLASS_META[p.cls].color}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
