import { useMemo, useState } from 'react';
import { PHASE_LABELS, type GamePhase } from '../analysis/accuracy';
import { MOVE_CLASS_META, type MoveClass } from '../analysis/moveClasses';
import { aggregateStats } from '../analysis/stats';
import { DEPTH_OPTIONS } from '../analysis/config';
import { SITE_LABELS, speedLabel, type OnlineSite } from '../lib/onlineGames';
import { useT } from '../i18n/react';
import { useEngineStore } from '../store/engineStore';
import { useGameStore } from '../store/gameStore';
import { STATS_GAME_COUNTS, useStatsStore } from '../store/statsStore';
import { formatDate } from './GameSource';
import { MoveClassIcon } from './MoveClassIcon';

const fmt = (v?: number) => (v === undefined ? '–' : v.toFixed(1));
const PER_GAME: MoveClass[] = ['brilliant', 'great', 'missed', 'inaccuracy', 'mistake', 'blunder'];
const OUTCOME_CLASS = { win: 'text-emerald-400', draw: 'text-slate-400', loss: 'text-red-400' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

/** Oyuncu istatistikleri: bir kullanıcının son oyunlarını toplu analiz eder ve özetler. */
export function StatsPage({ onOpenGame }: { onOpenGame: () => void }) {
  const { t } = useT();
  const stats = useStatsStore();
  const engineReady = useEngineStore((s) => s.status === 'ready');
  const [site, setSite] = useState<OnlineSite>(stats.site);
  const [username, setUsername] = useState(stats.username);
  const [count, setCount] = useState<number>(10);
  const [depth, setDepth] = useState<number>(stats.depth);

  const summary = useMemo(() => aggregateStats(stats.results), [stats.results]);
  const busy = stats.status === 'running' || stats.status === 'fetching';
  const p = stats.progress;
  const pct = p.games ? Math.round(((p.game - 1 + (p.positions ? p.position / p.positions : 0)) / p.games) * 100) : 0;

  const openGame = (pgn: string) => {
    // Toplu analizdeki derinlikle açılırsa sonuç önbellekten anında gelir.
    useEngineStore.getState().setDepth(stats.depth);
    useGameStore.getState().loadPgnText(pgn);
    onOpenGame();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Card title={t('stats.title')}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim()) void stats.run(site, username, count, depth);
          }}
        >
          <label className="text-xs text-slate-400">
            {t('stats.site')}
            <select
              value={site}
              onChange={(e) => setSite(e.target.value as OnlineSite)}
              className="mt-1 block rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            >
              {(Object.keys(SITE_LABELS) as OnlineSite[]).map((s) => (
                <option key={s} value={s}>
                  {SITE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-40 flex-1 text-xs text-slate-400">
            {t('stats.username')}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            {t('stats.count')}
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 block rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            >
              {STATS_GAME_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {t('stats.lastN', { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            {t('stats.depth')}
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="mt-1 block rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            >
              {DEPTH_OPTIONS.map((o) => (
                <option key={o.depth} value={o.depth}>
                  {o.label} {o.depth}
                </option>
              ))}
            </select>
          </label>
          {busy ? (
            <button type="button" onClick={stats.cancel} className="rounded-md bg-slate-700 px-4 py-1.5 text-sm hover:bg-slate-600">
              {t('common.cancel')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!username.trim() || !engineReady}
              className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              {t('stats.run')}
            </button>
          )}
        </form>
        <p className="mt-2 text-xs text-slate-500">
          {t('stats.desc')}
        </p>

        {stats.status === 'fetching' && <p className="mt-3 text-sm text-slate-300">{t('stats.fetching')}</p>}
        {stats.status === 'running' && (
          <div className="mt-3 space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-sky-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-slate-400">
              {t('stats.progress', { game: p.game, games: p.games })}
              {p.positions > 0 && t('stats.progressPos', { pos: p.position, positions: p.positions })}
            </p>
          </div>
        )}
        {stats.status === 'error' && <p className="mt-3 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{stats.error}</p>}
        {stats.status === 'cancelled' && <p className="mt-3 text-xs text-amber-400">{t('stats.cancelled')}</p>}
        {stats.status === 'done' && (
          <p className="mt-3 text-xs text-emerald-400">
            {t('stats.done', { n: summary.games })}
            {p.skipped > 0 && t('stats.skipped', { n: p.skipped })}.
          </p>
        )}
      </Card>

      {summary.games > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card title={t('stats.general')}>
              <div className="text-center">
                <div className="text-4xl font-bold tabular-nums">{fmt(summary.accuracy)}</div>
                <div className="text-xs text-slate-500">{t('stats.avgAccuracy', { n: summary.games })}</div>
                <div className="mt-3 flex justify-center gap-4 text-sm">
                  <span className="text-emerald-400">{t('stats.wins', { n: summary.wins })}</span>
                  <span className="text-slate-300">{t('stats.draws', { n: summary.draws })}</span>
                  <span className="text-red-400">{t('stats.losses', { n: summary.losses })}</span>
                </div>
              </div>
            </Card>
            <Card title={t('stats.byPhase')}>
              <table className="w-full text-sm">
                <tbody>
                  {(Object.keys(PHASE_LABELS) as GamePhase[]).map((ph) => (
                    <tr key={ph} className="border-t border-slate-800 first:border-0">
                      <td className="py-1.5 text-slate-300">{PHASE_LABELS[ph]}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(summary.byPhase[ph])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title={t('stats.perGame')}>
              <table className="w-full text-sm">
                <tbody>
                  {PER_GAME.map((c) => (
                    <tr key={c} className="border-t border-slate-800 first:border-0">
                      <td className="py-1">
                        <span className="flex items-center gap-2 text-slate-300">
                          <MoveClassIcon cls={c} size={16} />
                          {MOVE_CLASS_META[c].label}
                        </span>
                      </td>
                      <td className="py-1 text-right font-semibold tabular-nums" style={{ color: MOVE_CLASS_META[c].color }}>
                        {summary.perGame[c].toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card title={t('stats.openings')}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="py-1 text-left font-medium">{t('stats.opening')}</th>
                    <th className="py-1 text-right font-medium">{t('stats.games')}</th>
                    <th className="py-1 text-right font-medium">{t('stats.score')}</th>
                    <th className="py-1 text-right font-medium capitalize">{t('common.accuracy')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.openings.map((o) => (
                    <tr key={o.name} className="border-t border-slate-800">
                      <td className="py-1.5 text-slate-200">{o.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{o.games}</td>
                      <td
                        className={`py-1.5 text-right tabular-nums ${o.score >= 60 ? 'text-emerald-400' : o.score <= 40 ? 'text-red-400' : 'text-slate-300'}`}
                      >
                        {o.score.toFixed(0)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(o.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('stats.scoreNote')}</p>
          </Card>

          <Card title={t('stats.gameList')}>
            <ul className="space-y-1">
              {stats.results.map((g) => (
                <li key={g.online.id}>
                  <button
                    type="button"
                    onClick={() => openGame(g.online.pgn)}
                    className="flex w-full items-center gap-3 rounded-md bg-slate-800/60 px-3 py-2 text-left text-sm hover:bg-slate-700"
                    title={t('stats.openGame')}
                  >
                    <span className={`w-5 shrink-0 text-center font-bold ${OUTCOME_CLASS[g.outcome]}`}>{t(`stats.outcome.${g.outcome}`)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-100">
                        {g.online.white} – {g.online.black}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {[g.opening, speedLabel(g.online.speed), formatDate(g.online.playedAt)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{fmt(g.accuracy)}</span>
                      <span className="block text-xs text-slate-500">
                        {g.counts.blunder > 0 && <span className="text-red-400">{g.counts.blunder}?? </span>}
                        {g.counts.mistake > 0 && <span className="text-orange-400">{g.counts.mistake}? </span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
