// UI preferences shared across pages: theme, install mode and the search text.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { readStorage, writeStorage } from '../data/storage';

export type Theme = 'dark' | 'light';
export type InstallMode = 'chat' | 'terminal';

interface Prefs {
  theme: Theme;
  toggleTheme(): void;
  installMode: InstallMode;
  setInstallMode(mode: InstallMode): void;
  /** Text in the search fields; the URL holds the committed query. */
  text: string;
  setText(text: string): void;
}

const PrefsContext = createContext<Prefs | null>(null);

function initialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

function initialMode(): InstallMode {
  return readStorage('tam-install-mode') === 'terminal' ? 'terminal' : 'chat';
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [installMode, setMode] = useState<InstallMode>(initialMode);
  const [text, setText] = useState('');

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      writeStorage('tam-theme', next);
      return next;
    });
  }, []);

  const setInstallMode = useCallback((mode: InstallMode) => {
    setMode(mode);
    writeStorage('tam-install-mode', mode);
  }, []);

  return (
    <PrefsContext.Provider value={{ theme, toggleTheme, installMode, setInstallMode, text, setText }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs outside PrefsProvider');
  return ctx;
}
