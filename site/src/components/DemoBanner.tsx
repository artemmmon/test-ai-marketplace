import { useCatalog } from '../app/catalog';
import { t } from '../i18n';
import { Icon } from './Icon';

/** Shown while index.json comes from the fictitious fixtures (fixture: true). */
export function DemoBanner() {
  const { index } = useCatalog();
  if (!index?.fixture) return null;
  return (
    <div className="demo-banner" role="note">
      <div>
        <Icon name="info" style={{ width: 14, height: 14 }} />
        {t('demoBanner.text')}
      </div>
    </div>
  );
}
