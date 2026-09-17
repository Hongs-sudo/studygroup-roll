/* 홈 화면에 추가했을 때 앱처럼 열리게 하고, 화면 자체는 오프라인에서도 뜨게 한다.
   출결 자료는 Firestore 의 오프라인 캐시가 따로 맡는다. */

const CACHE = "sg-attendance-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 다른 출처(Firebase, gstatic)는 서비스워커가 건드리지 않는다
  if (url.origin !== self.location.origin) return;

  // 페이지는 네트워크 우선, 끊기면 캐시
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 나머지 파일은 캐시 우선
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
