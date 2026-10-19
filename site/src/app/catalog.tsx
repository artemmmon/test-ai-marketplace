// Loads index.json once and builds the search engine (spec NFR-21).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadIndex } from '../data/catalog';
import { createEngine, type Engine } from '../search/engine';
import type { IndexFile } from '../types';

type CatalogState =
  | { status: 'loading'; index: null; engine: null; retry: () => void }
  | { status: 'error'; index: null; engine: null; retry: () => void }
  | { status: 'ready'; index: IndexFile; engine: Engine; retry: () => void };

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState<IndexFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadIndex().then(
      (data) => alive && setIndex(data),
      (err) => {
        console.error("Couldn't load the catalog", err);
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const engine = useMemo(() => (index ? createEngine(index.items) : null), [index]);

  const value: CatalogState = useMemo(() => {
    if (index && engine) return { status: 'ready', index, engine, retry };
    if (failed) return { status: 'error', index: null, engine: null, retry };
    return { status: 'loading', index: null, engine: null, retry };
  }, [index, engine, failed, retry]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog outside CatalogProvider');
  return ctx;
}
