import type { CSSProperties } from 'react';
import { TYPE_LABEL } from '../data/links';
import type { ArtifactType } from '../types';
import { Icon } from './Icon';

export const EXEC_TITLE =
  "Contains hooks, MCP servers or bin/ executables that run outside Claude's permission rules. Review before installing.";

export function TypeBadge({ type, style }: { type: ArtifactType; style?: CSSProperties }) {
  return (
    <span className={`badge t-${type}`} style={style}>
      <Icon name={type} />
      {TYPE_LABEL[type]}
    </span>
  );
}

export function ExecBadge() {
  return (
    <span className="badge warn" title={EXEC_TITLE}>
      <Icon name="warn" />
      Executes code
    </span>
  );
}

export function ExternalBadge() {
  return (
    <span className="badge neutral" title="Metadata only — source code is not indexed">
      External
    </span>
  );
}

export function VersionBadge({ version }: { version: string }) {
  return <span className="badge neutral mono">v{version}</span>;
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
