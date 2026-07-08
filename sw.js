const CACHE_NAME = 'chlorophyll-app-v1';

// 相対パスでキャッシュ対象を指定（登録スコープを基準に解決される）
const urlsToCache = [
    './',
    './index.html',
    './manifest.json'
];

// インストール時のキャッシング
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] キャッシング開始');
                // スコープ基準で絶対URLに変換してからキャッシュ
                const scopeUrls = urlsToCache.map(u => new URL(u, self.registration.scope).href);
                return cache.addAll(scopeUrls)
                    .catch(err => {
                        console.log('[Service Worker] キャッシング部分エラー（一部ファイルが見つかりません）', err);
                        // 部分的に失敗しても続行
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// アクティベーション時の古いキャッシュ削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// リクエスト時のキャッシュ利用（ネットワークファースト）
self.addEventListener('fetch', event => {
    // http/https 以外のリクエストはスキップ
    if (!event.request.url.startsWith('http')) {
        return;
    }

    // GET 以外はキャッシュしない
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        // ネットワークから取得を試みる
        fetch(event.request)
            .then(response => {
                // 成功した場合、キャッシュに保存
                if (response.ok) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // ネットワークエラー時はキャッシュから取得
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        // キャッシュもない場合
                        console.warn('[Service Worker] キャッシュなし:', event.request.url);
                        return new Response('オフラインです', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain; charset=utf-8'
                            })
                        });
                    });
            })
    );
});

console.log('[Service Worker] ロード完了');
