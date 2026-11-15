import { useEffect } from 'react';
import { useAnalysisStore, useStoredEval } from '../store/analysisStore';
import { useEngineStore } from '../store/engineStore';
import { getEngine } from './stockfish';

/**
 * Ekrandaki pozisyon veya derinlik değiştikçe motoru o pozisyonda çalıştırır.
 * Tam-oyun analizi sürerken ya da pozisyonun yeterli derinlikte sonucu zaten varken çalışmaz.
 */
export function useLiveAnalysis(fen: string) {
  const depth = useEngineStore((s) => s.depth);
  const status = useEngineStore((s) => s.status);
  const gameAnalysisRunning = useAnalysisStore((s) => s.status === 'running');
  const stored = useStoredEval();
  const hasStored = stored !== undefined && stored.targetDepth >= depth;

  useEffect(() => {
    const { setStatus } = useEngineStore.getState();
    getEngine()
      .whenReady()
      .then(() => setStatus('ready'))
      .catch((e: Error) => setStatus('error', e.message));
  }, []);

  useEffect(() => {
    if (status !== 'ready' || gameAnalysisRunning || hasStored) return;
    const engine = getEngine();
    void engine.analyze(fen, depth, (result) => useEngineStore.getState().setLive(result));
  }, [fen, depth, status, gameAnalysisRunning, hasStored]);
}
