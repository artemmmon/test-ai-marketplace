import type { AnchorHTMLAttributes } from 'react';

/** External link: always a new tab with rel="noopener noreferrer" (NFR-42). */
export function ExtLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}
