import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { bootSkiaWeb } from './bootSkiaWeb';

declare const require: (path: string) => any;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// On web, CanvasKit must be loaded before App (and its Skia consumers) evaluate,
// so we await bootSkiaWeb first. On native, Skia is a native module and ready
// immediately, so we register synchronously — and because the web-only Skia
// import lives in bootSkiaWeb.web.ts, it is never bundled for native.
if (Platform.OS === 'web') {
  bootSkiaWeb()
    .then(() => import('./App'))
    .then(({ default: App }) => registerRootComponent(App))
    .catch((e) => console.error('Web boot failed:', e));
} else {
  registerRootComponent(require('./App').default);
}
