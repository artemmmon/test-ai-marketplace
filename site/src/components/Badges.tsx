import type { CSSProperties } from 'react';
import { typeLabel } from '../data/links';
import { t } from '../i18n';
import type { ArtifactType } from '../types';
import { Icon } from './Icon';

export function TypeBadge({ type, style }: { type: ArtifactType; style?: CSSProperties }) {
  return (
    <span className={`badge t-${type}`} style={style}>
      <Icon name={type} />
      {typeLabel(type)}
    </span>
  );
}

export function ExecBadge() {
  return (
    <span className="badge warn" title={t('badges.executesCodeTitle')}>
      <Icon name="warn" />
      {t('badges.executesCode')}
    </span>
  );
}

export function ExternalBadge() {
  return (
    <span className="badge neutral" title={t('badges.externalTitle')}>
      {t('badges.external')}
    </span>
  );
}

export function VersionBadge({ version }: { version: string }) {
  return <span className="badge neutral mono">{t('common.version', { version })}</span>;
}

/** Two-tone identifier: "plugin:" muted, the name bright. */
export function QualifiedName({ plugin, name, isPlugin }: { plugin: string; name: string; isPlugin: boolean }) {
  return (
    <>
      {!isPlugin && <span className="muted">{plugin}:</span>}
      {name}
    </>
  );
}
