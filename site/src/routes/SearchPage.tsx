// Search screen (spec §6.3), ported from Main.dc.html, SearchMobile.dc.html
// and EmptyCatalog.dc.html. The URL is the single source of truth for the query.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { usePrefs } from '../app/prefs';
import { ArtifactCard } from '../components/ArtifactCard';
import { TypeBadge } from '../components/Badges';
import { ExtLink } from '../components/ExtLink';
import { Icon } from '../components/Icon';
import { SearchBox } from '../components/SearchField';
import { CardSkeleton } from '../components/Skeleton';
import { TYPE_ORDER, issueUrl, typeLabel } from '../data/links';
import { plural, t } from '../i18n';
import type { Filters, SortKey } from '../search/engine';
import type { ArtifactType, IndexFile } from '../types';

const PAGE = 60;
const TOP_TAGS = 6;
const SORTS: SortKey[] = ['relevance', 'name', 'updated'];

function list(value: string | null): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];
}

export function SearchPage() {
  const catalog = useCatalog();
  usePageTitle(t('common.searchLink'));

  if (catalog.status === 'error') return <CatalogError retry={catalog.retry} />;
  if (catalog.status === 'loading') return <SearchLoading />;
  if (!catalog.index.items.some((i) => i.type === 'plugin')) return <EmptyCatalog index={catalog.index} />;
  return <SearchReady />;
}

function SearchHero() {
  return (
    <div className="search-hero">
      <SearchBox id="q" variant="hero" />
    </div>
  );
}

function SearchLoading() {
  return (
    <main id="main" className="page page-search" aria-busy="true">
      <h1 className="sr-only" tabIndex={-1}>
        {t('search.heading')}
      </h1>
      <SearchHero />
      <p className="muted" aria-live="polite">
        {t('search.loading')}
      </p>
      <ul className="grid">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </main>
  );
}

function CatalogError({ retry }: { retry: () => void }) {
  return (
    <main id="main" className="page page-search">
      <section className="empty-state" style={{ paddingTop: 56 }}>
        <div>
          <h1 tabIndex={-1}>{t('common.couldntLoadCatalog')}</h1>
          <p>{t('search.error.body')}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-lg" type="button" onClick={retry}>
              {t('common.retry')}
            </button>
            <ExtLink className="btn btn-lg" href="https://github.com/artemmmon/test-ai-marketplace">
              {t('search.error.openRepository')}
            </ExtLink>
          </div>
        </div>
      </section>
    </main>
  );
}

function EmptyCatalog({ index }: { index: IndexFile }) {
  return (
    <main id="main" className="page page-search" style={{ paddingBottom: 64 }}>
      <div className="search-hero" style={{ paddingBottom: 56 }}>
        <SearchBox id="q" variant="hero" />
      </div>
      <section aria-labelledby="empty-h" className="empty-state">
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ flex: 'none' }}>
          <rect x="4" y="4" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="72" y="4" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="4" y="72" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="72" y="72" width="56" height="56" rx="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
          <path d="M100 88v24 M88 100h24" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h1 id="empty-h" tabIndex={-1}>
            {t('search.empty.title')}
          </h1>
          <p>{t('search.empty.body')}</p>
          <div className="row" style={{ gap: 10 }}>
            <ExtLink className="btn btn-primary btn-lg" href={`${index.marketplace.repo.url}#readme`}>
              {t('search.empty.howToAdd')}
            </ExtLink>
            <Link className="btn btn-lg" to="/getting-started">
              {t('common.gettingStarted')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SearchReady() {
  const catalog = useCatalog();
  const { index, engine } = catalog as Extract<typeof catalog, { status: 'ready' }>;
  const [params, setParams] = useSearchParams();
  const { text, setText } = usePrefs();
  const [limit, setLimit] = useState(PAGE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [allTags, setAllTags] = useState(false);
  const written = useRef<string | null>(null);

  const q = params.get('q') ?? '';
  const pluginNames = useMemo(() => index.items.filter((i) => i.type === 'plugin').map((i) => i.name), [index]);
  const allKeywords = useMemo(() => new Set(index.items.flatMap((i) => i.keywords)), [index]);

  const rawTypes = list(params.get('type'));
  const rawTags = list(params.get('tag'));
  const rawPlugin = params.get('plugin');
  const rawSort = params.get('sort');
  const filters: Filters = {
    types: rawTypes.filter((t): t is ArtifactType => (TYPE_ORDER as string[]).includes(t)),
    plugin: rawPlugin && pluginNames.includes(rawPlugin) ? rawPlugin : null,
    tags: rawTags.filter((t) => allKeywords.has(t)),
  };
  const sort = SORTS.some((k) => k === rawSort) ? (rawSort as SortKey) : null;

  // Unknown filter values are dropped from the URL (spec FR-50).
  useEffect(() => {
    const dirty =
      filters.types.length !== rawTypes.length ||
      filters.tags.length !== rawTags.length ||
      (rawPlugin !== null && !filters.plugin) ||
      (rawSort !== null && !sort);
    if (!dirty) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        writeList(next, 'type', filters.types);
        writeList(next, 'tag', filters.tags);
        if (!filters.plugin) next.delete('plugin');
        if (!sort) next.delete('sort');
        return next;
      },
      { replace: true },
    );
  });

  // URL → search fields (back/forward, links, header search).
  useEffect(() => {
    if (q === written.current) return;
    setText(q);
  }, [q, setText]);

  // Search fields → URL, debounced, with replace (FR-44, FR-50).
  useEffect(() => {
    if (text === q) return;
    const t = window.setTimeout(() => {
      written.current = text;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (text) next.set('q', text);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 150);
    return () => window.clearTimeout(t);
  }, [text, q, setParams]);

  const outcome = useMemo(() => engine.search(q, filters, sort), [engine, q, filters.types.join(), filters.plugin, filters.tags.join(), sort]);
  const { parsed, hits, facets, partial } = outcome;

  // A query that is only a type word becomes a type filter (FR-38).
  useEffect(() => {
    if (!parsed.typeOnly || !parsed.detectedType || filters.types.length) return;
    written.current = '';
    setText('');
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
        next.set('type', parsed.detectedType!);
        return next;
      },
      { replace: true },
    );
  }, [parsed, filters.types.length, setParams, setText]);

  useEffect(() => setLimit(PAGE), [params]);

  /** Filter changes push a history entry, so Back restores the previous filter. */
  function update(mutate: (next: URLSearchParams) => void) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    });
  }
  const toggleType = (t: ArtifactType) =>
    update((n) => writeList(n, 'type', filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t]));
  const toggleTag = (tag: string) =>
    update((n) => writeList(n, 'tag', filters.tags.includes(tag) ? filters.tags.filter((x) => x !== tag) : [...filters.tags, tag]));
  const addTag = (tag: string) => {
    if (!filters.tags.includes(tag)) toggleTag(tag);
  };
  const setPlugin = (p: string | null) => update((n) => (p ? n.set('plugin', p) : n.delete('plugin')));
  const setSort = (s: SortKey) =>
    update((n) => {
      const def = q ? 'relevance' : 'updated';
      if (s === def) n.delete('sort');
      else n.set('sort', s);
    });
  const clearAll = () =>
    update((n) => {
      n.delete('type');
      n.delete('tag');
      n.delete('plugin');
    });

  const activeCount = filters.types.length + filters.tags.length + (filters.plugin ? 1 : 0);
  const shownChip = parsed.detectedType && !filters.types.length && !parsed.typeOnly ? parsed.detectedType : null;
  const pluginTotal = [...facets.plugins.values()].reduce((a, b) => a + b, 0);
  const pluginRows = [...pluginNames].sort((a, b) => (facets.plugins.get(b) ?? 0) - (facets.plugins.get(a) ?? 0) || a.localeCompare(b));
  const tagRows = [...facets.tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const visibleTags = allTags ? tagRows : tagRows.filter(([t], i) => i < TOP_TAGS || filters.tags.includes(t));
  const effectiveSort = sort ?? (q && parsed.groups.length ? 'relevance' : 'updated');

  return (
    <main id="main" className="page page-search">
      <h1 className="sr-only" tabIndex={-1}>
        {t('search.heading')}
      </h1>
      <SearchHero />

      <div className="search-layout">
        <aside aria-label={t('search.filters.title')} className={`filters${panelOpen ? ' open' : ''}`} id="filters-panel">
          <div className="filters-panel-head">
            <h2>{t('search.filters.title')}</h2>
            <button className="btn btn-ghost btn-icon" type="button" aria-label={t('search.filters.close')} onClick={() => setPanelOpen(false)}>
              <Icon name="x" />
            </button>
          </div>
          <fieldset>
            <legend>{t('search.filters.type')}</legend>
            {TYPE_ORDER.map((t) => {
              const n = facets.types.get(t) ?? 0;
              return (
                <label className="facet" key={t} style={{ opacity: n === 0 && !filters.types.includes(t) ? 0.55 : 1 }}>
                  <input type="checkbox" checked={filters.types.includes(t)} onChange={() => toggleType(t)} />
                  <TypeBadge type={t} style={{ height: 22 }} />
                  <span className="n">{n}</span>
                </label>
              );
            })}
          </fieldset>
          <fieldset>
            <legend>{t('search.filters.plugin')}</legend>
            <label className="facet">
              <input type="radio" name="plugin" checked={!filters.plugin} onChange={() => setPlugin(null)} />
              <span className="label">{t('common.allPlugins')}</span>
              <span className="n">{pluginTotal}</span>
            </label>
            {pluginRows.map((p) => (
              <label className="facet" key={p}>
                <input type="radio" name="plugin" checked={filters.plugin === p} onChange={() => setPlugin(p)} />
                <span className="label mono" translate="no">
                  {p}
                </span>
                <span className="n">{facets.plugins.get(p) ?? 0}</span>
              </label>
            ))}
          </fieldset>
          {tagRows.length > 0 && (
            <fieldset>
              <legend>{t('search.filters.tag')}</legend>
              {visibleTags.map(([tag, n]) => (
                <label className="facet" key={tag}>
                  <input type="checkbox" checked={filters.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                  <span className="label">{tag}</span>
                  <span className="n">{n}</span>
                </label>
              ))}
              {tagRows.length > TOP_TAGS && (
                <button className="btn btn-ghost btn-link" type="button" onClick={() => setAllTags((v) => !v)}>
                  {allTags ? t('search.filters.showFewerTags') : t('search.filters.showAllTags')}
                </button>
              )}
            </fieldset>
          )}
          <div className="filters-panel-foot">
            <button className="btn btn-primary" type="button" onClick={() => setPanelOpen(false)}>
              {plural('search.results.showCount', hits.length)}
            </button>
          </div>
        </aside>

        <section aria-label={t('search.results.label')} className="results">
          <div className="toolbar">
            <p className="count" aria-live="polite">
              <strong>
                {plural('search.results.count', hits.length)}
              </strong>
              {q && <span className="muted for"> {t('search.results.forQuery', { query: q })}</span>}
            </p>
            {shownChip && (
              <button
                className={`tag type-chip t-${shownChip}`}
                type="button"
                aria-pressed="false"
                style={{ color: `var(--type-${shownChip}-fg)`, borderColor: `var(--type-${shownChip}-bg)` }}
                onClick={() => toggleType(shownChip)}
              >
                <Icon name={shownChip} />
                {t(`search.only.${shownChip}`)}
              </button>
            )}
            {partial && <span className="muted" style={{ fontSize: 14 }}>{t('search.results.partial')}</span>}
            <button
              className="btn filters-toggle"
              type="button"
              aria-expanded={panelOpen}
              aria-controls="filters-panel"
              onClick={() => setPanelOpen(true)}
            >
              <Icon name="filter" />
              {activeCount ? t('search.filters.toggleWithCount', { count: activeCount }) : t('search.filters.toggle')}
            </button>
            <div className="sort">
              <label htmlFor="sort">{t('search.sort.label')}</label>
              <select id="sort" className="select" value={effectiveSort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((k) => (
                  <option key={k} value={k}>
                    {t(`search.sort.${k}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="row active-filters" aria-label={t('search.filters.active')}>
              {filters.types.map((type) => (
                <button key={type} className="tag" type="button" onClick={() => toggleType(type)} aria-label={t('search.filters.removeType', { type: typeLabel(type) })}>
                  {typeLabel(type)} ×
                </button>
              ))}
              {filters.plugin && (
                <button className="tag mono" type="button" onClick={() => setPlugin(null)} aria-label={t('search.filters.removePlugin', { plugin: filters.plugin })}>
                  {filters.plugin} ×
                </button>
              )}
              {filters.tags.map((tag) => (
                <button key={tag} className="tag" type="button" onClick={() => toggleTag(tag)} aria-label={t('search.filters.removeTag', { tag })}>
                  #{tag} ×
                </button>
              ))}
              <button className="btn btn-ghost" type="button" style={{ height: 26, color: 'var(--accent)' }} onClick={clearAll}>
                {t('search.filters.clearAll')}
              </button>
            </div>
          )}

          {hits.length === 0 ? (
            <NoResults
              q={q}
              hasFilters={activeCount > 0}
              clearAll={clearAll}
              topTags={tagRows.length ? tagRows.slice(0, 5).map(([t]) => t) : topCatalogTags(index)}
              onTag={addTag}
              index={index}
            />
          ) : (
            <>
              <ul className="grid">
                {hits.slice(0, limit).map((hit) => (
                  <ArtifactCard key={hit.item.id} hit={hit} onTag={addTag} />
                ))}
              </ul>
              {hits.length > limit && (
                <div className="show-more">
                  <button className="btn btn-lg" type="button" onClick={() => setLimit((n) => n + PAGE)}>
                    {t('search.results.showMore')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function writeList(params: URLSearchParams, key: string, values: string[]) {
  if (values.length) params.set(key, values.join(','));
  else params.delete(key);
}

function topCatalogTags(index: IndexFile): string[] {
  const counts = new Map<string, number>();
  for (const i of index.items) for (const k of i.keywords) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

function NoResults(props: { q: string; hasFilters: boolean; clearAll: () => void; topTags: string[]; onTag: (t: string) => void; index: IndexFile }) {
  const cyrillic = /[Ѐ-ӿ]/.test(props.q);
  return (
    <div className="no-results">
      <h2>{props.q ? t('search.noResults.forQuery', { query: props.q }) : t('search.noResults.title')}</h2>
      <ul>
        {props.hasFilters && (
          <li>
            <button className="linkish" type="button" onClick={props.clearAll}>
              {t('search.noResults.resetFilters')}
            </button>
          </li>
        )}
        {cyrillic && <li>{t('search.noResults.tryEnglish')}</li>}
        <li>
          {t('search.noResults.tryTag')}{' '}
          <span className="row" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
            {props.topTags.map((t) => (
              <button key={t} className="tag" type="button" onClick={() => props.onTag(t)}>
                {t}
              </button>
            ))}
          </span>
        </li>
        <li>
          {t('search.noResults.cantFind')}{' '}
          <ExtLink href={issueUrl(props.index, `[request] ${props.q}`)}>{t('search.noResults.requestPlugin')}</ExtLink>
        </li>
      </ul>
    </div>
  );
}
