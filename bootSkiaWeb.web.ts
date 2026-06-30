import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Web: the victory-native weight chart renders through Skia, which needs its
// CanvasKit (WASM) runtime loaded before any Skia code is *evaluated* (Skia
// consumers cache the CanvasKit reference at module-eval time). Metro doesn't
// serve canvaskit.wasm at the path CanvasKit probes, so point its loader at the
// CDN copy (matching the installed version).
export async function bootSkiaWeb(): Promise<void> {
  await LoadSkiaWeb({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`,
  });
}
