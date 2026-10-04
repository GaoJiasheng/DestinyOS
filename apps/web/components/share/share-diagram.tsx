import type { PublicDiagram } from '@/lib/share-projection';
/** Miniature chart renders only derived safe diagram fields, with translated labels. */
export function ShareDiagram({
  diagram,
  translate,
}: {
  diagram: PublicDiagram;
  translate: (key: string) => string;
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
        <circle cx="160" cy="160" r="140" fill="#101525" stroke="#c9a66b" strokeWidth="2" />
        <circle cx="160" cy="160" r="100" fill="none" stroke="#c9a66b" />
        {diagram.items.map((p, i) => {
          const angle = (((p.longitude ?? 0) - 90) * Math.PI) / 180,
            x = 160 + 120 * Math.cos(angle),
            y = 160 + 120 * Math.sin(angle);
          return (
            <g key={i}>
              <line x1="160" y1="160" x2={x} y2={y} stroke="#575378" />
              <circle cx={x} cy={y} r="6" fill="#c9a66b" />
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
            <span style={{ background: '#c9a66b', width: p.yang ? '100%' : '45%' }} />
            {!p.yang ? <span style={{ background: '#c9a66b', width: '45%' }} /> : null}
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
            gap: 8,
            padding: 16,
            border: '1px solid #c9a66b',
            borderRadius: 8,
            background: '#101525',
            color: '#f3eadb',
          }}
        >
          <span style={{ fontSize: 16 }}>{text(p.label)}</span>
          <span style={{ fontSize: 22 }}>{p.value.split('|').map(text).join(' · ')}</span>
        </div>
      ))}
    </div>
  );
}
