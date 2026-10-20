// Getting started (spec §6.7), ported from GettingStarted.dc.html.
import { Link } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { usePrefs } from '../app/prefs';
import { Slip } from '../components/Copy';
import { Icon } from '../components/Icon';
import { t } from '../i18n';
import { ModeSwitch } from './PluginPage';

const FALLBACK = {
  name: 'test-ai-marketplace',
  addCommands: {
    chat: '/plugin marketplace add artemmmon/test-ai-marketplace',
    cli: 'claude plugin marketplace add artemmmon/test-ai-marketplace',
  },
};

// Technical tokens shown inside <code>; they are not translated.
const EXAMPLE_COMPONENT = 'engineering-paved-path:code-review';
const PLUGIN_PLACEHOLDER = '<plugin>';
const SCOPE_PROJECT = '--scope project';
const SCOPE_USER = '--scope user';
const VERSION_FIELD = 'version';
const BIN_DIR = 'bin/';

export function GettingStartedPage() {
  usePageTitle(t('gettingStarted.title'));
  const { index } = useCatalog();
  const { installMode } = usePrefs();
  const terminal = installMode === 'terminal';
  const mp = index?.marketplace ?? FALLBACK;
  const add = terminal ? mp.addCommands.cli : mp.addCommands.chat;
  const install = terminal ? `claude plugin install <plugin>@${mp.name} --scope project` : `/plugin install <plugin>@${mp.name}`;
  const update = terminal ? `claude plugin marketplace update ${mp.name}` : `/plugin marketplace update ${mp.name}`;

  return (
    <main id="main" className="page page-doc">
      <div className="gs-head">
        <div>
          <h1 tabIndex={-1}>{t('gettingStarted.title')}</h1>
          <p className="lede" style={{ maxWidth: '52ch' }}>
            {t('gettingStarted.lede')}
          </p>
        </div>
        <ModeSwitch />
      </div>

      <section className="gs-step" aria-labelledby="s1">
        <span className="num" aria-hidden="true">
          1
        </span>
        <div>
          <h2 id="s1">{t('gettingStarted.add.title')}</h2>
          <p>{t('gettingStarted.add.body')}</p>
          <Slip command={add} label={t('gettingStarted.add.label')} />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s2">
        <span className="num" aria-hidden="true">
          2
        </span>
        <div>
          <h2 id="s2">{t('gettingStarted.find.title')}</h2>
          <p>
            {t('gettingStarted.find.body')}{' '}
            <code className="in">{EXAMPLE_COMPONENT}</code>.
          </p>
          <p style={{ margin: 0 }}>
            <Link to="/search">{t('gettingStarted.find.search')}</Link>
          </p>
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s3">
        <span className="num" aria-hidden="true">
          3
        </span>
        <div>
          <h2 id="s3">{t('gettingStarted.install.title')}</h2>
          <p>
            {t('gettingStarted.install.replace')} <code className="in">{PLUGIN_PLACEHOLDER}</code> {t('gettingStarted.install.withPluginName')}{' '}
            <code className="in">{SCOPE_PROJECT}</code> {t('gettingStarted.install.installsForProject')} <code className="in">{SCOPE_USER}</code>{' '}
            {t('gettingStarted.install.forAllProjects')}
          </p>
          <Slip command={install} label={t('gettingStarted.install.label')} />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s4">
        <span className="num" aria-hidden="true">
          4
        </span>
        <div>
          <h2 id="s4">{t('gettingStarted.installed.title')}</h2>
          <p>{t('gettingStarted.installed.body')}</p>
          <Slip command="claude plugin list --json" label={t('gettingStarted.installed.label')} />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s5">
        <span className="num" aria-hidden="true">
          5
        </span>
        <div>
          <h2 id="s5">{t('gettingStarted.update.title')}</h2>
          <p>
            {t('gettingStarted.update.beforeVersion')} <code className="in">{VERSION_FIELD}</code> {t('gettingStarted.update.afterVersion')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Slip command={update} label={t('gettingStarted.update.updateLabel')} />
            <Slip command="/reload-plugins" label={t('gettingStarted.update.reloadLabel')} />
          </div>
        </div>
      </section>

      <div className="gs-cards">
        <section aria-labelledby="sec-h" className="warn">
          <h2 id="sec-h">
            <Icon name="warn" />
            {t('gettingStarted.security.title')}
          </h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            {t('gettingStarted.security.beforeBin')}{' '}
            <code className="mono" style={{ fontSize: 13 }}>
              {BIN_DIR}
            </code>{' '}
            {t('gettingStarted.security.afterBin')}
          </p>
        </section>
      </div>
    </main>
  );
}
