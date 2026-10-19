// Result card (spec FR-51), ported from Main.dc.html / SearchMobile.dc.html.
import { Link } from 'react-router';
import { useCatalog } from '../app/catalog';
import { bodyFileName, composition, dependencySummary, itemHref, sourceUrl } from '../data/links';
import { highlight, hasMark, snippet, type Hit } from '../search/engine';
import { ExecBadge, ExternalBadge, TypeBadge } from './Badges';
import { CopyInstallButton } from './Copy';
import { ExtLink } from './ExtLink';
import { Highlight } from './Highlight';
import { Icon } from './Icon';

export function ArtifactCard({ hit, onTag }: { hit: Hit; onTag: (tag: string) => void }) {
  const { index } = useCatalog();
  const { item, terms } = hit;
  const isPlugin = item.type === 'plugin';
  const nameParts = highlight(item.name, terms);
  const descParts = highlight(item.description, terms);
  const body = !hasMark(nameParts) && !hasMark(descParts) && item.searchText ? snippet(item.searchText, terms) : null;
  const src = index ? sourceUrl(index, item) : null;
  const external = isPlugin && item.source === 'external';
  const tags = item.keywords.slice(0, 4);
  const more = item.keywords.length - tags.length;

  return (
    <li className="card card-hover result-card">
      <div className="row">
        <TypeBadge type={item.type} />
        {external && <ExternalBadge />}
        {item.executesCode && <ExecBadge />}
      </div>
      <h3 className="mono" translate="no">
        <Link className="title-link" to={itemHref(item)}>
          {!isPlugin && <span className="muted">{item.plugin}:</span>}
          <Highlight parts={nameParts} />
        </Link>
      </h3>
      {isPlugin ? (
        <p className="card-meta">
          {item.version ? `v${item.version} · ` : ''}
          {composition(item)} · {dependencySummary(item)}
        </p>
      ) : (
        <p className="card-meta">
          in{' '}
          <Link className="mono" to={`/plugin/${item.plugin}`} translate="no" style={{ fontSize: 12.5 }}>
            {item.plugin}
          </Link>
          {item.version ? ` · v${item.version}` : ''}
        </p>
      )}
      <p className="card-desc">
        <Highlight parts={descParts} />
      </p>
      {body && (
        <p className="card-snippet">
          Matched in {bodyFileName(item)}: <Highlight parts={body} />
        </p>
      )}
      {tags.length > 0 && (
        <div className="row">
          {tags.map((tag) => (
            <button key={tag} className="tag" type="button" onClick={() => onTag(tag)} aria-label={`Filter by tag ${tag}`}>
              {tag}
            </button>
          ))}
          {more > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{more}</span>}
        </div>
      )}
      <div className="card-actions">
        <CopyInstallButton
          command={item.installCommands.chat}
          plugin={item.plugin}
          title={isPlugin ? `Copies ${item.installCommands.chat}` : `Installs the whole plugin ${item.plugin}`}
        />
        <Link className="btn" to={itemHref(item)} aria-label={`View ${item.qualifiedName}`}>
          View
        </Link>
        {src &&
          (external ? (
            <ExtLink className="btn push" href={src}>
              Source
            </ExtLink>
          ) : (
            <ExtLink className="btn btn-ghost btn-icon push" href={src} aria-label="View source on GitHub">
              <Icon name="github" />
            </ExtLink>
          ))}
      </div>
    </li>
  );
}
