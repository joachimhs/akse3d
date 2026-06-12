# Bidra til Akse

Takk for interessen! Bidrag er velkomne — funksjonalitet, feilrettinger,
dokumentasjon og oversettelser.

## Før du sender en pull request

1. **Signer CLA-en.** Akse er dual-lisensiert (AGPL-3.0 + kommersiell lisens),
   og alle bidragsytere må akseptere [CLA.md](CLA.md) før bidrag kan merges.
   Du beholder opphavsretten til bidraget ditt, men gir Skaperiet rett til å
   re-lisensiere det. Aksept skjer ved å legge en signaturlinje i din første
   PR — se CLA.md for nøyaktig tekst.
2. **Diskuter større endringer først.** Åpne et issue før du bygger store
   funksjoner, så unngår du bortkastet arbeid.

## Utvikling

```bash
npm install
npm run dev      # isolert preview med localStorage-adapter (http://localhost:5173)
npm run check    # svelte-check — skal være grønn før PR
npm run package  # bygg dist/ (svelte-package + publint)
```

Se [README.md](README.md) for arkitektur (porter, props, guider) og krav til host.

## Retningslinjer

- Følg eksisterende kodestil og navngiving (norsk i brukerflater og
  domenebegreper, engelsk i generisk kode).
- Nye kildefiler under `src/lib/` skal ha SPDX-header:

  ```ts
  // Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
  // SPDX-License-Identifier: AGPL-3.0-only
  ```

- Hold PR-er små og fokuserte — én ting per PR.

## Lisens

Ved å bidra aksepterer du at bidraget ditt distribueres under prosjektets
dual-lisensmodell: [AGPL-3.0](LICENSE) og
[Skaperiets kommersielle lisens](LICENSE-COMMERCIAL.md), i henhold til
[CLA-en](CLA.md).
