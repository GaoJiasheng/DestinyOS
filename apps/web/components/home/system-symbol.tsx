import type { System } from '@tianji/shared';
/** Lightweight animated line art; each system uses its documented motif. */
export function SystemSymbol({ system }: { system: System }) {
  return (
    <svg
      className={`system-symbol symbol-${system}`}
      viewBox="0 0 120 96"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {system === 'bazi'
        ? [30, 50, 70, 90].map((x, i) => (
            <g key={x} style={{ animationDelay: `${i * 80}ms` }}>
              <rect x={x - 7} y={18 + (i % 2) * 6} width="14" height="62" rx="2" />
              <path d={`M${x - 4} 36h8m-8 8h8m-8 16h8`} />
            </g>
          ))
        : null}
      {system === 'ziwei' ? (
        <g className="symbol-rotate">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} transform={`rotate(${i * 30} 60 48)`} d="M60 12v13m-5-8h10" />
          ))}
          <circle cx="60" cy="48" r="32" />
          <circle cx="60" cy="48" r="15" />
        </g>
      ) : null}
      {system === 'iching'
        ? Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              style={{ animationDelay: `${(5 - i) * 100}ms` }}
              d={i % 2 ? `M32 ${22 + i * 10}h22m12 0h22` : `M32 ${22 + i * 10}h56`}
              strokeWidth="3"
            />
          ))
        : null}
      {system === 'qimen'
        ? Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={31 + (i % 3) * 20}
              y={19 + Math.floor(i / 3) * 20}
              width="18"
              height="18"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))
        : null}
      {system === 'tarot' ? (
        <g className="symbol-flip">
          <rect x="39" y="14" width="42" height="68" rx="4" />
          <path d="M60 27l12 21-12 21-12-21z" />
          <circle cx="60" cy="48" r="7" />
        </g>
      ) : null}
      {system === 'astrology' ? (
        <g className="symbol-rotate">
          <circle cx="60" cy="48" r="33" />
          <circle cx="60" cy="48" r="25" />
          <path d="M60 15v66M27 48h66M40 22l40 52M40 74l40-52" />
          <circle cx="84" cy="39" r="3" />
        </g>
      ) : null}
      {system === 'numerology' ? (
        <g>
          <circle cx="60" cy="48" r="33" />
          {Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              cx={60 + 33 * Math.cos((i * Math.PI * 2) / 9)}
              cy={48 + 33 * Math.sin((i * Math.PI * 2) / 9)}
              r="3"
            />
          ))}
          <path d="M53 28h14l-14 40" />
        </g>
      ) : null}
      {system === 'vedic' ? (
        <g className="symbol-rotate">
          <ellipse cx="60" cy="48" rx="39" ry="24" />
          {Array.from({ length: 27 }, (_, i) => (
            <circle
              key={i}
              cx={60 + 39 * Math.cos((i * Math.PI * 2) / 27)}
              cy={48 + 24 * Math.sin((i * Math.PI * 2) / 27)}
              r="1.5"
              fill="currentColor"
            />
          ))}
          <path d="M60 28l18 30H42z" />
        </g>
      ) : null}
    </svg>
  );
}
