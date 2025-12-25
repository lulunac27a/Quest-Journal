// public/sw.js  (یا /sw.js بسته به پروژه)
const VERSION = 'qj-1.2.0-20251125-2146-999a320';       // هر دیپلوی عوضش کن
const CACHE   = `app-${VERSION}`;

// فایل‌های fingerprinted رو می‌گذاریم کش؛ HTML/manifest/sw.js همیشه تازه
self.addEventListener('install', (e) => {
  self.skipWaiting();                      // سریع فعال شو
  e.waitUntil(caches.open(CACHE));         // warmup اختیاری
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();            // کنترل فوری تب‌ها
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // چیزی مربوط به Auth/Google/Firebase رو اصلاً دست نزن (مشکلات iOS و ...)
  const isAuth =
    (sameOrigin && url.pathname.startsWith('/__/auth/')) ||
    /(^|\.)googleapis\.com$/.test(url.hostname) ||
    /(^|\.)gstatic\.com$/.test(url.hostname) ||
    url.hostname === 'accounts.google.com' ||
    /(^|\.)firebaseapp\.com$/.test(url.hostname) ||
    url.hostname === 'securetoken.googleapis.com' ||
    url.hostname === 'www.googleapis.com';
  if (!sameOrigin || isAuth) return;

  // 1) ناوبری‌ها/HTML: همیشه شبکه (fallback به کش در قطع ارتباط)
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')
                || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isNav) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2) خود sw.js و manifest همیشه تازه
  if (url.pathname === '/sw.js' || url.pathname.endsWith('manifest.webmanifest')) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 3) U?OUOU,??OU?OUO fingerprinted (js/css/svg/etc)
  const isAsset = /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp3|mp4)$/i.test(url.pathname);
  if (isAsset) {
    const isJs = url.pathname.endsWith('.js');
    if (isJs) {
      e.respondWith((async () => {
        try {
          const net = await fetch(req, { cache: 'no-store' });
          const ct = (net.headers.get('content-type') || '').toLowerCase();
          if (net.ok && (ct.includes('javascript') || ct.includes('text/javascript'))) {
            const copy = net.clone();
            try { const c = await caches.open(CACHE); await c.put(req, copy); } catch {}
            return net;
          }
        } catch {}
        const cached = await caches.match(req);
        if (cached) return cached;
        return fetch(req);
      })());
      return;
    }
    e.respondWith(
      caches.match(req).then(res => res || fetch(req).then(net => {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return net;
      }))
    );
  }
});

