import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useCatalog } from '../app/catalog';
import { useToast } from '../app/toast';
import { loadBody } from '../data/catalog';
import { t } from '../i18n';
import { Bar } from './Skeleton';

/** Renders markdown through marked + DOMPurify, loaded lazily (FR-61). */
export function Markdown({ source, baseDir }: { source: string; baseDir: string }) {
  const { index } = useCatalog();
  const { copy } = useToast();
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (!index) return;
    import('../markdown/render').then(({ renderMarkdown }) => {
      if (!alive) return;
      setHtml(
        renderMarkdown(source, {
          repoUrl: index.marketplace.repo.url,
          repoSlug: index.marketplace.repo.slug,
          commit: index.commit,
          baseDir,
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [source, baseDir, index]);

  // Code blocks get a Copy button (FR-63).
  useEffect(() => {
    const root = ref.current;
    if (!root || html === null) return;
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('pre-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'pre-wrap';
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn pre-copy';
      button.textContent = t('common.copy');
      button.setAttribute('aria-label', t('copy.code'));
      button.addEventListener('click', () => void copy(pre.textContent ?? ''));
      wrap.appendChild(button);
    });
  }, [html, copy]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as Element).closest('a[data-anchor]');
    if (!a) return;
    e.preventDefault();
    const target = ref.current?.querySelector(`[id="${a.getAttribute('data-anchor')}"]`);
    target?.scrollIntoView({ block: 'start' });
  };

  if (html === null) return <Bar h={14} w="60%" />;
  // Only DOMPurify output reaches the DOM (NFR-40).
  return <div ref={ref} className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

type BodyState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; text: string };

export function useBody(ref: string | null) {
  const [state, setState] = useState<BodyState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    setState({ status: 'loading' });
    loadBody(ref).then(
      (text) => alive && setState({ status: 'ready', text }),
      () => alive && setState({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [ref, attempt]);
  return { state, retry: () => setAttempt((n) => n + 1) };
}

/** Keeps already formatted JSON as written; pretty-prints minified JSON. */
export function formatJson(text: string): string {
  try {
    const value = JSON.parse(text);
    return text.trim().includes('\n') ? text.trimEnd() : JSON.stringify(value, null, 2);
  } catch {
    return text;
  }
}

export function LoadError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <p className="muted" style={{ margin: 0 }}>
      {t('common.couldntLoad', { what })}{' '}
      <button className="linkish" type="button" onClick={retry}>
        {t('common.retry')}
      </button>
    </p>
  );
}

/** Lazy body: markdown or pretty-printed JSON. */
export function Body({ bodyRef, format, baseDir, what }: { bodyRef: string; format: 'markdown' | 'json'; baseDir: string; what: string }) {
  const { state, retry } = useBody(bodyRef);
  if (state.status === 'loading')
    return (
      <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bar w="40%" h={18} />
        <Bar />
        <Bar w="85%" />
      </div>
    );
  if (state.status === 'error') return <LoadError what={what} retry={retry} />;
  if (format === 'json')
    return (
      <pre className="mono" style={{ margin: 0, overflowX: 'auto', fontSize: 13, lineHeight: 1.7 }} translate="no">
        <code>{formatJson(state.text)}</code>
      </pre>
    );
  return <Markdown source={state.text} baseDir={baseDir} />;
}
