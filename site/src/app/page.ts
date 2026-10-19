// Per-route document title (spec NFR-30).
import { useEffect } from 'react';

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — test-ai-marketplace` : 'test-ai-marketplace';
  }, [title]);
}
