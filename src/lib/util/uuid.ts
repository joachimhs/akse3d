// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// Genererer en uuid-ish streng (samme implementasjon som Skaperiet-host brukte).
export function generateUuidIsh(a?: any): string {
  return a
    ? (0 | (Math.random() * 16)).toString(16)
    : (('' + 1e10) as string).replace(/1|0/g, generateUuidIsh as any);
}
