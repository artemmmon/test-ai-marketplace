import type { Part } from '../search/engine';

/** Renders highlight parts as text; React escapes everything (FR-46). */
export function Highlight({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}
