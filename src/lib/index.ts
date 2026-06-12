// @skaperiet/akse — public API
export { default as Akse } from '$lib/components/Akse.svelte';

export type {
  AkseStoragePort,
  AkseSession,
  AkseConfig,
} from '$lib/config';

export type { StorageCapabilities, CapabilityState } from '$lib/capabilities';

export type { AkseTexts } from '$lib/texts';
export { DEFAULT_TEXTS } from '$lib/texts';

export type {
  AkseProject,
  AkseProjectSummary,
  Shape,
  ShapeKind,
  Vec3,
} from '$lib/models';

export { blankProject, DEFAULT_WORKPLANE, DEFAULT_COLORS } from '$lib/models';
