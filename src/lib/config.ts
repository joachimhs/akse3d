// @skaperiet/akse — kontrakt mellom pakke og host (portene) + Svelte-context.
import { getContext, setContext } from 'svelte';
import type { AkseProject, AkseProjectSummary } from '$lib/models';
import type { StorageCapabilities } from '$lib/capabilities';
import type { AkseTexts } from '$lib/texts';

/** PORT UT — persistens. Host implementerer mot sin backend. */
export interface AkseStoragePort {
  load(id: string): Promise<AkseProject | null>;
  create(project: AkseProject): Promise<AkseProject>;
  update(id: string, project: AkseProject): Promise<AkseProject>;
  list(): Promise<AkseProjectSummary[]>;
  remove(id: string): Promise<void>;
}

/** PORT INN — innlogget bruker (reaktiv: les .user/.authenticated i template). */
export interface AkseSession {
  readonly user: string | null;
  readonly authenticated: boolean;
}

/** Host-konfig delt med alle Akse-komponenter via context. */
export interface AkseConfig {
  storage?: AkseStoragePort;        // valgfri — fravær = sky-kapabilitet av
  session: AkseSession;
  capabilities: StorageCapabilities;
  texts: AkseTexts;
  onProjectIdChange?: (id: string) => void;
  fontUrl: string;
  // Hard grense for STL-import (antall trekanter). Mesh-data lagres i prosjekt-
  // JSON-en (~48 byte per trekant som base64), så sky-hosts bør sette denne lavt
  // for å begrense lagringsbehovet. Standalone kan være romslig.
  maxStlTriangles: number;
}

const AKSE_CONFIG_KEY = Symbol('akse-config');

export function setAkseConfig(config: AkseConfig): void {
  setContext(AKSE_CONFIG_KEY, config);
}

export function getAkseConfig(): AkseConfig {
  const c = getContext<AkseConfig>(AKSE_CONFIG_KEY);
  if (!c) throw new Error('AkseConfig mangler — <Akse> må sette den via setAkseConfig().');
  return c;
}
