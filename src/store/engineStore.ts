import { create } from 'zustand';
import { DEFAULT_DEPTH } from '../analysis/config';
import type { AnalysisResult } from '../engine/stockfish';

interface EngineState {
  status: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  depth: number;
  showBestArrow: boolean;
  /** Ekrandaki pozisyonun canlı analizi (son gelen güncelleme). */
  live: AnalysisResult | null;

  setStatus: (status: EngineState['status'], errorMessage?: string) => void;
  setDepth: (depth: number) => void;
  toggleBestArrow: () => void;
  setLive: (live: AnalysisResult | null) => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  status: 'loading',
  errorMessage: null,
  depth: DEFAULT_DEPTH,
  showBestArrow: true,
  live: null,

  setStatus: (status, errorMessage) => set({ status, errorMessage: errorMessage ?? null }),
  setDepth: (depth) => set({ depth }),
  toggleBestArrow: () => set((s) => ({ showBestArrow: !s.showBestArrow })),
  setLive: (live) => set({ live }),
}));
