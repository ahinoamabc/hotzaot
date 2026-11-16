// תזכורת ערב: שולחת התראת Push לטלפון.
// מופעלת על ידי pg_cron ב-18:00 וב-19:00 UTC; שולחת רק כשבירושלים השעה היא reminder_hour (21).
// {"test": true} עם טוקן של משתמשת מחוברת: שולחת מיד, רק למכשירים שלה (כפתור הבדיקה באפליקציה).
// ההצפנה (RFC 8291) והחתימה (VAPID, RFC 8292) כתובות ישירות עם WebCrypto, בלי ספריות.

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = 'https://ahinoamabc.github.io/hotzaot/';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const enc = new TextEncoder();
function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function b64uEncode(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`db ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// RFC 8291: aes128gcm
async function encryptPayload(p256dh: string, authB64: string, payload: Uint8Array) {
  const uaPublic = b64uDecode(p256dh);
  const authSecret = b64uDecode(authB64);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, ct);
}

// RFC 8292: VAPID
async function vapidHeader(endpoint: string, signKey: CryptoKey, publicKey: string) {
  const h = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64uEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: APP_URL,
  })));
  const unsigned = `${h}.${c}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64uEncode(sig)}, k=${publicKey}`;
}

function jerusalemNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find(p => p.type === t)!.value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) % 24 };
}

async function messageFor(userId: string, date: string) {
  const rows: { my_share: number }[] = await db(
    `expenses?select=my_share&user_id=eq.${userId}&date=eq.${date}&deleted=eq.false&source=eq.manual`);
  const n = rows.length;
  const sum = Math.round(rows.reduce((s, r) => s + Number(r.my_share), 0));
  const body = n === 0
    ? 'עוד לא רשמת כלום היום. קנית משהו?'
    : `רשמת היום ${n === 1 ? 'הוצאה אחת' : n + ' הוצאות'} (${sum.toLocaleString('he-IL')} ₪). היה עוד משהו?`;
  return { title: 'לרשום הוצאות', body, url: APP_URL };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const cfg: Record<string, string> = Object.fromEntries(
      (await db('push_config?select=key,value')).map((r: { key: string; value: string }) => [r.key, r.value]));
    const input = await req.json().catch(() => ({}));
    const now = jerusalemNow();
    let onlyUser: string | null = null;

    if (input.test) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
      if (!u.ok) return json({ error: 'unauthorized' }, 401);
      onlyUser = (await u.json()).id;
    } else {
      if (req.headers.get('x-cron-secret') !== cfg.cron_secret) return json({ error: 'forbidden' }, 403);
      if (!input.force && now.hour !== Number(cfg.reminder_hour || 21)) return json({ skipped: true, hour: now.hour });
    }

    const subs: { endpoint: string; user_id: string; p256dh: string; auth: string }[] =
      await db(`push_subscriptions?select=*${onlyUser ? `&user_id=eq.${onlyUser}` : ''}`);
    const signKey = await crypto.subtle.importKey('jwk', JSON.parse(cfg.vapid_private_jwk),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

    const messages = new Map<string, unknown>();
    const results = [];
    for (const s of subs) {
      if (!messages.has(s.user_id)) messages.set(s.user_id, await messageFor(s.user_id, now.date));
      const body = await encryptPayload(s.p256dh, s.auth, enc.encode(JSON.stringify(messages.get(s.user_id))));
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
          TTL: '3600', Urgency: 'normal',
          Authorization: await vapidHeader(s.endpoint, signKey, cfg.vapid_public),
        },
        body,
      });
      const detail = res.ok ? '' : await res.text();
      if (res.status === 404 || res.status === 410) {
        await db(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' });
      }
      results.push({ host: new URL(s.endpoint).host, status: res.status, detail });
    }
    return json({ sent: results.length, results });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
