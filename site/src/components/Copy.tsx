// Copy controls: the primary "Copy install" button and the command "slip".
import { useEffect, useState } from 'react';
import { useToast } from '../app/toast';
import { t } from '../i18n';
import { Icon } from './Icon';

function useCopied(): [boolean, (text: string) => void] {
  const { copy } = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return [copied, (text: string) => void copy(text).then((ok) => setCopied(ok))];
}

export function CopyInstallButton({ command, plugin, title, block }: { command: string; plugin: string; title?: string; block?: boolean }) {
  const [copied, run] = useCopied();
  return (
    <button
      className="btn btn-primary"
      type="button"
      style={block ? { flex: 1 } : undefined}
      aria-label={t('copy.installLabel', { plugin })}
      title={title}
      onClick={() => run(command)}
    >
      <Icon name={copied ? 'check' : 'copy'} />
      {copied ? t('common.copied') : t('copy.install')}
    </button>
  );
}

export function CopyButton({ text, label, className = 'btn btn-ghost' }: { text: string; label: string; className?: string }) {
  const [copied, run] = useCopied();
  return (
    <button className={className} type="button" aria-label={label} onClick={() => run(text)}>
      <Icon name={copied ? 'check' : 'copy'} />
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  );
}

/** One mono command line with the Copy button joined to its right edge. */
export function Slip({ command, label, prompt }: { command: string; label: string; prompt?: boolean }) {
  const [copied, run] = useCopied();
  return (
    <div className="slip">
      <code translate="no">
        {prompt && (
          <span className="p" aria-hidden="true">
            $
          </span>
        )}
        {command}
      </code>
      <button type="button" aria-label={label} onClick={() => run(command)}>
        <Icon name={copied ? 'check' : 'copy'} />
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}
