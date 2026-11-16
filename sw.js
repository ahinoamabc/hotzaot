// עבודה בלי חיבור: שומרים את קבצי האפליקציה במכשיר.
// בכל עדכון של האפליקציה מעלים את המספר, כדי שהטלפון ימשוך את הגרסה החדשה.
const CACHE = 'hotzaot-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png'];
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ספריית Supabase: גרסה קבועה, אז מהמטמון קודם
  if (req.url.startsWith(LIB)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }

  // קבצי האפליקציה: מהרשת כשיש, מהמטמון כשאין
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
  }
  // קריאות ל-Supabase עצמו לא עוברות כאן
});

// תזכורת ערב: מציגים את ההתראה שהגיעה מ-Supabase
self.addEventListener('push', e => {
  let d;
  try { d = e.data.json(); } catch (err) { d = { title: 'הוצאות', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'הוצאות', {
    body: d.body || '', icon: 'icons/icon-192.png', lang: 'he', dir: 'rtl', tag: 'daily-reminder',
  }));
});

// לחיצה על ההתראה פותחת את מסך הרישום
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
