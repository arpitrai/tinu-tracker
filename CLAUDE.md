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

## Architecture

A single-screen-at-a-time habit tracker (exercise / sugar / weight). No navigation library — `App.tsx` is the router: it reads the Supabase session and renders **`SignInScreen`** (no session) or **`TrackerScreen`** (authenticated). Auth state changes are wired through `supabase.auth.onAuthStateChange`, so sign-in/out swaps the screen automatically.

**Auth** is Google OAuth via Supabase. `SignInScreen` opens the OAuth URL with `expo-web-browser`, then manually extracts tokens from the redirect (`tinutracker://` scheme — declared in `app.json`) and calls `supabase.auth.setSession`. Sessions persist in **AsyncStorage** (see `lib/supabase.ts`) — do **not** switch to `expo-secure-store` for session storage; it caused issues and was deliberately replaced.

**Data model** lives in one Supabase table, `entries`, keyed by `(user_id, date)`. Columns: `exercised` (bool|null), `ate_sweets` (bool|null), `weight` (string|null). Writes use `upsert(..., { onConflict: 'user_id,date' })`. `TrackerScreen` loads the user's entire history once into an in-memory `Map<dateStr, DayEntry>` and derives everything (recent list, chart data, date navigation) from that map — there is no per-day fetch.

**Dates** are always handled as `YYYY-MM-DD` strings in **local time**. Use the existing `todayKey()` / `offsetDateStr()` helpers in `TrackerScreen.tsx` — they intentionally avoid UTC parsing so day boundaries match the user's timezone. Do not introduce `new Date(dateStr)` (parses as UTC).

**Three-state booleans:** exercise/sugar are tri-state (`true` / `false` / `null` = not logged). Note the color polarity differs per metric — for Exercise, Yes=green/No=red; for Sugar, Yes=red/No=green — passed explicitly via `yesColor`/`noColor` props on the toggle.

**Trends** (`components/TrendsChart.tsx`) is a hand-rolled SVG chart built on `react-native-svg` (weight line + area, boolean rows, percentage bars). It is not a charting-library config — layout is driven by the pixel constants at the top of the file.

### Layout conventions

- `screens/` — the two top-level screens.
- `components/` — presentational + modal components (`ProfileMenu`, `ProfileModal`, `CalendarModal`, `SplitToggle`/`TriToggle`, `TrendsChart`).
- `lib/supabase.ts` — the single Supabase client.
- Each screen/component owns its own `StyleSheet` and a local design-token object (commonly named `P` or `C`). There is no shared theme module; colors are defined per-file.

## Testing

Jest with the `jest-expo` preset. Tests live in `__tests__/`. Two patterns in use:

1. **Pure-logic tests** — testable helpers are exported from component files specifically for this (e.g. `parseWeight` from `TrendsChart.tsx`), or duplicated as a local function in the test (`weightInput.test.ts`). When adding logic worth testing, export it.
2. **Component tests** — `@testing-library/react-native`, asserting on `testID`s (e.g. `toggle-yes`).

Native chart libs are stubbed in `__mocks__/` (`victory-native`, `@shopify/react-native-skia`, `react-native-reanimated`) and mapped in `jest.config.js`. If you add a dependency that pulls in native modules, it likely needs an entry in `transformIgnorePatterns` and/or a mock.

## Environment

Requires `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the `EXPO_PUBLIC_` prefix is what exposes them to the client bundle).

## UI verification

When changing UI, verify visually — run the web build (`npm run web`) and drive it with Playwright (available as a dev dependency) rather than assuming the layout is correct.
