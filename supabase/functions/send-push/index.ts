// Supabase Edge Function: send a remote push to one or more users.
//
// Deploy:  supabase functions deploy send-push
// Invoke:  POST with header  Authorization: Bearer <SERVICE_ROLE_KEY>
//          body: { "user_ids": ["<uuid>", ...], "title": "...", "body": "...", "data": {} }
//          (or a single "user_id": "<uuid>")
//
// It looks up the users' Expo push tokens, sends them via the Expo Push API in
// batches of 100, and prunes any tokens Expo reports as no longer registered.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const { user_id, user_ids, title, body, data } = await req.json();
    const ids: string[] = user_ids ?? (user_id ? [user_id] : []);
    if (ids.length === 0 || !title || !body) {
      return json({ error: 'Provide user_id(s), title and body.' }, 400);
    }

    // Service-role client — bypasses RLS so we can read every target's tokens.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: rows, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', ids);
    if (error) return json({ error: error.message }, 500);

    const tokens: string[] = (rows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) return json({ sent: 0, message: 'No registered devices.' });

    // Expo accepts up to 100 messages per request.
    const stale: string[] = [];
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const messages = batch.map((to) => ({ to, title, body, sound: 'default', data: data ?? {} }));
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      const out = await res.json();
      const tickets = out?.data ?? [];
      tickets.forEach((t: any, idx: number) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') stale.push(batch[idx]);
      });
    }

    // Clean up tokens for devices that uninstalled / revoked notifications.
    if (stale.length > 0) {
      await supabase.from('push_tokens').delete().in('token', stale);
    }

    return json({ sent, pruned: stale.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
