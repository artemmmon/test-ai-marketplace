// 404 and "not found" variants. Not in the design boards: built from the
// EmptyCatalog layout and the same tokens.
import { Link } from 'react-router';
import { usePageTitle } from '../app/page';

interface Props {
  title?: string;
  message?: string;
  suggestions?: Array<{ label: string; to: string }>;
}

export function NotFound({ title = 'Page not found', message, suggestions = [] }: Props) {
  usePageTitle(title);
  return (
    <main id="main" className="page" style={{ paddingTop: 56 }}>
      <section className="empty-state">
        <svg width="96" height="96" viewBox="0 0 132 132" aria-hidden="true" style={{ flex: 'none' }}>
          <rect x="4" y="4" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="72" y="4" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="4" y="72" width="56" height="56" rx="10" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 6" />
          <rect x="72" y="72" width="56" height="56" rx="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
          <path d="M92 92l16 16 M108 92l-16 16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h1 tabIndex={-1}>{title}</h1>
          <p>{message ?? 'The address may be mistyped, or the item was removed from the catalog.'}</p>
          {suggestions.length > 0 && (
            <ul style={{ margin: '0 0 20px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map((s) => (
                <li key={s.to}>
                  <Link className="mono" to={s.to}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn btn-primary btn-lg" to="/search">
              Go to search
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
