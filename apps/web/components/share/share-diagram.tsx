import type { PublicDiagram } from '@/lib/share-projection';
/** Miniature chart renders only derived safe diagram fields, with translated labels. */
export function ShareDiagram({
  diagram,
  translate,
  colors = {
    surface: 'var(--surface-1)',
    gold: 'var(--gold)',
    text: 'var(--text-1)',
    line: 'var(--line-2)',
  },
}: {
  diagram: PublicDiagram;
  translate: (key: string) => string;
  colors?: { surface: string; gold: string; text: string; line: string };
}) {
  const text = (key: string) => (key.includes('.') ? translate(key) : key);
  if (diagram.kind === 'wheel')
    return (
      <svg
        viewBox="0 0 320 320"
        width="240"
        height="240"
        role="img"
        aria-label={translate('share.diagram')}
      >
        <circle
          cx="160"
          cy="160"
          r="140"
          fill={colors.surface}
          stroke={colors.gold}
          strokeWidth="2"
        />
        <circle cx="160" cy="160" r="100" fill="none" stroke={colors.gold} />
        {diagram.items.map((p, i) => {
          const angle = (((p.longitude ?? 0) - 90) * Math.PI) / 180,
            radius = p.label === 'synastry.b' ? 86 : 120,
            x = 160 + radius * Math.cos(angle),
            y = 160 + radius * Math.sin(angle);
          return (
            <g key={i}>
              <line x1="160" y1="160" x2={x} y2={y} stroke={colors.line} />
              <circle
                cx={x}
                cy={y}
                r="6"
                fill={p.label === 'synastry.b' ? colors.line : colors.gold}
              />
              <title>
                {text(p.label)} · {text(p.value)}
              </title>
            </g>
          );
        })}
      </svg>
    );
  if (diagram.kind === 'hexagram')
    return (
      <div
        style={{ display: 'flex', flexDirection: 'column-reverse', gap: 8, width: 180 }}
        aria-label={text(diagram.items[0]?.label ?? 'share.diagram')}
      >
        {diagram.items.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 18, height: 10 }}>
            <span style={{ background: colors.gold, width: p.yang ? '100%' : '45%' }} />
            {!p.yang ? <span style={{ background: colors.gold, width: '45%' }} /> : null}
          </div>
        ))}
      </div>
    );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {diagram.items.slice(0, 12).map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            ...(diagram.kind === 'pillars' ? { width: '45%', maxWidth: 180 } : {}),
            gap: 8,
            padding: 16,
            border: `1px solid ${colors.gold}`,
            borderRadius: 8,
            background: colors.surface,
            color: colors.text,
          }}
        >
          <span style={{ fontSize: 16 }}>{text(p.label)}</span>
          <span style={{ fontSize: 22 }}>{p.value.split('|').map(text).join(' · ')}</span>
        </div>
      ))}
    </div>
  );
}
