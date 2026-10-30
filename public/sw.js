// LAMLA Guide AI — Progressive Web App Service Worker
// "It's Never Too Late To Study."

const CACHE_NAME = "lamla-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline — LAMLA Guide AI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 12px; }
    p { font-size: 15px; color: #64748b; max-width: 420px; line-height: 1.5; margin: 0 0 24px; }
    button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="badge">LAMLA Guide AI</div>
  <h1>You Are Currently Offline</h1>
  <p>Please check your internet connection to access live AI tutoring, synchronized quizzes, and document notes.</p>
  <button onclick="window.location.reload()">Retry Connection</button>
</body>
</html>`;

// Install Event — Precaching Core Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache static assets resiliently
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[PWA SW] Precache failed for", url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event — Cache Cleanup & Claim
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Network-First for API/Data, Cache-First for Static Assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET, Chrome extension, and WebSocket calls
  if (req.method !== "GET" || url.protocol.startsWith("ws") || !url.protocol.startsWith("http")) {
    return;
  }

  // Pass-through for AI and Backend APIs (always live)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/v1/")) {
    return;
  }

  // Navigation requests (HTML pages)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match(req).then((cached) => {
          return (
            cached ||
            new Response(OFFLINE_HTML, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        });
      })
    );
    return;
  }

  // Static Assets (Images, Icons, CSS, JS) — Cache with Network Fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkRes) => {
        if (
          networkRes &&
          networkRes.status === 200 &&
          (url.pathname.endsWith(".png") ||
            url.pathname.endsWith(".svg") ||
            url.pathname.endsWith(".ico") ||
            url.pathname.endsWith(".woff2") ||
            url.pathname.endsWith(".css"))
        ) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      });
    })
  );
});

// Push Notifications Listener (For Study Reminders & Live Quiz Starts)
self.addEventListener("push", (event) => {
  let data = { title: "LAMLA Guide AI", body: "It's Never Too Late To Study.", url: "/dashboard" };
  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
