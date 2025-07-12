const CACHE_NAME = "unibridge-cache-v2";
const urlsToCache = [
  "/", "/index.html", "/main.js", "/auth.js", "/firebase.js",
  "/manifest.json", "/icon-192.png", "/icon-512.png"
];

// 설치: 기본 자원 캐싱
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log("[SW] 캐시 설치 시작");
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`❗ 캐시 실패: ${url}`, err);
        }
      }
      console.log("[SW] 캐시 설치 완료");
    })
  );
});

// 활성화: 오래된 캐시 제거
self.addEventListener("activate", event => {
  const keepCaches = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (!keepCaches.includes(key)) return caches.delete(key);
      }))
    )
  );
});

// fetch: stale-while-revalidate 전략
self.addEventListener("fetch", event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // 최신 응답으로 캐시 갱신
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => null); // 네트워크 실패 무시

        return response || fetchPromise;
      });
    })
  );
});

// background sync 이벤트: 오프라인 메시지 동기화
self.addEventListener("sync", event => {
  if (event.tag === "sync-messages") {
    event.waitUntil(
      clients.matchAll().then(clientsArr => {
        clientsArr.forEach(client => {
          client.postMessage({ type: "SYNC_MESSAGES" });
        });
      })
    );
  }
});
