import { createContext, forwardRef, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { CustomSquareProps, CustomSquareRenderer } from 'react-chessboard/dist/chessboard/types';
import { Chess, type Square } from 'chess.js';
import type { MoveClass } from '../analysis/moveClasses';
import { useAnalysisStore, useDisplayedAnalysis } from '../store/analysisStore';
import { useEngineStore } from '../store/engineStore';
import { useCurrentFen, useGameStore, useLastMove } from '../store/gameStore';
import { MoveClassIcon } from './MoveClassIcon';

const LAST_MOVE_STYLE = { backgroundColor: 'rgba(250, 204, 21, 0.38)' };
const BEST_MOVE_ARROW_COLOR = 'rgba(34, 197, 94, 0.85)';

/** Kapsayıcının genişliğini ölçer; tahta boyutunu kendimiz veririz. */
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Rozetin gösterileceği kare ve sınıf. */
const BadgeContext = createContext<{ square?: Square; cls?: MoveClass; size: number }>({ size: 0 });

/** Hamlenin hedef karesine sağ üst köşede sınıf rozeti ekleyen kare bileşeni. */
const BadgeSquare = forwardRef<HTMLDivElement, Omit<CustomSquareProps, 'ref'>>(({ children, square, style }, ref) => {
  const badge = useContext(BadgeContext);
  const show = badge.cls && badge.square === square;
  return (
    <div ref={ref} style={{ ...style, position: 'relative' }}>
      {children}
      {show && (
        <div className="pointer-events-none absolute z-10 drop-shadow" style={{ top: -badge.size * 0.3, right: -badge.size * 0.3 }}>
          <MoveClassIcon cls={badge.cls!} size={badge.size} />
        </div>
      )}
    </div>
  );
});

export function Board() {
  const [containerRef, width] = useContainerWidth();
  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const orientation = useGameStore((s) => s.orientation);
  const fen = useCurrentFen();
  const analysis = useDisplayedAnalysis();
  const showBestArrow = useEngineStore((s) => s.showBestArrow);
  const analyzedGame = useAnalysisStore((s) => s.game);
  const classification = useAnalysisStore((s) => s.classification);

  const inVariant = useGameStore((s) => s.variant !== null);
  const playMove = useGameStore((s) => s.playMove);
  const lastMove = useLastMove();
  const squareStyles = lastMove ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE } : {};
  // Rozet yalnızca ana hattaki (sınıflandırılmış) hamlelerde gösterilir.
  const lastClass = !inVariant && lastMove && analyzedGame === game ? classification?.moves[ply - 1]?.cls : undefined;

  const best = analysis?.lines[0]?.pv[0];
  const arrows: [Square, Square, string][] =
    showBestArrow && best ? [[best.slice(0, 2) as Square, best.slice(2, 4) as Square, BEST_MOVE_ARROW_COLOR]] : [];

  const badgeSize = Math.max(16, Math.round(width / 8 / 2.6));

  return (
    // Rozetlerin taşabilmesi için dış kapsayıcıda overflow gizlenmez.
    <div ref={containerRef} className="w-full rounded-md shadow-2xl shadow-black/50">
      <BadgeContext.Provider value={{ square: lastMove?.to, cls: lastClass, size: badgeSize }}>
        {width > 0 && (
          <Chessboard
            id="analysis-board"
            boardWidth={width}
            position={fen}
            boardOrientation={orientation}
            arePiecesDraggable
            onPieceDrop={(from, to, piece) => {
              // Terfi seçiminde parça "wQ" biçiminde gelir; normal hamlede terfi yok sayılır.
              const isPawnPromotion = piece[1] !== 'P' && /[18]$/.test(to) && new Chess(fen).get(from)?.type === 'p';
              return playMove(from, to, isPawnPromotion ? piece[1].toLowerCase() : undefined);
            }}
            showBoardNotation
            animationDuration={150}
            customSquare={BadgeSquare as unknown as CustomSquareRenderer}
            customSquareStyles={squareStyles}
            customArrows={arrows}
            customDarkSquareStyle={{ backgroundColor: '#5b7083' }}
            customLightSquareStyle={{ backgroundColor: '#d9e1e8' }}
          />
        )}
      </BadgeContext.Provider>
    </div>
  );
}
