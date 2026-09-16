const CACHE='fun-mahjong-pong-v66';
const STYLES=['styles.css',...Array.from({length:24},(_,i)=>`styles-v${37+i}.css`)];
const TILE_FACES=['circle-1','circle-2','circle-3','circle-4','circle-5','circle-6','circle-7','circle-8','circle-9',
  'bamboo-1','bamboo-2','bamboo-3','bamboo-4','bamboo-5','bamboo-6','bamboo-7','bamboo-8','bamboo-9',
  'panda','fox','cat','dog','lion','tiger','rabbit','monkey',
  'apple','orange','lemon','watermelon','grapes','strawberry','cherry','peach',
  'wan-1','wan-2','wan-3','wan-4','wan-5','wan-6','wan-7','wan-8','wan-9'];
const ASSETS=[
  './','./index.html','./manifest.webmanifest',
  ...STYLES.map(f=>'./'+f),
  './app.js','./tile-motion.js','./assets/tile-poses/poses.js','./assets/tile-poses/shells.png',
  './assets/icon.svg','./assets/bamboo-shadow.svg','./assets/home-tree-v1.png','./assets/game-table-v1.png',
  './assets/hands/right-hand-long.png',
  // 玩法说明卡里直接引用的两张整牌图，其余 tiles/ 素材已由 tiles-face/ 取代
  './assets/tiles/bamboo-1.png','./assets/tiles/bamboo-2.png',
  ...TILE_FACES.map(n=>`./assets/tiles-face/${n}.png`),
  ...Array.from({length:23},(_,i)=>`./assets/avatars/avatar-${String(i+1).padStart(2,'0')}.png`)
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request))));
