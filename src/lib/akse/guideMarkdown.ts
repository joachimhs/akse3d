// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
import { marked } from 'marked';

// Wrapper rundt marked() for guide-tekster — samme mønster som
// guideMarkdown.ts i skaperiet-ny-front (ingen sanitering; innholdet er
// admin-/host-skrevet). Åpnes guider for brukergenerert innhold, legg til
// dompurify her.

export function renderGuideMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  try {
    const out = marked(source);
    if (typeof out !== 'string') {
      console.warn('[guideMarkdown] async marked-output støttes ikke');
      return `<pre>${escapeHtml(source)}</pre>`;
    }
    return out;
  } catch (err) {
    console.warn('[guideMarkdown] parsing feilet', err);
    return `<pre>${escapeHtml(source)}</pre>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
