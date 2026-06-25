# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo SDK 56

This project is pinned to **Expo SDK 56 / React Native 0.85 / React 19.2**. The APIs differ from older Expo versions you may have memorized. Before writing Expo/React Native code, consult the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ rather than relying on prior knowledge.

## Commands

```bash
npm start              # Expo dev server (Metro)
npm start -- --tunnel  # Required for Expo Go when on a VPN (LAN mode fails)
npm run web            # Run in browser via react-native-web
npm run ios            # Native iOS build/run
npm run android        # Native Android build/run

npm test                          # Run all Jest tests
npm run test:watch                # Watch mode
npx jest __tests__/TriToggle      # Run a single test file (path substring match)
npx jest -t "deselects"           # Run tests matching a name pattern
```

Builds are distributed via EAS (`eas.json`); the `preview` profile outputs an installable Android APK.

App icons in `assets/` are generated from the `PulseRiseIcon` brand mark (defined in `SignInScreen.tsx`) — the amber→rose gradient pulse glyph. After regenerating the PNGs, run `expo prebuild -p android` and rebuild; native launcher icons are baked at build time and do **not** update via Fast Refresh.

## Architecture

A single-screen-at-a-time habit tracker (exercise / sugar / weight). No navigation library — `App.tsx` is the router: it reads the Supabase session and renders **`SignInScreen`** (no session) or **`TrackerScreen`** (authenticated). Auth state changes are wired through `supabase.auth.onAuthStateChange`, so sign-in/out swaps the screen automatically.

**Auth** is Google OAuth via Supabase. `SignInScreen` opens the OAuth URL with `expo-web-browser`, then manually extracts tokens from the redirect (`tinutracker://` scheme — declared in `app.json`) and calls `supabase.auth.setSession`. Sessions persist in **AsyncStorage** (see `lib/supabase.ts`) — do **not** switch to `expo-secure-store` for session storage; it caused issues and was deliberately replaced. Google sign-in does **not** complete on the Android emulator (Google shows a generic "something went wrong" page) — test auth on a real device or the web build. The redirect URL (`tinutracker://`) and any web origins must be allow-listed in Supabase → Authentication → URL Configuration.

**Data model** lives in one Supabase table, `entries`, keyed by `(user_id, date)`. Columns: `exercised` (bool|null), `ate_sweets` (bool|null), `weight` (string|null). Writes use `upsert(..., { onConflict: 'user_id,date' })`. `TrackerScreen` loads the user's entire history once into an in-memory `Map<dateStr, DayEntry>` and derives everything (recent list, chart data, date navigation) from that map — there is no per-day fetch.

**Dates** are always handled as `YYYY-MM-DD` strings in **local time**. Use the existing `todayKey()` / `offsetDateStr()` helpers in `TrackerScreen.tsx` — they intentionally avoid UTC parsing so day boundaries match the user's timezone. Do not introduce `new Date(dateStr)` (parses as UTC).

**Three-state booleans:** exercise/sugar are tri-state (`true` / `false` / `null` = not logged). Note the color polarity differs per metric — for Exercise, Yes=green/No=red; for Sugar, Yes=red/No=green — passed explicitly via `yesColor`/`noColor` props on the toggle.

**Trends** (`components/TrendsChart.tsx`) is a hand-rolled SVG chart built on `react-native-svg` (weight line + area, boolean rows, percentage bars). It is not a charting-library config — layout is driven by the pixel constants at the top of the file.

### UI & layout conventions

- `screens/` — the two top-level screens.
- `components/` — presentational + modal components (`ProfileMenu`, `ProfileModal`, `CalendarModal`, `SplitToggle`/`TriToggle`, `TrendsChart`).
- `lib/supabase.ts` — the single Supabase client.
- Each screen/component owns its own `StyleSheet` and a local design-token object (commonly named `P` or `C`). There is no shared theme module; colors are defined per-file.
- **No layout shift between states.** Controls are deliberately given a constant height across their read-only / editable / empty / locked states (e.g. the weight box is a fixed `60`; the action area always renders a 30px spacer even when empty). The user treats vertical jumps as a bug — when a control changes by state, keep its height fixed rather than conditionally rendering elements that change layout height.
- **Android safe area.** React Native's `SafeAreaView` only insets on iOS. Top-level screens pad the status bar manually with `paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0` — do this for any new full-screen view.

## Testing

Jest with the `jest-expo` preset. Tests live in `__tests__/`. Two patterns in use:

1. **Pure-logic tests** — testable helpers are exported from component files specifically for this (e.g. `parseWeight` from `TrendsChart.tsx`), or duplicated as a local function in the test (`weightInput.test.ts`). When adding logic worth testing, export it.
2. **Component tests** — `@testing-library/react-native`, asserting on `testID`s (e.g. `toggle-yes`).

Native chart libs are stubbed in `__mocks__/` (`victory-native`, `@shopify/react-native-skia`, `react-native-reanimated`) and mapped in `jest.config.js`. If you add a dependency that pulls in native modules, it likely needs an entry in `transformIgnorePatterns` and/or a mock.

## Environment

Requires `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the `EXPO_PUBLIC_` prefix is what exposes them to the client bundle).

## UI verification

When changing UI, verify visually rather than assuming the layout is correct. Two routes:

- **Web** (`npm run web`) driven with Playwright (a dev dependency) — fastest, and the only place Google sign-in works locally (see Auth note above).
- **Android emulator** — build/install a dev client with `npm run android`, then iterate via Fast Refresh; relaunch the activity (`adb shell monkey -p com.arpitrai.tinutracker -c android.intent.category.LAUNCHER 1`) to force a fresh bundle, and screenshot with `adb exec-out screencap -p > shot.png`.

The app requires a **development build, not Expo Go** — `victory-native` / `@shopify/react-native-skia` are native modules Expo Go does not bundle.
