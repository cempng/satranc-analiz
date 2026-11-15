import { useRef, useState } from 'react';
import { fetchOnlineGames, OnlineGamesError, SITE_LABELS, speedLabel, type OnlineGame, type OnlineSite } from '../lib/onlineGames';
import { getLang } from '../i18n/core';
import { useT } from '../i18n/react';
import { useGameStore } from '../store/gameStore';
import { PgnInput } from './PgnInput';

type Source = 'pgn' | OnlineSite;
const USERNAME_KEY = 'satranc-analiz:username:';
/** İçe aktarma listesinde gösterilen oyun sayısı. */
const IMPORT_COUNT = 20;

function readUsername(site: OnlineSite): string {
  try {
    return localStorage.getItem(USERNAME_KEY + site) ?? '';
  } catch {
    return '';
  }
}

function saveUsername(site: OnlineSite, name: string) {
  try {
    localStorage.setItem(USERNAME_KEY + site, name);
  } catch {
    /* yalnızca kolaylık */
  }
}

export function formatDate(ms?: number): string {
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB';
  return ms ? new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function OnlineImport({ site, onLoaded }: { site: OnlineSite; onLoaded?: () => void }) {
  const { t } = useT();
  const [username, setUsername] = useState(() => readUsername(site));
  const [games, setGames] = useState<OnlineGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadPgnText = useGameStore((s) => s.loadPgnText);

  const fetchGames = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setGames(null);
    try {
      const list = await fetchOnlineGames(site, username, IMPORT_COUNT, controller.signal);
      saveUsername(site, username.trim());
      setGames(list);
      if (list.length === 0) setError(t('online.err.none'));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof OnlineGamesError ? e.message : t('online.err.generic'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const me = username.trim().toLowerCase();

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) void fetchGames();
        }}
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('online.username', { site: SITE_LABELS[site] })}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={!username.trim() || loading}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {t(loading ? 'online.fetching' : 'online.fetch')}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        {t('online.hint', { n: IMPORT_COUNT, site: SITE_LABELS[site] })}
      </p>
      {error && <p className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}
      {games && games.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {games.map((g) => {
            const meWhite = g.white.toLowerCase() === me;
            const meBlack = g.black.toLowerCase() === me;
            const won = (meWhite && g.result === '1-0') || (meBlack && g.result === '0-1');
            const lost = (meWhite && g.result === '0-1') || (meBlack && g.result === '1-0');
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => {
                    loadPgnText(g.pgn);
                    if (!useGameStore.getState().error) onLoaded?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700"
                >
                  <span
                    className={`w-6 shrink-0 text-center text-xs font-bold ${won ? 'text-emerald-400' : lost ? 'text-red-400' : 'text-slate-400'}`}
                    title={t(won ? 'online.won' : lost ? 'online.lost' : 'online.drawn')}
                  >
                    {won ? t('online.winShort') : lost ? t('online.lossShort') : '½'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-100">
                      {g.white} {g.whiteElo ? `(${g.whiteElo})` : ''} – {g.black} {g.blackElo ? `(${g.blackElo})` : ''}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {[g.result, speedLabel(g.speed), formatDate(g.playedAt)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Oyun kaynağı: PGN yapıştır/yükle, ya da Lichess / Chess.com kullanıcı adıyla getir. */
export function GameSource({ onLoaded }: { onLoaded?: () => void }) {
  const { t } = useT();
  const [source, setSource] = useState<Source>('pgn');
  const tabs: [Source, string][] = [
    ['pgn', 'PGN'],
    ['lichess', 'Lichess'],
    ['chesscom', 'Chess.com'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-slate-800 p-0.5" role="tablist" aria-label={t('source.tabs')}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={source === id}
            onClick={() => setSource(id)}
            className={`flex-1 rounded px-3 py-1 text-sm transition ${
              source === id ? 'bg-slate-950 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {source === 'pgn' ? <PgnInput onLoaded={onLoaded} /> : <OnlineImport key={source} site={source} onLoaded={onLoaded} />}
    </div>
  );
}
