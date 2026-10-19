import type { CSSProperties } from 'react';

export function Bar({ w = '100%', h = 14, style }: { w?: number | string; h?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function CardSkeleton() {
  return (
    <li className="card result-card" aria-hidden="true">
      <Bar w={64} h={24} />
      <Bar w="80%" h={18} />
      <Bar w="50%" h={12} />
      <Bar h={12} />
      <Bar w="90%" h={12} />
      <Bar w={120} h={36} style={{ marginTop: 8 }} />
    </li>
  );
}
