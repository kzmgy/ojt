// Two categories — Interstellar (front cluster) + Baseball (rest of sphere).
// Both are sourced from a single MP4 each via scripts/convert-videos.mjs:
//   • thumbnail JPG (used by Sphere/Group/Node/Space views)
//   • 12 s clip MP4 (used by the carousel detail view)

import VIDEO_MANIFEST from './videoManifest.json';
import FILE_LIST from './fileList.json';

const SPHERE_R = 5;
const RADIUS_JITTER = 0.45;

const INT_FILES = FILE_LIST.int;
const BASEBALL_FILES = FILE_LIST.baseball;

// Total slots = sum of the two category counts (1:1 ratio, no duplicates).
const TOTAL_SLOTS = INT_FILES.length + BASEBALL_FILES.length;

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

// 1) Interstellar = the slots closest to (0, 0, R) — front cluster.
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

// 2) Baseball = everything else, sorted by azimuth so file cycle keeps
//    duplicates far apart (in this 1:1 build there are no duplicates,
//    but keeping the azimuth order makes neighbours land naturally).
const _baseballSlots = [];
FIB.forEach((p, idx) => {
  if (_interstellarSlotSet.has(idx)) return;
  _baseballSlots.push(idx);
});
function az(p) { return Math.atan2(p[0], p[2]); }
_baseballSlots.sort((a, b) => az(FIB[a]) - az(FIB[b]));

const RAW = [];
let nextId = 1;

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

BASEBALL_FILES.forEach((file, i) => {
  const slotIdx = _baseballSlots[i];
  if (slotIdx == null) return; // safety — shouldn't happen with 1:1
  RAW.push({
    id: nextId++,
    title: `BASEBALL · ${String(i + 1).padStart(3, '0')}`,
    category: 'baseball',
    subgroup: 'baseball',
    src: `/baseball/${file}`,
    position: FIB[slotIdx],
  });
});

// Attach video clip when one was generated for the same path.
for (const img of RAW) {
  const v = VIDEO_MANIFEST[img.src];
  if (v) img.videoSrc = v;
}

// relatedIds: 5 same-subgroup peers with different src (no carousel duplicates).
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
