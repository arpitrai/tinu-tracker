// Native entry: Skia is a native module and is ready immediately, so there is
// nothing to preload here. This file deliberately does NOT import the web-only
// Skia build, so CanvasKit (and its Node `fs` dependency) never enters the
// native bundle — importing it there breaks Android/iOS dev-server bundling.
// Metro resolves the `.web` sibling for web and this file for native.
export async function bootSkiaWeb(): Promise<void> {}
