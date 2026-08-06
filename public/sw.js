// Service Worker for PWA - 优化版本
const CACHE_NAME = 'tobacco-layout-v3';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // 跳过非GET请求
  if (event.request.method !== 'GET') return;
  
  // 跳过API请求
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 检查是否有效响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // 克隆响应并缓存
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存读取
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // 如果是页面请求，返回缓存的首页
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/');
            }
            return new Response('Network error', { status: 503 });
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
