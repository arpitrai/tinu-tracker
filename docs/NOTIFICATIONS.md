# Notifications

Two independent systems, both built on `expo-notifications`:

- **Local daily reminder** — scheduled on-device from the Profile screen. No
  server, no Apple/Firebase setup. Works on a simulator.
- **Remote push** — sent from the `send-push` Supabase Edge Function via the
  Expo Push service. Needs the external credentials below and a **physical
  device** (simulators can't receive remote push).

Notifications require a **development or production build** — not Expo Go.
Because this adds native config (`app.json` plugin), you must create a **new
build and a new store submission**; it will not reach an already-uploaded build.

---

## Local reminder (already working)

- Code: `lib/notifications.ts` (`scheduleDailyReminder` / `cancelDailyReminder`).
- UI: Profile screen → "Daily reminder" toggle + time chips (9am / 2pm / 8pm).
- Preference persisted in AsyncStorage (`@tinu/reminderEnabled`, `@tinu/reminderTime`).

Test it: build a dev client, open Profile, turn the toggle on, grant the
permission prompt. To see it fire quickly, temporarily add a preset like
`{ label: 'Test', value: '<current HH:MM + 2 min>' }` to `TIME_PRESETS`.

---

## Remote push — external setup (do these once)

### 1. iOS — APNs key
1. Apple Developer → Certificates, Identifiers & Profiles → **Keys** → **+**.
2. Enable **Apple Push Notifications service (APNs)**, create, download the
   `.p8` (you can only download it once).
3. Hand it to EAS:  `eas credentials` → iOS → push key → upload the `.p8`
   (needs the Key ID and your Team ID). EAS stores it and uses it automatically.

### 2. Android — FCM (Firebase Cloud Messaging)
1. Firebase console → create/select a project → add an **Android app** with
   package `com.arpitrai.tinutracker`. Download `google-services.json`.
2. Put `google-services.json` at the repo root and reference it in `app.json`:
   `"android": { "googleServicesFile": "./google-services.json", ... }`.
3. Firebase → Project settings → **Service accounts** → generate a new private
   key (JSON). Upload it to Expo:
   `eas credentials` → Android → **FCM V1 service account key** → upload the JSON.

### 3. Server credentials for the Edge Function
The function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase
injects automatically for deployed functions — nothing to set for those.

---

## Deploy the server side

```bash
# from repo root, with the Supabase CLI linked to the project
supabase db push                         # applies migrations/20260701_push_tokens.sql
supabase functions deploy send-push
```

(Or run the migration SQL directly in the Supabase SQL editor.)

## Send a test push

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push' \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "<a-user-uuid>", "title": "Nice work!", "body": "You logged 5 days in a row." }'
```

The device must have opened the app at least once while signed in (so its token
is in `push_tokens`) and be a real device with notifications allowed.

### Automating a daily nudge
Schedule the function with **Supabase cron** (pg_cron / scheduled function) to,
e.g., run each evening and push only users who haven't logged today. The current
function targets explicit user ids; extend the query to select those users
server-side before sending.
