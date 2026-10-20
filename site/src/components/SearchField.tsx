// Search inputs bound to the shared search text. "/" focuses the visible one
// (see App), Esc clears it, a second Esc removes focus (spec §6.2).
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { usePrefs } from '../app/prefs';
import { t } from '../i18n';
import { Icon } from './Icon';

function useSearchHandlers() {
  const { text, setText } = usePrefs();
  const navigate = useNavigate();
  const onSearchPage = useLocation().pathname === '/search';
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (e.currentTarget.value) setText('');
      else e.currentTarget.blur();
    } else if (e.key === 'Enter' && !onSearchPage) {
      navigate(`/search${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ''}`);
    }
  };
  return { text, setText, onKeyDown };
}

/** Large field on the search page (desktop board) and in the mobile header. */
export function SearchBox({ id, variant }: { id: string; variant: 'hero' | 'mobile' }) {
  const { text, setText, onKeyDown } = useSearchHandlers();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {t('search.fieldLabel')}
      </label>
      <div className="searchbox">
        <Icon name="search" />
        <input
          id={id}
          data-search-input=""
          type="search"
          role="searchbox"
          value={text}
          placeholder={t('search.placeholder')}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {variant === 'hero' && <kbd aria-hidden="true">/</kbd>}
        {text && (
          <button className="btn btn-ghost btn-icon" type="button" aria-label={t('search.clear')} onClick={() => setText('')}>
            <Icon name="x" />
          </button>
        )}
      </div>
    </>
  );
}

/** Compact field in the desktop header on pages other than search. */
export function HeaderSearch() {
  const { text, setText, onKeyDown } = useSearchHandlers();
  return (
    <div className="hsearch">
      <Icon name="search" style={{ color: 'var(--text-muted)' }} />
      <label htmlFor="hq" className="sr-only">
        {t('search.headerFieldLabel')}
      </label>
      <input
        id="hq"
        data-search-input=""
        type="search"
        role="searchbox"
        value={text}
        placeholder={t('search.placeholder')}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <kbd aria-hidden="true">/</kbd>
    </div>
  );
}
