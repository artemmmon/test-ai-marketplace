// Plugin page (spec §6.4), ported from Plugin.dc.html.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { usePrefs } from '../app/prefs';
import { ExecBadge, ExternalBadge, TypeBadge, VersionBadge } from '../components/Badges';
import { Slip } from '../components/Copy';
import { ExtLink } from '../components/ExtLink';
import { Icon } from '../components/Icon';
import { Body, Markdown, useBody, LoadError } from '../components/Markdown';
import { Bar } from '../components/Skeleton';
import { loadReleases } from '../data/catalog';
import { blobUrl, bodyFileName, composition, formatDate, issueUrl, tagUrl, treeUrl, typePlural } from '../data/links';
import { t } from '../i18n';
import type { ComponentType, IndexFile, IndexItem, PluginItem, Release } from '../types';
import { NotFound } from './NotFound';

type TabKey = ComponentType | 'bin';
/** Values of `--scope`, shown as written in the command. */
const SCOPES = ['project', 'user'] as const;
const TAB_ORDER: TabKey[] = ['skill', 'agent', 'command', 'hook', 'mcp', 'bin'];
const TAB_PARAM: Record<TabKey, string> = { skill: 'skills', agent: 'agents', command: 'commands', hook: 'hooks', mcp: 'mcp', bin: 'bin' };

export function PluginPage() {
  const { name = '' } = useParams();
  const catalog = useCatalog();
  const plugin = catalog.index?.items.find((i): i is PluginItem => i.type === 'plugin' && i.name === name) ?? null;
  usePageTitle(catalog.status === 'ready' ? (plugin ? name : t('plugin.notFoundTitle')) : null);

  if (catalog.status === 'error') return <NotFound title={t('common.couldntLoadCatalog')} />;
  if (catalog.status === 'loading') return <PluginSkeleton />;
  if (!plugin) {
    const similar = catalog.index.items
      .filter((i) => i.type === 'plugin')
      .map((i) => ({ name: i.name, d: similarity(name, i.name) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3)
      .map((s) => s.name);
    return <NotFound title={t('plugin.notFoundNamed', { name })} suggestions={similar.map((s) => ({ label: s, to: `/plugin/${s}` }))} />;
  }
  return <PluginView index={catalog.index} plugin={plugin} />;
}

/** Shared-prefix similarity, good enough to suggest a few names. */
function similarity(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  const common = [...new Set(a)].filter((c) => b.includes(c)).length;
  return n * 2 + common;
}

function PluginSkeleton() {
  return (
    <main id="main" className="page" aria-busy="true">
      <Bar w={160} h={14} style={{ marginBottom: 18 }} />
      <Bar w={120} h={24} style={{ marginBottom: 12 }} />
      <Bar w="40%" h={36} style={{ marginBottom: 12 }} />
      <Bar w="70%" h={16} />
      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        <Bar w={110} h={42} />
        <Bar w={110} h={42} />
        <Bar w={110} h={42} />
      </div>
    </main>
  );
}

function PluginView({ index, plugin }: { index: IndexFile; plugin: PluginItem }) {
  const byName = useMemo(() => new Map(index.items.filter((i): i is PluginItem => i.type === 'plugin').map((p) => [p.name, p])), [index]);
  const external = plugin.source === 'external';
  const src = external ? plugin.external?.url ?? null : plugin.path ? treeUrl(index, plugin.path) : null;

  return (
    <main id="main" className="page">
      <nav aria-label={t('common.breadcrumb')} className="breadcrumb" style={{ marginBottom: 18 }}>
        <Link to="/search">{t('common.searchLink')}</Link>
        <span aria-hidden="true" className="sep">
          ›
        </span>
        <span className="mono" aria-current="page" translate="no">
          {plugin.name}
        </span>
      </nav>
      <div className="plugin-head">
        <div className="plugin-head-main">
          <div className="row">
            <TypeBadge type="plugin" />
            {plugin.version && <VersionBadge version={plugin.version} />}
            {external && <ExternalBadge />}
            {plugin.executesCode && <ExecBadge />}
          </div>
          <h1 className="mono" translate="no" tabIndex={-1}>
            {plugin.name}
          </h1>
          <p className="lede">{plugin.description}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {src && (
            <ExtLink className="btn" href={src}>
              <Icon name={external ? 'external' : 'github'} />
              {external ? t('common.source') : t('common.github')}
            </ExtLink>
          )}
          <ExtLink className="btn" href={issueUrl(index, `[${plugin.name}] `)}>
            <Icon name="flag" />
            {t('common.reportIssue')}
          </ExtLink>
        </div>
      </div>

      <div className="plugin-body">
        <div className="plugin-main">
          <InstallBlock index={index} plugin={plugin} byName={byName} />
          <DetailsAside index={index} plugin={plugin} mobileOnly />
          <Dependencies plugin={plugin} byName={byName} />
          <Contents index={index} plugin={plugin} />
          <Readme plugin={plugin} />
          <Changelog index={index} plugin={plugin} />
        </div>
        <DetailsAside index={index} plugin={plugin} />
      </div>
    </main>
  );
}

/** Reasons a plugin executes code, including its transitive dependencies. */
function execReasons(plugin: PluginItem): string[] {
  const r: string[] = [];
  if (plugin.components.hook.length) r.push(t('plugin.install.reason.hooks'));
  if (plugin.components.mcp.length) r.push(t('plugin.install.reason.mcp'));
  if (plugin.bin.length) r.push(t('plugin.install.reason.bin'));
  return r;
}

function transitiveDeps(plugin: PluginItem, byName: Map<string, PluginItem>): PluginItem[] {
  const seen = new Map<string, PluginItem>();
  const walk = (p: PluginItem) => {
    for (const d of p.dependencies) {
      const dep = byName.get(d.name);
      if (dep && !seen.has(dep.name)) {
        seen.set(dep.name, dep);
        walk(dep);
      }
    }
  };
  walk(plugin);
  return [...seen.values()];
}

function InstallBlock({ index, plugin, byName }: { index: IndexFile; plugin: PluginItem; byName: Map<string, PluginItem> }) {
  const { installMode } = usePrefs();
  const [scope, setScope] = useState<'project' | 'user'>('project');
  const terminal = installMode === 'terminal';
  const own = execReasons(plugin);
  const deps = transitiveDeps(plugin, byName).filter((d) => d.executesCode);
  const add = terminal ? index.marketplace.addCommands.cli : index.marketplace.addCommands.chat;
  const install = terminal ? (scope === 'project' ? plugin.installCommands.cliProject : plugin.installCommands.cliUser) : plugin.installCommands.chat;

  return (
    <section aria-labelledby="install-h" className="card install">
      <div className="spread">
        <h2 className="sec" id="install-h">
          {t('plugin.install.title')}
        </h2>
        <ModeSwitch />
      </div>
      <div className="step">
        <span className="num" aria-hidden="true">
          1
        </span>
        <div className="step-body">
          <p className="step-title">{t('plugin.install.addMarketplace')}</p>
          <Slip command={add} prompt={terminal} label={t('plugin.install.addMarketplaceLabel')} />
        </div>
      </div>
      <div className="step">
        <span className="num" aria-hidden="true">
          2
        </span>
        <div className="step-body">
          <div className="spread" style={{ minHeight: 28 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{t('plugin.install.installPlugin')}</p>
            {terminal && (
              <div className="row" style={{ gap: 8 }}>
                <span id="scope-l" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('plugin.install.scope')}
                </span>
                <div className="seg" role="group" aria-labelledby="scope-l">
                  {SCOPES.map((s) => (
                    <button key={s} type="button" aria-pressed={scope === s} title={t(`plugin.install.scopeTitle.${s}`)} onClick={() => setScope(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Slip command={install} prompt={terminal} label={t('plugin.install.installLabel', { plugin: plugin.name })} />
        </div>
      </div>
      <div className="install-notes">
        <p>
          {t('plugin.install.wholePlugin')}
          {plugin.dependencies.length > 0 && (
            <>
              {' '}
              {t('plugin.install.dependenciesAuto')}{' '}
              {plugin.dependencies.map((d, i) => (
                <span key={d.name}>
                  {i > 0 && ', '}
                  <Link className="mono" to={`/plugin/${d.name}`} translate="no">
                    {d.name}
                  </Link>
                </span>
              ))}
              .
            </>
          )}
        </p>
        {(own.length > 0 || deps.length > 0) && (
          <div role="note" className="warn note">
            <Icon name="warn" />
            <div>
              {own.length > 0 && (
                <>
                  <strong style={{ fontWeight: 600 }}>{t('plugin.install.executesTitle')}</strong> {t('plugin.install.executesIt', { reasons: joinWords(own) })}{' '}
                </>
              )}
              {deps.length > 0 && (
                <>
                  <strong style={{ fontWeight: 600 }}>{t('plugin.install.dependenciesExecuteTitle')}</strong>{' '}
                  {deps.map((d, i) => (
                    <span key={d.name}>
                      {i > 0 && (i === deps.length - 1 ? ` ${t('common.and')} ` : ', ')}
                      <span className="mono" style={{ fontSize: 13 }}>
                        {d.name}
                      </span>{' '}
                      {joinWords(execReasons(d).length ? execReasons(d) : [t('plugin.install.reason.generic')])}
                    </span>
                  ))}
                  , {t('plugin.install.dependenciesOutside')}{' '}
                </>
              )}
              {t('plugin.install.readBefore')}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${t('common.and')} ${words[words.length - 1]}`;
}

/** In chat | In terminal switch, shared with Getting started and remembered. */
export function ModeSwitch() {
  const { installMode, setInstallMode } = usePrefs();
  const refs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = installMode === 'chat' ? 'terminal' : 'chat';
    setInstallMode(next);
    refs[next === 'chat' ? 0 : 1].current?.focus();
  };
  return (
    <div className="seg" role="tablist" aria-label={t('plugin.modeSwitch.label')} onKeyDown={onKey}>
      <button ref={refs[0]} type="button" role="tab" aria-selected={installMode === 'chat'} tabIndex={installMode === 'chat' ? 0 : -1} onClick={() => setInstallMode('chat')}>
        {t('plugin.modeSwitch.chat')}
      </button>
      <button ref={refs[1]} type="button" role="tab" aria-selected={installMode === 'terminal'} tabIndex={installMode === 'terminal' ? 0 : -1} onClick={() => setInstallMode('terminal')}>
        {t('plugin.modeSwitch.terminal')}
      </button>
    </div>
  );
}

function Dependencies({ plugin, byName }: { plugin: PluginItem; byName: Map<string, PluginItem> }) {
  return (
    <section aria-labelledby="deps-h" className="section">
      <h2 className="sec" id="deps-h">
        {t('plugin.dependencies.title')}
      </h2>
      {plugin.dependencies.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t('plugin.dependencies.none')}
        </p>
      ) : (
        <>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{t('plugin.dependencies.name')}</th>
                  <th scope="col">{t('plugin.dependencies.required')}</th>
                  <th scope="col">{t('plugin.dependencies.resolved')}</th>
                  <th scope="col">{t('plugin.dependencies.status')}</th>
                </tr>
              </thead>
              <tbody>
                {plugin.dependencies.map((d) => (
                  <tr key={d.name}>
                    <td>
                      {byName.has(d.name) ? (
                        <Link className="mono" to={`/plugin/${d.name}`}>
                          {d.name}
                        </Link>
                      ) : (
                        <span className="mono">{d.name}</span>
                      )}
                    </td>
                    <td className="mono">{d.range}</td>
                    <td className="mono">{d.resolvedVersion ?? '—'}</td>
                    <td>
                      {d.status === 'satisfied' ? (
                        <span className="badge ok">
                          <Icon name="check" />
                          {t('plugin.dependencies.satisfied')}
                        </span>
                      ) : (
                        <span className="badge warn">
                          <Icon name="warn" />
                          {t('common.notInCatalog')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details open className="details">
            <summary>{t('plugin.dependencies.tree')}</summary>
            <ul className="tree" translate="no">
              <TreeNode plugin={plugin} byName={byName} trail={[]} />
            </ul>
          </details>
        </>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {t('plugin.dependencies.usedBy')}{' '}
        {plugin.usedBy.length === 0
          ? t('plugin.dependencies.usedByNone')
          : plugin.usedBy.map((u, i) => (
              <span key={u}>
                {i > 0 && ', '}
                <Link className="mono" to={`/plugin/${u}`}>
                  {u}
                </Link>
              </span>
            ))}
      </p>
    </section>
  );
}

function TreeNode({ plugin, byName, trail }: { plugin: PluginItem; byName: Map<string, PluginItem>; trail: string[] }) {
  const children = plugin.dependencies;
  return (
    <li>
      {plugin.name} <span className="v">{plugin.version}</span>
      {children.length > 0 && !trail.includes(plugin.name) && (
        <ul>
          {children.map((d) => {
            const dep = byName.get(d.name);
            return dep ? (
              <TreeNode key={d.name} plugin={dep} byName={byName} trail={[...trail, plugin.name]} />
            ) : (
              <li key={d.name}>
                {d.name} <span className="v">{t('plugin.dependencies.treeNotInCatalog')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Contents({ index, plugin }: { index: IndexFile; plugin: PluginItem }) {
  const [params, setParams] = useSearchParams();
  const tabs = TAB_ORDER.filter((t) => (t === 'bin' ? plugin.bin.length > 0 : plugin.components[t].length > 0));
  const fromUrl = TAB_ORDER.find((t) => TAB_PARAM[t] === params.get('tab'));
  const active: TabKey | undefined = fromUrl && tabs.includes(fromUrl) ? fromUrl : tabs[0];
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (plugin.source === 'external') {
    return (
      <section aria-labelledby="contents-h" className="section">
        <h2 className="sec" id="contents-h">
          {t('plugin.contents.title')}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('plugin.contents.externalNotIndexed')}{' '}
          {plugin.external && <ExtLink href={plugin.external.url}>{t('plugin.contents.viewSource')}</ExtLink>}
        </p>
      </section>
    );
  }
  if (!active) return null;

  const select = (t: TabKey) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', TAB_PARAM[t]);
        return next;
      },
      { replace: true },
    );
  };
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.indexOf(active);
    let next: TabKey | null = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };
  const label = (tab: TabKey) => {
    if (tab === 'bin') return t('plugin.contents.tabBin', { count: plugin.bin.length });
    if (tab === 'hook') return typePlural('hook');
    return t('plugin.contents.tabCount', { label: typePlural(tab), count: plugin.components[tab].length });
  };
  const items = active === 'bin' ? [] : plugin.components[active].map((id) => index.items.find((i) => i.id === id)).filter((i): i is IndexItem => !!i);

  return (
    <section aria-labelledby="contents-h" className="section" style={{ gap: 8 }}>
      <h2 className="sec" id="contents-h">
        {t('plugin.contents.title')}
      </h2>
      <div className="tabs" role="tablist" aria-label={t('plugin.contents.tabsLabel')} onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={t === active}
            aria-controls={`panel-${t}`}
            tabIndex={t === active ? 0 : -1}
            onClick={() => select(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>
      <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="tabpanel">
        {(active === 'hook' || active === 'mcp' || active === 'bin') && (
          <div role="note" className="warn note">
            <Icon name="warn" />
            <p>{t('common.runsOutsidePermissions')}</p>
          </div>
        )}
        {active === 'bin' ? (
          <ul className="bin-list">
            {plugin.bin.map((f) => (
              <li key={f}>
                <ExtLink className="mono" href={blobUrl(index, `${plugin.path}/bin/${f}`)}>
                  bin/{f}
                </ExtLink>
              </li>
            ))}
          </ul>
        ) : (
          items.map((item) => <Accordion key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}

function Accordion({ item }: { item: IndexItem }) {
  const [open, setOpen] = useState(false);
  const bodyId = `body-${item.id.replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div className="acc">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
          <span className="acc-text">
            <span className="mono nm" translate="no">
              <span className="muted">{item.plugin}:</span>
              {item.name}
            </span>
            <span className="ds">{item.description}</span>
          </span>
        </button>
      </h3>
      {open && (
        <div id={bodyId} className="acc-body">
          <div className="acc-body-head">
            <span className="mono">{bodyFileName(item)}</span>
            <Link to={`/artifact/${item.id}`}>{t('plugin.contents.openPage')}</Link>
          </div>
          {item.bodyRef && item.bodyFormat ? (
            <Body bodyRef={item.bodyRef} format={item.bodyFormat} baseDir={dirOf(item.path)} what={bodyFileName(item)} />
          ) : (
            <p className="muted">{t('plugin.contents.noContent')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function dirOf(path: string | null): string {
  if (!path) return '';
  return /\.[a-z]+$/i.test(path) ? path.split('/').slice(0, -1).join('/') : path;
}

function Readme({ plugin }: { plugin: PluginItem }) {
  return (
    <section aria-labelledby="readme-h" className="section">
      <h2 className="sec" id="readme-h">
        {t('plugin.readme.title')}
      </h2>
      {plugin.readmeRef ? (
        <ReadmeBody refPath={plugin.readmeRef} baseDir={plugin.path ?? ''} />
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('plugin.readme.none')}
        </p>
      )}
    </section>
  );
}

function ReadmeBody({ refPath, baseDir }: { refPath: string; baseDir: string }) {
  const { state, retry } = useBody(refPath);
  if (state.status === 'loading') return <Bar w="70%" />;
  if (state.status === 'error') return <LoadError what={t('plugin.readme.title')} retry={retry} />;
  return <Markdown source={state.text} baseDir={baseDir} />;
}

function Changelog({ index, plugin }: { index: IndexFile; plugin: PluginItem }) {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let alive = true;
    loadReleases().then(
      (r) => alive && setReleases(r.releases.filter((x) => x.plugin === plugin.name)),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [plugin.name]);

  const shown = releases ? (all ? releases : releases.slice(0, 3)) : [];
  return (
    <section aria-labelledby="changelog-h" className="section">
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <h2 className="sec" id="changelog-h">
          {t('plugin.changelog.title')}
        </h2>
        <Link to={`/whats-new?plugin=${plugin.name}`} style={{ fontSize: 14 }}>
          {t('plugin.changelog.allReleases')}
        </Link>
      </div>
      {failed && <p className="muted">{t('plugin.changelog.couldntLoad')}</p>}
      {!releases && !failed && <Bar w="50%" />}
      {releases && releases.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          {t('plugin.changelog.none')}
        </p>
      )}
      {shown.map((r) => (
        <article key={r.id} id={`release-${r.version}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="mono">{r.version}</span>
            {r.date && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>{formatDate(r.date)}</span>}
            {r.tag ? (
              <ExtLink className="mono" href={tagUrl(index, r.tag)} style={{ fontSize: 13, fontWeight: 400 }}>
                {r.tag}
              </ExtLink>
            ) : (
              <span className="badge neutral">{t('plugin.changelog.untagged')}</span>
            )}
          </h3>
          {r.notesMarkdown ? <Markdown source={r.notesMarkdown} baseDir={plugin.path ?? ''} /> : <p className="muted">{t('plugin.changelog.noNotes')}</p>}
        </article>
      ))}
      {releases && releases.length > 3 && (
        <button className="btn btn-ghost btn-link" type="button" onClick={() => setAll((v) => !v)}>
          {all ? t('plugin.changelog.showFewer') : t('plugin.changelog.showAll', { count: releases.length })}
        </button>
      )}
    </section>
  );
}

function DetailsAside({ index, plugin, mobileOnly }: { index: IndexFile; plugin: PluginItem; mobileOnly?: boolean }) {
  const [compatOpen, setCompatOpen] = useState(false);
  const owner = plugin.owner ?? (plugin.source === 'local' ? index.marketplace.owner : null);
  const latest = plugin.latestRelease;
  return (
    <aside aria-label={t('plugin.aside.label')} className={`card plugin-aside ${mobileOnly ? 'aside-mobile' : 'aside-desktop'}`}>
      <h2>{t('plugin.aside.title')}</h2>
      <dl className="meta">
        <dt>{t('plugin.aside.version')}</dt>
        <dd className="mono">{plugin.version ?? '—'}</dd>
        <dt>{t('plugin.aside.owner')}</dt>
        <dd>{owner?.name ?? t('plugin.aside.unknownOwner')}</dd>
        <dt>{t('plugin.aside.license')}</dt>
        <dd className={plugin.license ? undefined : 'muted'}>{plugin.license ?? t('common.notSpecified')}</dd>
        <dt>{t('plugin.aside.compatibility')}</dt>
        <dd>
          {plugin.compatibility?.claudeCode ? (
            <>
              {t('plugin.aside.claudeCode')} <span className="mono">{plugin.compatibility.claudeCode}</span>
              {plugin.compatibility.bodyRef && (
                <>
                  {' '}
                  <button className="linkish" type="button" aria-expanded={compatOpen} onClick={() => setCompatOpen((o) => !o)}>
                    {t('plugin.aside.compatibilityDetails')}
                  </button>
                </>
              )}
            </>
          ) : (
            <span className="muted">{t('common.notSpecified')}</span>
          )}
          {compatOpen && plugin.compatibility?.bodyRef && (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              <Body bodyRef={plugin.compatibility.bodyRef} format="markdown" baseDir={plugin.path ?? ''} what="COMPATIBILITY.md" />
            </div>
          )}
        </dd>
        <dt>{t('plugin.aside.source')}</dt>
        <dd>
          {plugin.external ? (
            <>
              {plugin.external.kind}:{' '}
              <ExtLink className="mono" href={plugin.external.url} style={{ fontSize: 13 }}>
                {plugin.external.url.replace(/^https?:\/\//, '')}
              </ExtLink>
              {(plugin.external.ref || plugin.external.sha) && (
                <>
                  <br />
                  <span className="mono muted" style={{ fontSize: 13 }}>
                    {plugin.external.ref ?? plugin.external.sha?.slice(0, 7)}
                  </span>
                </>
              )}
            </>
          ) : plugin.path ? (
            <ExtLink className="mono" href={treeUrl(index, plugin.path)} style={{ fontSize: 13 }}>
              {plugin.path}
            </ExtLink>
          ) : (
            '—'
          )}
        </dd>
        <dt>{t('plugin.aside.latestRelease')}</dt>
        <dd>
          {latest ? (
            <>
              <span className="mono">{latest.version}</span>
              {latest.date && `, ${formatDate(latest.date)}`}
              {latest.tag && (
                <>
                  <br />
                  <ExtLink className="mono" href={tagUrl(index, latest.tag)} style={{ fontSize: 13 }}>
                    {latest.tag}
                  </ExtLink>
                </>
              )}
            </>
          ) : (
            <span className="muted">{t('plugin.aside.noRelease')}</span>
          )}
        </dd>
        <dt>{t('plugin.aside.contents')}</dt>
        <dd>{composition(plugin)}</dd>
        {plugin.keywords.length > 0 && (
          <>
            <dt>{t('plugin.aside.keywords')}</dt>
            <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {plugin.keywords.map((k) => (
                <Link key={k} className="tag" to={`/search?tag=${encodeURIComponent(k)}`}>
                  {k}
                </Link>
              ))}
            </dd>
          </>
        )}
      </dl>
    </aside>
  );
}
