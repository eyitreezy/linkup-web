/**
 * Web Push notifications when a mood plan goes live.
 *
 * Secrets (Supabase Dashboard → Edge Functions):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';
import { handleCors, jsonError, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@linkup.ng';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const MOOD_REACH_KM: Record<string, number | null> = {
  city: 20,
  city_adjacent: 35,
  city_widest: 50,
  all_cities: null,
};

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Body = { planId?: string };

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonError('Push not configured', 503, 'vapid_not_configured');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonError('Server misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Unauthorized', 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return jsonError('Unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const planId = body.planId?.trim();
  if (!planId) {
    return jsonError('planId required', 400);
  }

  const admin = getSupabaseAdmin();

  const { data: plan, error: planErr } = await admin
    .from('plans')
    .select('id, title, latitude, longitude, location_label, mood_reach, is_mood_plan, creator_id')
    .eq('id', planId)
    .single();

  if (planErr || !plan?.is_mood_plan) {
    return jsonError('Plan not found or not a mood plan', 404);
  }

  if (plan.creator_id !== authData.user.id) {
    return jsonError('Forbidden', 403);
  }

  const planLat = plan.latitude as number | null;
  const planLng = plan.longitude as number | null;
  if (planLat == null || planLng == null) {
    return jsonError('Plan has no location', 400);
  }

  const reachKm = MOOD_REACH_KM[(plan.mood_reach as string) ?? 'city'] ?? null;
  const city = (plan.location_label as string)?.split(',')[0]?.trim() ?? 'your area';

  const { data: subs } = await admin
    .from('web_push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .neq('user_id', plan.creator_id);

  if (!subs?.length) {
    return jsonResponse({ sent: 0, errors: 0 });
  }

  const subUserIds = subs.map((s) => s.user_id);
  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, latitude, longitude')
    .in('user_id', subUserIds);

  const locationMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, { lat: p.latitude, lng: p.longitude }])
  );

  const payload = JSON.stringify({
    title: `Mood plan in ${city}`,
    body: plan.title ?? 'A mood meetup is starting near you. Tap to view.',
    planId: plan.id,
    url: `/plan/${plan.id}`,
  });

  let sent = 0;
  let errorCount = 0;

  for (const sub of subs) {
    const loc = locationMap.get(sub.user_id);

    if (reachKm !== null) {
      if (loc?.lat == null || loc?.lng == null) continue;
      const dist = distanceKm(loc.lat, loc.lng, planLat, planLng);
      if (dist > reachKm) continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;

      await admin
        .from('web_push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint);
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        errorCount++;
      }
    }
  }

  return jsonResponse({ sent, errors: errorCount });
});
