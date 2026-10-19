// Getting started (spec §6.7), ported from GettingStarted.dc.html.
import { Link } from 'react-router';
import { useCatalog } from '../app/catalog';
import { usePageTitle } from '../app/page';
import { usePrefs } from '../app/prefs';
import { Slip } from '../components/Copy';
import { Icon } from '../components/Icon';
import { asset } from '../data/catalog';
import { ModeSwitch } from './PluginPage';

const FALLBACK = {
  name: 'test-ai-marketplace',
  addCommands: {
    chat: '/plugin marketplace add artemmmon/test-ai-marketplace',
    cli: 'claude plugin marketplace add artemmmon/test-ai-marketplace',
  },
};

export function GettingStartedPage() {
  usePageTitle('Getting started');
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
          <h1 tabIndex={-1}>Getting started</h1>
          <p className="lede" style={{ maxWidth: '52ch' }}>
            Add the marketplace to Claude Code, install a plugin and keep it up to date.
          </p>
        </div>
        <ModeSwitch />
      </div>

      <section className="gs-step" aria-labelledby="s1">
        <span className="num" aria-hidden="true">
          1
        </span>
        <div>
          <h2 id="s1">Add the marketplace</h2>
          <p>Run this once. Claude Code remembers the marketplace afterwards.</p>
          <Slip command={add} label="Copy the add marketplace command" />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s2">
        <span className="num" aria-hidden="true">
          2
        </span>
        <div>
          <h2 id="s2">Find a plugin</h2>
          <p>
            Skills, agents and commands come inside plugins. You always install the whole plugin, not a single skill. Components have namespaced names like{' '}
            <code className="in">engineering-paved-path:code-review</code>.
          </p>
          <p style={{ margin: 0 }}>
            <Link to="/search">Search the catalog</Link>
          </p>
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s3">
        <span className="num" aria-hidden="true">
          3
        </span>
        <div>
          <h2 id="s3">Install</h2>
          <p>
            Replace <code className="in">&lt;plugin&gt;</code> with the plugin name. In the terminal, <code className="in">--scope project</code> installs for the current
            project and <code className="in">--scope user</code> for all your projects.
          </p>
          <Slip command={install} label="Copy the install command" />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s4">
        <span className="num" aria-hidden="true">
          4
        </span>
        <div>
          <h2 id="s4">Check what’s installed</h2>
          <p>Runs in the terminal.</p>
          <Slip command="claude plugin list --json" label="Copy the list command" />
        </div>
      </section>

      <section className="gs-step" aria-labelledby="s5">
        <span className="num" aria-hidden="true">
          5
        </span>
        <div>
          <h2 id="s5">Update</h2>
          <p>
            Auto-update is off by default for third-party marketplaces and is unreliable, so update by hand. A new version arrives only after the plugin’s{' '}
            <code className="in">version</code> is bumped.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Slip command={update} label="Copy the update command" />
            <Slip command="/reload-plugins" label="Copy the reload command" />
          </div>
        </div>
      </section>

      <div className="gs-cards">
        <section aria-labelledby="sec-h" className="warn">
          <h2 id="sec-h">
            <Icon name="warn" />
            Security
          </h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            Hooks, MCP servers and{' '}
            <code className="mono" style={{ fontSize: 13 }}>
              bin/
            </code>{' '}
            run with your privileges, outside Claude’s permission rules. Read them on the plugin page before installing.
          </p>
        </section>
        <section aria-labelledby="agents-h" className="card">
          <h2 id="agents-h">For agents</h2>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
            A machine-readable catalog and full component texts.
          </p>
          <p style={{ margin: 0, display: 'flex', gap: 16 }}>
            <a className="mono" href={asset('llms.txt')} style={{ fontSize: 14 }}>
              llms.txt
            </a>
            <a className="mono" href={asset('catalog.json')} style={{ fontSize: 14 }}>
              catalog.json
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
