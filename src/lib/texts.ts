// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// @skaperiet/akse — vert-/sky-spesifikke tekster med norske defaults.
// Host kan overstyre enkelt-nøkler via <Akse texts={{ ... }} />.

export interface AkseTexts {
  // Sky-seksjon i Lagre-modal
  cloudSaveTitle: string;
  cloudSaveIntro: string;
  cloudSaveLoginRequired: string;
  // Sky-seksjon i Åpne-modal
  cloudOpenTitle: string;
  cloudOpenIntro: string;
  cloudOpenLoginRequired: string;
  // Kapabilitets-forklaringer (tooltips / gråing)
  cloudUnavailable: string;
  cloudLoginToWrite: string;
  diskFileUnsupported: string;
  downloadUnsupported: string;
}

export const DEFAULT_TEXTS: AkseTexts = {
  cloudSaveTitle: 'Lagre online',
  cloudSaveIntro:
    'Lagre prosjektet på din Skaperiet-konto. Etter lagring kan du dele lenken og finne det igjen.',
  cloudSaveLoginRequired:
    'Du må være logget inn for å lagre prosjekter på Skaperiet-kontoen din. Det er gratis å opprette en konto.',
  cloudOpenTitle: 'Hent fra skyen',
  cloudOpenIntro: 'Her finner du prosjekter du har lagret på din Skaperiet-konto.',
  cloudOpenLoginRequired:
    'Du må være logget inn for å laste inn lagrede prosjekter. Det er gratis å opprette en konto hos Skaperiet.',
  cloudUnavailable: 'Sky-lagring er ikke tilgjengelig i denne versjonen av Akse.',
  cloudLoginToWrite: 'Logg inn for å lagre i skyen.',
  diskFileUnsupported: 'Nettleseren din støtter ikke direkte fil-lagring. Bruk "Last ned" i stedet.',
  downloadUnsupported: 'Fil-nedlasting er ikke tilgjengelig i denne nettleseren.',
};

/** Flett host sine delvise overstyringer over de norske defaultene. */
export function resolveTexts(overrides?: Partial<AkseTexts>): AkseTexts {
  return { ...DEFAULT_TEXTS, ...overrides };
}
