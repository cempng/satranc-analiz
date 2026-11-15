import { MOVE_CLASS_META, type MoveClass } from '../analysis/moveClasses';

/** Sınıflandırma rozeti: renkli daire içinde özgün simge. */
export function MoveClassIcon({ cls, size = 18, className = '' }: { cls: MoveClass; size?: number; className?: string }) {
  const meta = MOVE_CLASS_META[cls];
  const long = meta.symbol.length > 1 && meta.symbol !== 'book';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={meta.label}
    >
      <title>{meta.label}</title>
      <circle cx="10" cy="10" r="9.5" fill={meta.color} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      {meta.symbol === 'book' ? (
        // Açık kitap
        <path
          d="M4.5 6.2c1.9-.6 3.8-.4 5.5.7 1.7-1.1 3.6-1.3 5.5-.7v7.6c-1.9-.6-3.8-.4-5.5.7-1.7-1.1-3.6-1.3-5.5-.7z M10 6.9v7.6"
          fill="none"
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="10"
          y="10.5"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
          fontSize={long ? 9.5 : 12}
          letterSpacing={long ? -0.6 : 0}
        >
          {meta.symbol}
        </text>
      )}
    </svg>
  );
}
