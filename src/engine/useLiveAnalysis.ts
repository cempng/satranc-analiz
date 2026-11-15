import { useEffect } from 'react';
import { useAnalysisStore, useStoredEval } from '../store/analysisStore';
import { useEngineStore } from '../store/engineStore';
import { useGameStore } from '../store/gameStore';
import { usePracticeStore } from '../store/practiceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useStatsStore } from '../store/statsStore';
import { getEngine, setEngineFlavor } from './stockfish';

/**
 * Ekrandaki pozisyon veya derinlik değiştikçe motoru o pozisyonda çalıştırır.
 * - Pozisyonun yeterli derinlikte sonucu zaten varsa çalışmaz.
 * - Tam-oyun analizi sürerken çalışmaz; ancak varyant incelenirken analizi duraklatıp varyantı hesaplar.
 * - Alıştırma modunda (cevabı ele vermemek için) ve toplu analiz sırasında çalışmaz.
 */
export function useLiveAnalysis(fen: string) {
  const depth = useEngineStore((s) => s.depth);
  const status = useEngineStore((s) => s.status);
  const flavor = useSettingsStore((s) => s.engine);
  const gameAnalysisRunning = useAnalysisStore((s) => s.status === 'running');
  const inVariant = useGameStore((s) => s.variant !== null);
  const practiceActive = usePracticeStore((s) => s.active);
  const batchRunning = useStatsStore((s) => s.status === 'running');
  const stored = useStoredEval();
  const hasStored = stored !== undefined && stored.targetDepth >= depth;

  // Motoru (ve motor türü değişince yenisini) başlat.
  useEffect(() => {
    const engineStore = useEngineStore.getState();
    if (setEngineFlavor(flavor)) {
      // Eski motorun işleri yarım kaldı: analizleri iptal et, yeni motorla yeniden başlat.
      const analysis = useAnalysisStore.getState();
      const wasAnalyzing = analysis.status === 'running' || analysis.status === 'done';
      analysis.cancel();
      useStatsStore.getState().cancel();
      engineStore.setLive(null);
      engineStore.setStatus('loading');
      void getEngine()
        .whenReady()
        .then(() => {
          useEngineStore.getState().setStatus('ready');
          const game = useGameStore.getState().game;
          if (wasAnalyzing && game) void useAnalysisStore.getState().start(game, useEngineStore.getState().depth);
        })
        .catch((e: Error) => useEngineStore.getState().setStatus('error', e.message));
      return;
    }
    getEngine()
      .whenReady()
      .then(() => engineStore.setStatus('ready'))
      .catch((e: Error) => engineStore.setStatus('error', e.message));
  }, [flavor]);

  useEffect(() => {
    if (status !== 'ready' || practiceActive || batchRunning) return;
    const analysis = useAnalysisStore.getState();
    if (gameAnalysisRunning) {
      if (!inVariant) {
        analysis.resume();
        return;
      }
      analysis.pause();
    }
    if (hasStored) return;
    void getEngine().analyze(fen, depth, (result) => useEngineStore.getState().setLive(result));
  }, [fen, depth, status, gameAnalysisRunning, inVariant, hasStored, practiceActive, batchRunning]);
}
