// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
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

export type { AkseGuide, AkseGuideStep, AkseValidator } from '$lib/guide';
export { runAkseValidator } from '$lib/guide';
