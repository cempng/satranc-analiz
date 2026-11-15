import { fenTurn, parseInfo, toWhiteScore, type Score } from './uci';

export interface EngineLine {
  multipv: number;
  depth: number;
  /** Beyaz perspektifinden. */
  score: Score;
  /** UCI formatında devam çizgisi. */
  pv: string[];
}

export interface AnalysisResult {
  fen: string;
  /** İstenen derinlik. */
  targetDepth: number;
  /** Şu ana kadar ulaşılan derinlik. */
  depth: number;
  /** multipv sırasına göre (1 = en iyi). */
  lines: EngineLine[];
  bestMove?: string;
  done: boolean;
}

interface Job {
  fen: string;
  depth: number;
  lines: Map<number, EngineLine>;
  cancelled: boolean;
  /** Sonuç yeterli görüldüğü için erken durduruldu (iptal değil). */
  stopping?: boolean;
  onUpdate?: (r: AnalysisResult) => void;
  resolve: (r: AnalysisResult | null) => void;
}

export const MULTI_PV = 3;
/** Mat bulunduktan sonra, mat uzunluğunun (yarım hamle) üstüne aranacak ek derinlik. */
const MATE_EXTRA_DEPTH = 6;
const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;

/**
 * Stockfish Web Worker'ı için UCI sarmalayıcı.
 * Aynı anda tek arama çalışır; yeni istek gelirse eskisi durdurulur (sonuç null döner).
 */
export class StockfishEngine {
  private worker: Worker;
  private ready: Promise<void>;
  private current: Job | null = null;
  private pending: Job | null = null;
  private waiters: { token: string; resolve: () => void }[] = [];

  constructor(url = ENGINE_URL) {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.onerror = (e) => reject(new Error(e.message || 'Motor yüklenemedi'));
      this.send('uci');
      this.waitFor('uciok')
        .then(() => {
          this.send(`setoption name MultiPV value ${MULTI_PV}`);
          this.send('isready');
          return this.waitFor('readyok');
        })
        .then(resolve);
    });
  }

  whenReady() {
    return this.ready;
  }

  /** Pozisyonu verilen derinliğe kadar analiz eder. Başka bir istekle iptal edilirse null döner. */
  async analyze(fen: string, depth: number, onUpdate?: (r: AnalysisResult) => void): Promise<AnalysisResult | null> {
    await this.ready;
    return new Promise((resolve) => {
      const job: Job = { fen, depth, lines: new Map(), cancelled: false, onUpdate, resolve };
      if (this.current) {
        if (this.pending) this.pending.resolve(null);
        this.pending = job;
        if (!this.current.cancelled) {
          this.current.cancelled = true;
          this.send('stop');
        }
      } else {
        this.start(job);
      }
    });
  }

  /** Çalışan ve bekleyen analizi iptal eder. */
  stop() {
    if (this.pending) {
      this.pending.resolve(null);
      this.pending = null;
    }
    if (this.current && !this.current.cancelled) {
      this.current.cancelled = true;
      this.send('stop');
    }
  }

  terminate() {
    this.stop();
    this.worker.terminate();
  }

  private start(job: Job) {
    this.current = job;
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${job.depth}`);
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(token: string) {
    return new Promise<void>((resolve) => this.waiters.push({ token, resolve }));
  }

  private snapshot(job: Job, done: boolean, bestMove?: string): AnalysisResult {
    const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
    return { fen: job.fen, targetDepth: job.depth, depth: lines[0]?.depth ?? 0, lines, bestMove, done };
  }

  private onLine(line: string) {
    const waiter = this.waiters.find((w) => line.startsWith(w.token));
    if (waiter) {
      this.waiters = this.waiters.filter((w) => w !== waiter);
      waiter.resolve();
      return;
    }

    const job = this.current;
    if (!job) return;

    if (line.startsWith('info ')) {
      if (job.cancelled) return;
      const info = parseInfo(line);
      if (!info) return;
      job.lines.set(info.multipv, {
        multipv: info.multipv,
        depth: info.depth,
        score: toWhiteScore(info.scoreType, info.scoreValue, fenTurn(job.fen)),
        pv: info.pv,
      });
      // Tüm MultiPV satırları aynı derinliğe gelince bildir (ekranda titremeyi azaltır).
      const first = job.lines.get(1);
      if (first && [...job.lines.values()].every((l) => l.depth === first.depth)) {
        job.onUpdate?.(this.snapshot(job, false));
        // Mat bulunduysa hedef derinliğe kadar aramaya gerek yok (mat pozisyonlarında arama çok uzar).
        if (!job.stopping && first.score.type === 'mate' && first.depth >= 2 * first.score.moves + MATE_EXTRA_DEPTH) {
          job.stopping = true;
          this.send('stop');
        }
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      this.current = null;
      if (job.cancelled) {
        job.resolve(null);
      } else {
        const move = line.split(/\s+/)[1];
        const result = this.snapshot(job, true, move && move !== '(none)' ? move : undefined);
        job.onUpdate?.(result);
        job.resolve(result);
      }
      if (this.pending) {
        const next = this.pending;
        this.pending = null;
        this.start(next);
      }
    }
  }
}

let shared: StockfishEngine | null = null;

/** Uygulama genelinde tek motor örneği. */
export function getEngine(): StockfishEngine {
  shared ??= new StockfishEngine();
  return shared;
}
