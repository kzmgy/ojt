// Globe view: 21 INTERSTELLAR + N BASEBALL (upper hemisphere) + M HONGKONG
// (lower hemisphere). N + M is determined by the number of fibonacci slots
// remaining after picking 21 for the cluster. Image variants cycle in
// azimuth order so duplicates land far apart on the globe.

const SPHERE_R = 5;
const RADIUS_JITTER = 0.45;
const TOTAL_SLOTS = 200;

const INT_FILES = [
  '01.jpeg', '02.jpg', '03.jpg', '04.jpg', '05.jpg',
  '06.jpeg', '07.jpg', '08.jpg', '09.jpg', '10.jpg',
  '11.jpg', '12.jpeg', '13.jpg', '14.jpg', '15.jpg',
  '16.jpg', '17.jpeg', '18.jpg', '19.jpg', '20.jpg',
  '21.jpg',
];

const BASEBALL_FILES = [
  '01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpeg',
  '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg',
  '11.jpg', '12.jpeg', '13.jpg', '14.png', '15.jpg',
  '16.jpg', '17.jpg', '18.jpeg', '19.jpg', '20.jpg',
  '21.jpg', '22.jpeg', '23.jpg',
];

const HONGKONG_FILES = [
  '01.jpeg', '02.jpg', '03.jpg', '04.jpeg', '05.jpeg',
  '06.jpeg', '07.jpg', '08.jpeg', '09.jpg', '10.jpeg',
  '11.jpeg', '12.jpg', '13.jpeg', '14.jpg', '15.jpeg',
  '16.jpeg', '17.jpg', '18.jpg', '19.jpg', '20.jpeg',
  '21.jpeg',
];

function srand(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hash01(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function fibSphere(N, R) {
  const positions = [];
  const offset = 2 / N;
  const inc = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * inc;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    const radius = R + (hash01(i * 7 + 3) - 0.5) * RADIUS_JITTER;
    positions.push([x * radius, y * radius, z * radius]);
  }
  return positions;
}

const FIB = fibSphere(TOTAL_SLOTS, SPHERE_R);

// 1) Interstellar slots: 21 closest to (0, 0, R), with mild equatorial bias
const _interstellarSlots = (() => {
  const sorted = FIB.map((p, idx) => {
    const dx = p[0];
    const dy = p[1] * 1.5;
    const dz = p[2] - SPHERE_R;
    return { idx, d: dx * dx + dy * dy + dz * dz };
  }).sort((a, b) => a.d - b.d);
  return sorted.slice(0, INT_FILES.length).map((s) => s.idx);
})();
const _interstellarSlotSet = new Set(_interstellarSlots);

// 2) Hemisphere split for the rest. Sort by azimuth so a round-robin
//    image-cycle lands duplicates far apart in azimuth.
const _upperSlots = [];
const _lowerSlots = [];
FIB.forEach((p, idx) => {
  if (_interstellarSlotSet.has(idx)) return;
  if (p[1] >= 0) _upperSlots.push(idx);
  else _lowerSlots.push(idx);
});
function az(p) { return Math.atan2(p[0], p[2]); }
_upperSlots.sort((a, b) => az(FIB[a]) - az(FIB[b]));
_lowerSlots.sort((a, b) => az(FIB[a]) - az(FIB[b]));

// 3) Build IMAGES — each card knows its sphere position & subgroup.
const RAW = [];
let nextId = 1;

// Interstellar — one per file, in cluster slots
INT_FILES.forEach((file, i) => {
  const slotIdx = _interstellarSlots[i];
  RAW.push({
    id: nextId++,
    title: `INTERSTELLAR · ${String(i + 1).padStart(3, '0')}`,
    category: 'interstellar',
    subgroup: 'interstellar',
    src: `/int/${file}`,
    position: FIB[slotIdx],
  });
});

// Baseball — upper hemisphere, files cycle in azimuth order
_upperSlots.forEach((slotIdx, i) => {
  const file = BASEBALL_FILES[i % BASEBALL_FILES.length];
  RAW.push({
    id: nextId++,
    title: `BASEBALL · ${String(i + 1).padStart(3, '0')}`,
    category: 'baseball',
    subgroup: 'baseball',
    src: `/baseball/${file}`,
    position: FIB[slotIdx],
  });
});

// Hongkong — lower hemisphere, files cycle in azimuth order
_lowerSlots.forEach((slotIdx, i) => {
  const file = HONGKONG_FILES[i % HONGKONG_FILES.length];
  RAW.push({
    id: nextId++,
    title: `HONGKONG · ${String(i + 1).padStart(3, '0')}`,
    category: 'hongkong',
    subgroup: 'hongkong',
    src: `/hongkong/${file}`,
    position: FIB[slotIdx],
  });
});

// 4) relatedIds: 5 same-subgroup cards with DIFFERENT src (no duplicate
//    images in the carousel row).
for (const img of RAW) {
  const pool = RAW.filter(
    (o) => o.subgroup === img.subgroup && o.id !== img.id && o.src !== img.src
  );
  const r = srand(img.id * 1097);
  img.relatedIds = pool
    .map((o) => ({ id: o.id, k: r() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 5)
    .map((x) => x.id);
}

export const IMAGES = RAW;
export const SPHERE_RADIUS = SPHERE_R;
