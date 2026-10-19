import { useCatalog } from '../app/catalog';
import { asset } from '../data/catalog';
import { commitUrl, formatDate, issueUrl } from '../data/links';
import { ExtLink } from './ExtLink';

export function Footer() {
  const { index } = useCatalog();
  return (
    <footer className="foot">
      <div className="foot-row">
        {index && (
          <span>
            Catalog generated {formatDate(index.generatedAt)} from{' '}
            <ExtLink className="mono" href={commitUrl(index)} translate="no">
              {index.commit.slice(0, 7)}
            </ExtLink>
          </span>
        )}
        <span className="foot-links">
          <a className="mono" href={asset('catalog.json')}>
            catalog.json
          </a>
          <a className="mono" href={asset('llms.txt')}>
            llms.txt
          </a>
          <a className="mono" href={asset('feed.xml')}>
            feed.xml
          </a>
          <ExtLink href={issueUrl(index, '[site] ')}>Report an issue</ExtLink>
        </span>
      </div>
    </footer>
  );
}
