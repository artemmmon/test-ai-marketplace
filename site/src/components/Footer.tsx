import { useCatalog } from '../app/catalog';
import { commitUrl, formatDate, issueUrl } from '../data/links';
import { t } from '../i18n';
import { ExtLink } from './ExtLink';

export function Footer() {
  const { index } = useCatalog();
  return (
    <footer className="foot">
      <div className="foot-row">
        {index && index.commit && (
          <span>
            {t('footer.catalogGenerated', { date: formatDate(index.generatedAt) })}{' '}
            <ExtLink className="mono" href={commitUrl(index)} translate="no">
              {index.commit.slice(0, 7)}
            </ExtLink>
          </span>
        )}
        <span className="foot-links">
          <ExtLink href={issueUrl(index, '[site] ')}>{t('footer.reportIssue')}</ExtLink>
        </span>
      </div>
    </footer>
  );
}
