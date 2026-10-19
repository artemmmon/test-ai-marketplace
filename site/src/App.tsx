import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { CatalogProvider } from './app/catalog';
import { PrefsProvider } from './app/prefs';
import { ToastProvider } from './app/toast';
import { DemoBanner } from './components/DemoBanner';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { ArtifactPage } from './routes/ArtifactPage';
import { GettingStartedPage } from './routes/GettingStartedPage';
import { NotFound } from './routes/NotFound';
import { PluginPage } from './routes/PluginPage';
import { SearchPage } from './routes/SearchPage';
import { WhatsNewPage } from './routes/WhatsNewPage';

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/** "/" focuses the visible search field unless the user is already typing. */
function useSlashHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      const input = [...document.querySelectorAll<HTMLInputElement>('[data-search-input]')].find((el) => el.offsetParent !== null);
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** On route change: scroll to the top and move focus to the page heading. */
function useRouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isFirstRoute()) {
      window.scrollTo(0, 0);
      const t = window.setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }), 60);
      return () => window.clearTimeout(t);
    }
  }, [pathname]);
}

let firstRoute = true;
function isFirstRoute(): boolean {
  const first = firstRoute;
  firstRoute = false;
  return first;
}

function Layout() {
  useSlashHotkey();
  useRouteFocus();
  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => {
        e.preventDefault();
        const target = document.querySelector<HTMLElement>('main h1');
        target?.focus({ preventScroll: true });
        document.getElementById('main')?.scrollIntoView();
      }}>
        Skip to content
      </a>
      <Header />
      <DemoBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/plugin/:name" element={<PluginPage />} />
        <Route path="/artifact/:id" element={<ArtifactPage />} />
        <Route path="/whats-new" element={<WhatsNewPage />} />
        <Route path="/getting-started" element={<GettingStartedPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <PrefsProvider>
        <CatalogProvider>
          <ToastProvider>
            <Layout />
          </ToastProvider>
        </CatalogProvider>
      </PrefsProvider>
    </HashRouter>
  );
}
