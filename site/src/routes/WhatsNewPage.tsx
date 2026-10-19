// What's new (spec §6.6). Not in the design boards: uses the plugin page's
// changelog styles in a single narrow column.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { ExtLink } from '../components/ExtLink';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { Bar } from '../components/Skeleton';
import { asset, loadReleases } from '../data/catalog';
import { formatDate, formatMonth, tagUrl } from '../data/links';
import type { Release } from '../types';

export function WhatsNewPage() {
  usePageTitle('What’s new');
  const { index } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const highlighted = params.get('release');
  const plugin = params.get('plugin');
  const scrolled = useRef(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadReleases().then(
      (r) => alive && setReleases(r.releases),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const plugins = useMemo(() => [...new Set((releases ?? []).map((r) => r.plugin))].sort(), [releases]);
  const shown = (releases ?? []).filter((r) => !plugin || r.plugin === plugin);
  const groups = new Map<string, Release[]>();
  for (const r of shown) {
    const key = r.date ? r.date.slice(0, 7) : 'undated';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  useEffect(() => {
    if (!releases || !highlighted || scrolled.current) return;
    scrolled.current = true;
    document.getElementById(`r-${highlighted}`)?.scrollIntoView({ block: 'center' });
  }, [releases, highlighted]);

  return (
    <main id="main" className="page page-doc" aria-busy={!releases && !failed}>
      <div className="gs-head">
        <div>
          <h1 tabIndex={-1}>What’s new</h1>
          <p className="lede" style={{ maxWidth: '52ch' }}>
            Releases of plugins in the catalog, newest first.
          </p>
        </div>
        <a className="btn" href={asset('feed.xml')}>
          <Icon name="rss" />
          Subscribe (Atom)
        </a>
      </div>

      {plugins.length > 1 && (
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <label htmlFor="wn-plugin" className="muted" style={{ fontSize: 14 }}>
            Plugin
          </label>
          <select
            id="wn-plugin"
            className="select"
            value={plugin ?? ''}
            onChange={(e) =>
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (e.target.value) next.set('plugin', e.target.value);
                else next.delete('plugin');
                next.delete('release');
                return next;
              })
            }
          >
            <option value="">All plugins</option>
            {plugins.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {failed && (
        <p className="muted">
          Couldn’t load releases.{' '}
          <button className="linkish" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </p>
      )}
      {!releases && !failed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 24 }}>
          <Bar w="30%" h={18} />
          <Bar w="60%" />
          <Bar w="50%" />
        </div>
      )}
      {releases && shown.length === 0 && <p className="muted">No releases yet.</p>}

      {[...groups.entries()].map(([month, list]) => (
        <section key={month} aria-labelledby={`m-${month}`}>
          <h2 id={`m-${month}`} className="release-month">
            {month === 'undated' ? 'Undated' : formatMonth(month)}
          </h2>
          {list.map((r) => (
            <article key={r.id} id={`r-${r.id}`} className={`release${highlighted === r.id ? ' highlighted' : ''}`}>
              <h3>
                <Link className="mono" to={`/plugin/${r.plugin}`} translate="no">
                  {r.plugin}
                </Link>
                <span className="mono">v{r.version}</span>
                {r.date && <span className="date">{formatDate(r.date)}</span>}
                {r.tag && index ? (
                  <ExtLink className="mono tagref" href={tagUrl(index, r.tag)}>
                    {r.tag}
                  </ExtLink>
                ) : (
                  <span className="badge neutral">untagged</span>
                )}
              </h3>
              {r.notesMarkdown ? <Markdown source={r.notesMarkdown} baseDir={`plugins/${r.plugin}`} /> : <p className="muted">No release notes.</p>}
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
