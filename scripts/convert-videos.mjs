#!/usr/bin/env node
// Multiple source videos per category → N evenly-spaced (thumbnail JPG +
// short clip MP4) pairs. Used by the React gallery: JPG everywhere except
// the carousel detail view, which switches to the MP4.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CLIP_DURATION = 7;       // seconds per clip
const CLIP_HEIGHT = 720;       // 720p web-optimized H.264

// Each category lists one or more source videos. `count` per source.
// Output files are numbered sequentially across sources within a category
// (01.jpg, 02.jpg, … N.jpg).
const CATEGORIES = [
  {
    destCategory: 'int',
    sources: [
      { label: 'int01',           src: '/Users/zaykim/Downloads/영상모음/int01.mp4',                                                                                      count: 25 },
      { label: 'message-delivery', src: '/Users/zaykim/Downloads/영상모음/쿠퍼 & 머피 메시지 전달 장면  인터스텔라 (Interstellar, 2014) [4K]-3840x1920-vp09-mp4a.mp4',          count: 25 },
      { label: 'reunion',         src: '/Users/zaykim/Downloads/영상모음/쿠퍼 & 머피 재회 장면  인터스텔라 (Interstellar, 2014) [4K]-3840x1920-vp09-mp4a.mp4',                count: 25 },
      { label: 'gargantua-swing', src: '/Users/zaykim/Downloads/영상모음/쿠퍼&브랜드 가르강튀아 스윙바이 장면  인터스텔라 (Interstellar, 2014) [4K]-3840x1920-vp09-mp4a.mp4', count: 25 },
    ],
  },
  {
    destCategory: 'baseball',
    sources: [
      { label: 'kbo-highlight', src: '/Users/zaykim/Downloads/영상모음/[키움 vs 롯데] 428 경기 I 2026 신한 SOL KBO 리그 I 하이라이트 I TVING-1920x1080-avc1-mp4a.mp4', count: 100 },
    ],
  },
];

async function probeDuration(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

async function makeThumbnail(input, output, atSec) {
  await exec('ffmpeg', [
    '-y',
    '-ss', String(atSec),
    '-i', input,
    '-vframes', '1',
    '-q:v', '3',
    output,
  ]);
}

async function makeClip(input, output, startSec, duration) {
  await exec('ffmpeg', [
    '-y',
    '-ss', String(startSec),
    '-i', input,
    '-t', String(duration),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '26',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=-2:${CLIP_HEIGHT}`,
    '-an',
    '-movflags', '+faststart',
    output,
  ]);
}

async function processCategory({ destCategory, sources }) {
  const destDir = path.join(ROOT, 'public', destCategory);
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });

  const items = [];
  let cardIdx = 0;

  for (const { label, src, count } of sources) {
    console.log(`[${destCategory}/${label}] ${path.basename(src)}`);
    const dur = await probeDuration(src);
    if (!dur) throw new Error(`Could not probe ${src}`);
    console.log(`   duration ${dur.toFixed(1)}s, ${count} captures`);

    const usable = Math.max(0.001, dur - CLIP_DURATION);

    for (let i = 0; i < count; i++) {
      const t = (count === 1) ? 0 : (i * usable) / (count - 1);
      cardIdx += 1;
      const stem = String(cardIdx).padStart(3, '0');
      const thumbOut = path.join(destDir, `${stem}.jpg`);
      const clipOut = path.join(destDir, `${stem}.mp4`);

      process.stdout.write(`   • ${stem}  @${t.toFixed(1)}s\n`);
      await makeThumbnail(src, thumbOut, t);
      await makeClip(src, clipOut, t, CLIP_DURATION);

      items.push({
        thumb: `/${destCategory}/${stem}.jpg`,
        clip: `/${destCategory}/${stem}.mp4`,
        stem,
      });
    }
  }
  return items;
}

async function main() {
  console.log('Converting videos…');
  const all = {};
  for (const cfg of CATEGORIES) {
    all[cfg.destCategory] = await processCategory(cfg);
  }

  const manifest = {};
  for (const items of Object.values(all)) {
    for (const e of items) manifest[e.thumb] = e.clip;
  }
  const manifestPath = path.join(ROOT, 'src', 'data', 'videoManifest.json');
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const fileList = {};
  for (const [cat, items] of Object.entries(all)) {
    fileList[cat] = items.map((e) => `${e.stem}.jpg`);
  }
  const fileListPath = path.join(ROOT, 'src', 'data', 'fileList.json');
  await writeFile(fileListPath, JSON.stringify(fileList, null, 2) + '\n');

  const total = Object.values(all).reduce((n, items) => n + items.length, 0);
  console.log(`\n${total} clip(s) written across ${Object.keys(all).length} categories.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
