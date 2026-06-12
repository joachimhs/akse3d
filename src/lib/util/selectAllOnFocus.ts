// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// onfocus-handler som markerer hele innholdet i et input/textarea-felt.
// Bruker requestAnimationFrame slik at et klikk sin påfølgende mouseup ikke
// kollapser markeringen (ren select() i onfocus mister markeringen ved museklikk).
export function selectAllOnFocus(e: FocusEvent): void {
  const el = e.currentTarget as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  requestAnimationFrame(() => el.select());
}
