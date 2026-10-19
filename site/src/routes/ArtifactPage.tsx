// Artifact page (spec §6.5), ported from Artifact.dc.html.
import { Link, Navigate, useParams } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { ExecBadge, TypeBadge } from '../components/Badges';
import { CopyButton, CopyInstallButton } from '../components/Copy';
import { ExtLink } from '../components/ExtLink';
import { Icon } from '../components/Icon';
import { formatJson, LoadError, Markdown, useBody } from '../components/Markdown';
import { Bar } from '../components/Skeleton';
import { blobUrl, bodyFileName, issueUrl, itemHref, TYPE_LABEL, TYPE_PLURAL } from '../data/links';
import type { IndexFile, IndexItem } from '../types';
import { NotFound } from './NotFound';
import { dirOf } from './PluginPage';

export function ArtifactPage() {
  const { id = '' } = useParams();
  const catalog = useCatalog();
  const item = catalog.index?.items.find((i) => i.id === id && i.type !== 'plugin') ?? null;
  usePageTitle(catalog.status === 'ready' ? (item ? item.qualifiedName : 'Artifact not found') : null);

  if (catalog.status === 'error') return <NotFound title="Couldn’t load the catalog" />;
  if (catalog.status === 'loading')
    return (
      <main id="main" className="page page-narrow" aria-busy="true">
        <Bar w={260} />
        <Bar w="50%" h={32} />
        <Bar w="70%" h={16} />
      </main>
    );

  if (!item) {
    // "<plugin>:<name>" (qualified name without the type) resolves when unambiguous (FR-50).
    const matches = catalog.index.items.filter((i) => i.type !== 'plugin' && i.qualifiedName === id);
    if (matches.length === 1) return <Navigate to={`/artifact/${matches[0].id}`} replace />;
    if (matches.length > 1)
      return (
        <NotFound
          title={`Several artifacts are called “${id}”`}
          message="Pick one:"
          suggestions={matches.map((m) => ({ label: `${TYPE_LABEL[m.type]} ${m.qualifiedName}`, to: itemHref(m) }))}
        />
      );
    const last = id.split(':').pop() ?? id;
    return (
      <NotFound
        title="Artifact not found"
        message={`Nothing in the catalog has the id “${id}”.`}
        suggestions={[{ label: `Search for “${last}”`, to: `/search?q=${encodeURIComponent(last)}` }]}
      />
    );
  }
  return <ArtifactView index={catalog.index} item={item} />;
}

function ArtifactView({ index, item }: { index: IndexFile; item: IndexItem }) {
  const runsCode = item.type === 'hook' || item.type === 'mcp';
  const more = index.items.filter((i) => i.plugin === item.plugin && i.type !== 'plugin' && i.id !== item.id).slice(0, 6);
  const plugin = index.items.find((i) => i.type === 'plugin' && i.name === item.plugin);

  return (
    <main id="main" className="page page-narrow">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/search">Search</Link>
        <span aria-hidden="true" className="sep">
          ›
        </span>
        <Link className="mono" to={`/plugin/${item.plugin}`} translate="no">
          {item.plugin}
        </Link>
        <span aria-hidden="true" className="sep">
          ›
        </span>
        <Link to={`/plugin/${item.plugin}?tab=${item.type === 'skill' ? 'skills' : item.type === 'agent' ? 'agents' : item.type === 'command' ? 'commands' : item.type === 'hook' ? 'hooks' : 'mcp'}`}>
          {TYPE_PLURAL[item.type]}
        </Link>
        <span aria-hidden="true" className="sep">
          ›
        </span>
        <span className="mono" aria-current="page">
          {item.name}
        </span>
      </nav>

      <div className="art-head">
        <div className="row">
          <TypeBadge type={item.type} />
          {item.executesCode && <ExecBadge />}
        </div>
        <h1 className="mono" translate="no" tabIndex={-1}>
          <span className="muted" style={{ fontWeight: 500 }}>
            {item.plugin}:
          </span>
          {item.name}
        </h1>
        <p style={{ margin: 0, fontSize: 17, maxWidth: '64ch' }}>{item.description}</p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
          Part of{' '}
          <Link className="mono" to={`/plugin/${item.plugin}`} translate="no">
            {item.plugin}
          </Link>
          {item.version && ` v${item.version}`}
          {!runsCode && plugin?.executesCode && ' · the plugin executes code'}
        </p>
        <div className="row" style={{ gap: 8, paddingTop: 4 }}>
          <CopyInstallButton command={item.installCommands.chat} plugin={item.plugin} title={`Installs the whole plugin ${item.plugin}`} />
          {item.path && (
            <ExtLink className="btn" href={blobUrl(index, item.path)}>
              <Icon name="github" />
              GitHub
            </ExtLink>
          )}
          <ExtLink className="btn" href={issueUrl(index, `[${item.id}] `)}>
            <Icon name="flag" />
            Report an issue
          </ExtLink>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>Installs the whole plugin</span>
        </div>
      </div>

      {runsCode && (
        <div role="note" className="warn note note-lg">
          <Icon name="warn" />
          <p>This code runs on your machine outside Claude’s permission rules. Read it before installing.</p>
        </div>
      )}

      <Facts item={item} />
      <BodySection item={item} />

      {item.type === 'skill' && item.files.length > 0 && (
        <section aria-labelledby="files-h" className="section" style={{ gap: 10 }}>
          <h2 id="files-h" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Other files
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {item.files.map((f) => (
              <li key={f}>
                <ExtLink className="mono" href={blobUrl(index, f)} style={{ fontSize: 13 }}>
                  {f.replace(`${dirOf(item.path)}/`, '')}
                </ExtLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {more.length > 0 && (
        <section aria-labelledby="more-h" className="section" style={{ gap: 14, paddingTop: 8 }}>
          <h2 id="more-h" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            More from{' '}
            <span className="mono" translate="no">
              {item.plugin}
            </span>
          </h2>
          <ul className="grid" style={{ gap: 12 }}>
            {more.map((m) => (
              <li key={m.id} className="card card-hover more-card">
                <TypeBadge type={m.type} />
                <Link className="title-link mono" to={itemHref(m)} style={{ fontSize: 14, fontWeight: 500 }} translate="no">
                  {m.name}
                </Link>
                <p>{m.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Chips({ values }: { values: string[] }) {
  return (
    <span className="fm-chips">
      {values.map((v) => (
        <span key={v} className="event">
          {v}
        </span>
      ))}
    </span>
  );
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) return <Chips values={value.map(String)} />;
  if (value && typeof value === 'object') return <code className="in">{JSON.stringify(value)}</code>;
  return String(value);
}

/** Frontmatter table, hook events or MCP servers. */
function Facts({ item }: { item: IndexItem }) {
  if (item.type === 'hook') {
    return (
      <section aria-labelledby="events-h" className="row" style={{ gap: 12 }}>
        <h2 id="events-h" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Events
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.events.map((e) => (
            <li key={e} className="event">
              {e}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (item.type === 'mcp') {
    return (
      <section aria-labelledby="servers-h" className="section" style={{ gap: 10 }}>
        <h2 id="servers-h" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Servers
        </h2>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Transport</th>
                <th scope="col">Command / URL</th>
              </tr>
            </thead>
            <tbody>
              {item.servers.map((s) => (
                <tr key={s.name}>
                  <td className="mono">{s.name}</td>
                  <td>{s.transport}</td>
                  <td className="mono">{s.command ?? s.url ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  if (item.type === 'plugin') return null;

  const rows: Array<[string, unknown]> = Object.entries(item.frontmatter).filter(([k]) => k !== 'tools' && k !== 'model');
  if (item.type === 'agent') {
    rows.push(['tools', item.tools ?? null], ['model', item.model ?? null]);
  }
  return (
    <section aria-labelledby="fm-h" className="section" style={{ gap: 10 }}>
      <h2 id="fm-h" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
        Frontmatter
      </h2>
      <div className="tbl-scroll">
        <table className="tbl fm-table">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="mono" style={{ width: 160 }}>
                  {k}
                </td>
                <td>{v === null ? <span className="muted">Not specified</span> : renderValue(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BodySection({ item }: { item: IndexItem }) {
  const { state, retry } = useBody(item.bodyRef);
  const file = item.path ? item.path.replace(`plugins/${item.plugin}/`, '') : bodyFileName(item);
  const isJson = item.bodyFormat === 'json';
  const text = state.status === 'ready' ? (isJson ? formatJson(state.text) : state.text) : '';

  if (!item.bodyRef) return null;
  return (
    <section aria-labelledby="body-h" className="codebox">
      <div className="codebox-head">
        <h2 id="body-h" className="mono">
          {file}
        </h2>
        {state.status === 'ready' && <CopyButton text={text} label={`Copy ${bodyFileName(item)}`} />}
      </div>
      {state.status === 'loading' && (
        <div className="md-wrap" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bar w="40%" h={18} />
          <Bar />
          <Bar w="80%" />
        </div>
      )}
      {state.status === 'error' && (
        <div className="md-wrap">
          <LoadError what={file} retry={retry} />
        </div>
      )}
      {state.status === 'ready' &&
        (isJson ? (
          <pre translate="no">
            <code>{text}</code>
          </pre>
        ) : (
          <div className="md-wrap">
            <Markdown source={text} baseDir={dirOf(item.path)} />
          </div>
        ))}
    </section>
  );
}
