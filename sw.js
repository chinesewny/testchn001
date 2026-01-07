const CACHE_NAME = 'chinese-class-v2'; // เปลี่ยนเวอร์ชั่นเมื่อแก้โค้ด
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/utils.js',
  './js/api.js',
  './js/ui.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js',
  'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});