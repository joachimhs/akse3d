// @skaperiet/akse — auto-detektert lagringskapabilitets-modell.
import type { AkseTexts } from '$lib/texts';

export interface CapabilityState {
  available: boolean;
  reason?: string;   // norsk forklaring vist som tooltip når !available
}

export interface StorageCapabilities {
  cloud: CapabilityState & { canWrite: boolean };  // Skaperiet-konto (storage-port)
  diskFile: CapabilityState;                        // File System Access API
  download: CapabilityState;                        // blob-nedlasting + fil-input (fallback)
}

/**
 * Detekter nettleser-baserte lagringskapabiliteter. Konstant per økt — kall én gang.
 * `cloud` beregnes separat i Akse.svelte (avhenger av storage-prop + session).
 */
export function detectBrowserStorage(texts: AkseTexts): Pick<StorageCapabilities, 'diskFile' | 'download'> {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const hasFsa =
    !!w &&
    typeof w.showSaveFilePicker === 'function' &&
    typeof w.showOpenFilePicker === 'function' &&
    w.isSecureContext === true;
  const hasDownload = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  return {
    diskFile: hasFsa
      ? { available: true }
      : { available: false, reason: texts.diskFileUnsupported },
    download: hasDownload
      ? { available: true }
      : { available: false, reason: texts.downloadUnsupported },
  };
}
