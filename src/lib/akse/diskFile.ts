// @skaperiet/akse — direkte fil-lagring/-åpning via File System Access API.
// Kalles KUN når capabilities.diskFile.available er true.

/** Lagre tekst til en fil brukeren velger. Returnerer true ved suksess,
 *  false hvis brukeren avbrøt dialogen. Kaster ved ekte feil. */
export async function saveTextToFile(text: string, suggestedName: string): Promise<boolean> {
  const picker = (window as any).showSaveFilePicker;
  try {
    const handle = await picker({
      suggestedName,
      types: [{ description: 'Akse-prosjekt', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  } catch (e: any) {
    if (e?.name === 'AbortError') return false; // bruker avbrøt — ikke en feil
    throw e;
  }
}

/** Åpne en fil brukeren velger og returner innholdet som tekst, eller null hvis avbrutt. */
export async function openTextFromFile(): Promise<string | null> {
  const picker = (window as any).showOpenFilePicker;
  try {
    const [handle] = await picker({
      types: [{ description: 'Akse-prosjekt', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    return await file.text();
  } catch (e: any) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}
