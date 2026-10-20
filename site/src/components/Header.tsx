import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePrefs } from '../app/prefs';
import { t } from '../i18n';
import { ExtLink } from './ExtLink';
import { Icon, Logo } from './Icon';
import { HeaderSearch, SearchBox } from './SearchField';

const NAV = [
  { to: '/search', label: 'header.nav.search' },
  { to: '/whats-new', label: 'header.nav.whatsNew' },
  { to: '/getting-started', label: 'header.nav.gettingStarted' },
] as const;

export function Header() {
  const { theme, toggleTheme } = usePrefs();
  const catalog = useCatalog();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const onSearch = pathname === '/search';
  const repoUrl = catalog.index?.marketplace.repo.url ?? 'https://github.com/artemmmon/test-ai-marketplace';
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const switchLabel = t(`header.switchTo.${nextTheme}`);

  useEffect(() => setMenuOpen(false), [pathname]);

  const themeButton = (
    <button className="btn btn-ghost btn-icon" type="button" aria-label={switchLabel} onClick={toggleTheme}>
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
        <nav className="nav" aria-label={t('header.mainNavLabel')}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {themeButton}
          <ExtLink className="btn btn-ghost btn-icon" href={repoUrl} aria-label={t('header.githubRepository')}>
            <Icon name="github" />
          </ExtLink>
        </div>
        <button
          className="btn btn-ghost btn-icon menu-toggle"
          type="button"
          aria-label={menuOpen ? t('header.closeMenu') : t('header.openMenu')}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} />
        </button>
      </div>
      <nav id="mobile-menu" className={`mobile-menu${menuOpen ? ' open' : ''}`} aria-label={t('header.mobileNavLabel')}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            {t(n.label)}
          </NavLink>
        ))}
        <button className="menu-item" type="button" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          {switchLabel}
        </button>
        <ExtLink href={repoUrl}>
          <Icon name="github" />
          {t('header.githubRepository')}
        </ExtLink>
      </nav>
      <div className="mobile-search">
        <SearchBox id="mq" variant="mobile" />
      </div>
    </header>
  );
}
