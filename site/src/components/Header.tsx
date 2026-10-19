import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePrefs } from '../app/prefs';
import { ExtLink } from './ExtLink';
import { Icon, Logo } from './Icon';
import { HeaderSearch, SearchBox } from './SearchField';

const NAV = [
  { to: '/search', label: 'Search' },
  { to: '/whats-new', label: 'What’s new' },
  { to: '/getting-started', label: 'Getting started' },
];

export function Header() {
  const { theme, toggleTheme } = usePrefs();
  const catalog = useCatalog();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const onSearch = pathname === '/search';
  const repoUrl = catalog.index?.marketplace.repo.url ?? 'https://github.com/artemmmon/test-ai-marketplace';
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  useEffect(() => setMenuOpen(false), [pathname]);

  const themeButton = (
    <button className="btn btn-ghost btn-icon" type="button" aria-label={`Switch to ${nextTheme} theme`} onClick={toggleTheme}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );

  return (
    <header className="site-header">
      <div className="header-row">
        <Link className="brand" to="/search">
          <Logo />
          <span className="mono brand-name" translate="no">
            test-ai-marketplace
          </span>
        </Link>
        {!onSearch && <HeaderSearch />}
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {themeButton}
          <ExtLink className="btn btn-ghost btn-icon" href={repoUrl} aria-label="GitHub repository">
            <Icon name="github" />
          </ExtLink>
        </div>
        <button
          className="btn btn-ghost btn-icon menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} />
        </button>
      </div>
      <nav id="mobile-menu" className={`mobile-menu${menuOpen ? ' open' : ''}`} aria-label="Mobile">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.label}
          </NavLink>
        ))}
        <button className="menu-item" type="button" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          Switch to {nextTheme} theme
        </button>
        <ExtLink href={repoUrl}>
          <Icon name="github" />
          GitHub repository
        </ExtLink>
      </nav>
      <div className="mobile-search">
        <SearchBox id="mq" variant="mobile" />
      </div>
    </header>
  );
}
