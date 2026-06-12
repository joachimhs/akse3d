# Design: Dual-lisensiering av Akse (AGPL-3.0 + kommersiell)

Dato: 2026-06-12
Status: Godkjent av Joachim, implementert samme dag.

## Mål

Akse skal være fri programvare for alle som selv deler sin kildekode, samtidig som
Skaperiet kan tjene penger på kommersiell bruk i lukkede produkter og tjenester.

## Valgt modell

**Dual-lisensiering: AGPL-3.0-only + kommersiell lisens fra Skaperiet.**

- AGPL-3.0 er ekte open source (OSI-godkjent) og tillater all bruk — også kommersiell —
  så lenge brukeren oppfyller copyleft-kravene. AGPL §13 («network use») gjør at også
  SaaS/nettjenester som bygger på Akse må dele sin kildekode med sine brukere.
- Aktører som ikke vil/kan dele sin kildekode (bedrifter som embedder Akse i lukkede
  produkter, SaaS-aktører, skoler/utdanningsinstitusjoner med lukkede portaler) kjøper
  kommersiell lisens av Skaperiet. Klassisk modell (MySQL, Qt, iText).

### Vurderte alternativer

1. **Source-available / ikke-kommersiell** (PolyForm Noncommercial o.l.) — forkastet:
   Joachim ønsket ekte open source.
2. **AGPL + utdanningsunntak** — forkastet: skoler er en av de tiltenkte betalende
   kundegruppene, et unntak ville undergravd inntektsgrunnlaget.
3. **GPL-3.0 + kommersiell** — forkastet: ASP-smutthullet lar SaaS-aktører bruke
   GPL-kode kommersielt over nett uten å betale.

## Implementasjon

| Artefakt | Innhold |
|---|---|
| `LICENSE` | Kanonisk, uendret AGPL-3.0-tekst (fra gnu.org). |
| `LICENSE-COMMERCIAL.md` | Invitasjon til kommersiell avtale: hvem trenger den, hva den dekker, kontakt. Ikke en juridisk kontrakt. |
| `CONTRIBUTING.md` | Bidragsprosess + krav om CLA før PR merges. |
| `CLA.md` | Individuell CLA: bidragsyter beholder opphavsrett, gir Skaperiet ikke-eksklusiv, ugjenkallelig rett til å re-lisensiere (nødvendig for å selge kommersielle lisenser). |
| `README.md` | Ny «Lisens»-seksjon som forklarer modellen i klartekst. |
| `package.json` | `"license": "AGPL-3.0-only"` (erstatter `UNLICENSED`). |
| SPDX-headere | `Copyright` + `SPDX-License-Identifier: AGPL-3.0-only` øverst i alle `.ts`/`.svelte`-filer under `src/lib/`. |
| Varemerke | Notis i README og LICENSE-COMMERCIAL: navnet «Akse», logo og akse3d.no/akse3d.com omfattes ikke av AGPL. |

## Avgrensninger og oppfølging (krever Joachim/jurist)

- **Juridisk enhet:** Filene bruker «Skaperiet (Joachim Haagen Skeie)» som
  rettighetshaver. Verifiser korrekt juridisk navn (ENK/AS) før publisering.
- **Kommersiell kontrakt:** Selve avtaleteksten og prismodellen må utformes av jurist
  før første salg. `LICENSE-COMMERCIAL.md` er kun en henvendelsesside.
- **CLA-automatisering:** Når repoet legges på GitHub, sett opp CLA-assistant
  (https://cla-assistant.io) eller tilsvarende GitHub Action for å håndheve signering.
- **Eksisterende kode:** All kode til nå er skrevet av Joachim/Skaperiet, så det er
  ingen eksterne rettighetshavere å avklare med.
