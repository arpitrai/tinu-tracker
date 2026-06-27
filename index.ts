import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

declare const require: (path: string) => any;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// On web, the victory-native weight chart renders through Skia, which needs its
// CanvasKit (WASM) runtime loaded before any Skia code is *evaluated* — so we
// must load CanvasKit first and only then import App (the Skia consumers cache
// the CanvasKit reference at module-eval time). On native, Skia is a native
// module and is ready immediately, so we register synchronously.
if (Platform.OS === 'web') {
  import('@shopify/react-native-skia/lib/module/web')
    .then(({ LoadSkiaWeb }) =>
      // Metro doesn't serve canvaskit.wasm at the path CanvasKit probes, so
      // point its loader at the CDN copy (matching the installed version).
      LoadSkiaWeb({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`,
      }),
    )
    .then(() => import('./App'))
    .then(({ default: App }) => registerRootComponent(App))
    .catch((e) => console.error('Web boot failed:', e));
} else {
  registerRootComponent(require('./App').default);
}
