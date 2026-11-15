import { describe, expect, it } from 'vitest';
import { cacheKey, hashString, loadCachedAnalysis, saveCachedAnalysis, type KeyValueStorage } from './analysisCache';
import type { AnalysisResult } from './stockfish';

/** Bellek içi depo; `limit` karakteri aşınca kota hatası verir. */
function memoryStorage(limit = Infinity): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      const size = [...data.entries()].reduce((s, [key, val]) => s + (key === k ? 0 : val.length), 0) + v.length;
      if (size > limit) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
}

const result = (fen: string): AnalysisResult => ({
  fen,
  targetDepth: 16,
  depth: 16,
  done: true,
  lines: [{ multipv: 1, depth: 16, score: { type: 'cp', cp: 20 }, pv: Array(30).fill('e2e4') }],
});

describe('Analiz önbelleği', () => {
  it('anahtar derinliğe ve pozisyonlara bağlı', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(cacheKey(['a', 'b'], 16)).not.toBe(cacheKey(['a', 'b'], 20));
    expect(cacheKey(['a', 'b'], 16)).not.toBe(cacheKey(['a', 'c'], 16));
  });

  it('yazar ve okur; devam çizgisini kısaltır', () => {
    const storage = memoryStorage();
    const evals = [result('f1'), result('f2')];
    expect(saveCachedAnalysis('k1', evals, storage)).toBe(true);
    const loaded = loadCachedAnalysis('k1', 2, storage)!;
    expect(loaded[1].fen).toBe('f2');
    expect(loaded[0].lines[0].pv.length).toBe(12);
  });

  it('uzunluk tutmazsa ya da veri bozuksa null döner', () => {
    const storage = memoryStorage();
    saveCachedAnalysis('k1', [result('f1')], storage);
    expect(loadCachedAnalysis('k1', 2, storage)).toBeNull();
    storage.setItem('satranc-analiz:analysis:bozuk', '{nope');
    expect(loadCachedAnalysis('bozuk', 1, storage)).toBeNull();
  });

  it('depo yoksa ya da erişim hata verirse sessizce geçer', () => {
    expect(loadCachedAnalysis('k', 1, null)).toBeNull();
    expect(saveCachedAnalysis('k', [result('f')], null)).toBe(false);
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('engelli');
      },
      setItem: () => {
        throw new Error('engelli');
      },
      removeItem: () => {},
    };
    expect(loadCachedAnalysis('k', 1, broken)).toBeNull();
    expect(saveCachedAnalysis('k', [result('f')], broken)).toBe(false);
  });

  it('kota dolunca en eski kaydı siler', () => {
    // Bir kaydın depoda kapladığı gerçek boyutu ölç; iki kayıt sığsın, üçüncüsü sığmasın.
    const probe = memoryStorage();
    saveCachedAnalysis('a', [result('x')], probe);
    const one = probe.data.get('satranc-analiz:analysis:a')!.length;
    const storage = memoryStorage(one * 2 + 60);
    saveCachedAnalysis('a', [result('x')], storage);
    saveCachedAnalysis('b', [result('x')], storage);
    expect(saveCachedAnalysis('c', [result('x')], storage)).toBe(true);
    expect(loadCachedAnalysis('a', 1, storage)).toBeNull();
    expect(loadCachedAnalysis('c', 1, storage)).not.toBeNull();
  });
});
