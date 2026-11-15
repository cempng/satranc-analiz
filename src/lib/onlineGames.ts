/** Lichess ve Chess.com'un herkese açık API'lerinden bir oyuncunun son oyunlarını getirir (anahtar gerekmez). */

export type OnlineSite = 'lichess' | 'chesscom';

export const SITE_LABELS: Record<OnlineSite, string> = { lichess: 'Lichess', chesscom: 'Chess.com' };

export interface OnlineGame {
  id: string;
  site: OnlineSite;
  url?: string;
  pgn: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  /** "1-0", "0-1", "1/2-1/2" ya da "*" */
  result: string;
  /** Oyunun bitiş zamanı (ms). */
  playedAt?: number;
  /** bullet / blitz / rapid / classical / daily … */
  speed?: string;
}

export class OnlineGamesError extends Error {}

const RESULT_BY_WINNER: Record<string, string> = { white: '1-0', black: '0-1' };

/** Lichess NDJSON yanıtını (pgnInJson=true) oyun listesine çevirir. Standart olmayan varyantlar atlanır. */
export function parseLichessNdjson(text: string): OnlineGame[] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .flatMap((line) => {
      let g: Record<string, any>;
      try {
        g = JSON.parse(line);
      } catch {
        return [];
      }
      if (!g.pgn || (g.variant && g.variant !== 'standard' && g.variant !== 'fromPosition')) return [];
      const draw = g.status === 'draw' || g.status === 'stalemate';
      const result = g.winner ? RESULT_BY_WINNER[g.winner] : draw ? '1/2-1/2' : '*';
      const name = (side: any) => side?.user?.name ?? (side?.aiLevel ? `Stockfish seviye ${side.aiLevel}` : 'Anonim');
      return [
        {
          id: String(g.id),
          site: 'lichess' as const,
          url: `https://lichess.org/${g.id}`,
          pgn: String(g.pgn),
          white: name(g.players?.white),
          black: name(g.players?.black),
          whiteElo: g.players?.white?.rating,
          blackElo: g.players?.black?.rating,
          result,
          playedAt: g.lastMoveAt ?? g.createdAt,
          speed: g.speed,
        },
      ];
    });
}

/** Chess.com aylık arşiv yanıtını oyun listesine çevirir (en yenisi önce). Yalnızca standart satranç. */
export function parseChessComArchive(json: unknown): OnlineGame[] {
  const games = (json as { games?: Record<string, any>[] })?.games ?? [];
  const resultOf = (g: Record<string, any>) => {
    const w = g.white?.result;
    const b = g.black?.result;
    if (w === 'win') return '1-0';
    if (b === 'win') return '0-1';
    const draws = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'];
    return draws.includes(w) || draws.includes(b) ? '1/2-1/2' : '*';
  };
  return games
    .filter((g) => g.pgn && (g.rules ?? 'chess') === 'chess')
    .map((g) => ({
      id: String(g.uuid ?? g.url),
      site: 'chesscom' as const,
      url: g.url,
      pgn: String(g.pgn),
      white: g.white?.username ?? 'Beyaz',
      black: g.black?.username ?? 'Siyah',
      whiteElo: g.white?.rating,
      blackElo: g.black?.rating,
      result: resultOf(g),
      playedAt: typeof g.end_time === 'number' ? g.end_time * 1000 : undefined,
      speed: g.time_class,
    }))
    .reverse();
}

function cleanUsername(username: string): string {
  const u = username.trim();
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(u)) throw new OnlineGamesError('Kullanıcı adı yalnızca harf, rakam, - ve _ içerebilir.');
  return u;
}

async function getOrThrow(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new OnlineGamesError('Siteye bağlanılamadı. İnternet bağlantını kontrol et.');
  }
  if (res.status === 404) throw new OnlineGamesError('Bu kullanıcı adı bulunamadı.');
  if (res.status === 429) throw new OnlineGamesError('Çok fazla istek gönderildi; bir dakika sonra tekrar dene.');
  if (!res.ok) throw new OnlineGamesError(`Site hata döndürdü (${res.status}).`);
  return res;
}

export async function fetchLichessGames(username: string, max: number, signal?: AbortSignal): Promise<OnlineGame[]> {
  const u = cleanUsername(username);
  const res = await getOrThrow(
    `https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=${max}&pgnInJson=true&opening=true&clocks=false&evals=false`,
    { headers: { Accept: 'application/x-ndjson' }, signal },
  );
  return parseLichessNdjson(await res.text()).slice(0, max);
}

/** Chess.com oyunları aylık arşivlerde; en yeni aylardan başlayarak yeterli oyun toplanır (en fazla 6 ay). */
export async function fetchChessComGames(username: string, max: number, signal?: AbortSignal): Promise<OnlineGame[]> {
  const u = cleanUsername(username).toLowerCase();
  const res = await getOrThrow(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`, { signal });
  const archives: string[] = ((await res.json()) as { archives?: string[] }).archives ?? [];
  const games: OnlineGame[] = [];
  for (const url of archives.slice(-6).reverse()) {
    if (games.length >= max) break;
    const month = await getOrThrow(url, { signal });
    games.push(...parseChessComArchive(await month.json()));
  }
  return games.slice(0, max);
}

export function fetchOnlineGames(site: OnlineSite, username: string, max: number, signal?: AbortSignal) {
  return site === 'lichess' ? fetchLichessGames(username, max, signal) : fetchChessComGames(username, max, signal);
}

/** Kullanıcının oyundaki rengi (kullanıcı adı eşleşmesine göre); bulunamazsa undefined. */
export function userColor(game: Pick<OnlineGame, 'white' | 'black'>, username: string): 'w' | 'b' | undefined {
  const u = username.trim().toLowerCase();
  if (game.white.toLowerCase() === u) return 'w';
  if (game.black.toLowerCase() === u) return 'b';
  return undefined;
}

const SPEED_LABELS: Record<string, string> = {
  ultraBullet: 'Ultra bullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Klasik',
  correspondence: 'Yazışmalı',
  daily: 'Günlük',
};

export function speedLabel(speed?: string): string {
  return speed ? (SPEED_LABELS[speed] ?? speed) : '';
}
