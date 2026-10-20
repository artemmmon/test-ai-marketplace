// Per-route document title (spec NFR-30).
import { useEffect } from 'react';
import { t } from '../i18n';

// The brand name is an identifier, not copy.
const SITE_NAME = 'test-ai-marketplace';

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? t('page.title', { page: title, site: SITE_NAME }) : SITE_NAME;
  }, [title]);
}
