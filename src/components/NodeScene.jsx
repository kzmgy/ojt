import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import {
  TextureLoader,
  SRGBColorSpace,
  LinearFilter,
  DoubleSide,
  MOUSE,
  TOUCH,
  Color,
} from 'three';
import { IMAGES } from '../data/images';
import { makeRoundedMaterial, CORNER_RADIUS } from '../lib/roundedMaterial';
import { shortName, timestampFor, KOREAN_FONT } from '../lib/cardLabels';
import { useTheme, colors } from '../lib/theme';

const REGIONS = {
  interstellar: { cy:  6.0, label: '인터스텔라' },
  baseball:     { cy: -6.0, label: '야구' },
};

// Variable card counts per column — tree-ish, non-grid layout. Sum =
// CARDS_PER_GROUP. With 100 cards per group across 10 columns, max
// column height stays around 13 so the OrbitControls pan handles the rest.
const COLUMN_COUNTS = [8, 11, 13, 9, 10, 11, 13, 10, 8, 7]; // sum = 100
const CARDS_PER_GROUP = COLUMN_COUNTS.reduce((a, b) => a + b, 0);
const NUM_COLS = COLUMN_COUNTS.length;

const COL_SPACING = 1.95;
const ROW_SPACING = 0.95;

const CARD_W = 0.78;
const CARD_H = 0.78 * 9 / 16;

function srand(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// Cubic bezier evaluator
function cubBez(p0, p1, p2, p3, t) {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    omt3 * p0[0] + 3 * omt2 * t * p1[0] + 3 * omt * t2 * p2[0] + t3 * p3[0],
    omt3 * p0[1] + 3 * omt2 * t * p1[1] + 3 * omt * t2 * p2[1] + t3 * p3[1],
    omt3 * p0[2] + 3 * omt2 * t * p1[2] + 3 * omt * t2 * p2[2] + t3 * p3[2],
  ];
}

// Build the layout. Columns share X across all groups (vertical alignment),
// but each column in each group has its own Y offset (rows aren't aligned).
function nodeLayout() {
  const grouped = { interstellar: [], baseball: [] };
  for (const img of IMAGES) {
    if (!grouped[img.subgroup]) continue;
    if (grouped[img.subgroup].length >= CARDS_PER_GROUP) continue;
    grouped[img.subgroup].push(img);
  }

  const sampled = [];
  const positions = new Map();
  // columns[subgroup][colIdx] = [card, card, ...] (top→bottom in column)
  const columns = {};

  for (const [key, list] of Object.entries(grouped)) {
    const region = REGIONS[key];
    columns[key] = COLUMN_COUNTS.map(() => []);

    let cardIdx = 0;
    for (let col = 0; col < NUM_COLS; col++) {
      const count = COLUMN_COUNTS[col];
      // Per-column vertical offset jitter — rows aren't aligned across columns.
      const r = srand(col * 31 + key.charCodeAt(0) * 7 + 1);
      const yOffset = (r() - 0.5) * 0.9;
      const colCenterY = region.cy + yOffset;
      const colX = (col - (NUM_COLS - 1) / 2) * COL_SPACING;

      for (let row = 0; row < count; row++) {
        if (cardIdx >= list.length) break;
        const card = list[cardIdx++];
        const y = colCenterY + (row - (count - 1) / 2) * ROW_SPACING;
        positions.set(card.id, [colX, y, 0]);
        columns[key][col].push(card);
        sampled.push(card);
      }
    }
  }

  return { sampled, positions, columns };
}

function NodeCard({ image, position, label, timestamp, onClick }) {
  const imgRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState(null);
  const theme = useTheme();
  const c = colors(theme);

  const material = useMemo(
    () =>
      makeRoundedMaterial({
        color: 0xe5e5e5,
        opacity: 1,
        halfW: CARD_W / 2,
        halfH: CARD_H / 2,
        side: DoubleSide,
        radius: CORNER_RADIUS,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    let alive = true;
    new TextureLoader().load(
      image.src,
      (tex) => {
        if (!alive) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        tex.generateMipmaps = false;
        const cardAspect = CARD_W / CARD_H;
        const imgAspect = tex.image.width / tex.image.height;
        if (imgAspect > cardAspect) {
          tex.repeat.x = cardAspect / imgAspect;
          tex.offset.x = (1 - tex.repeat.x) / 2;
          tex.repeat.y = 1;
          tex.offset.y = 0;
        } else {
          tex.repeat.x = 1;
          tex.repeat.y = imgAspect / cardAspect;
          tex.offset.x = 0;
          tex.offset.y = (1 - tex.repeat.y) / 2;
        }
        setTexture(tex);
      },
      undefined,
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [image.src]);

  useEffect(() => {
    if (texture) {
      material.map = texture;
      material.color = new Color(0xffffff);
      material.needsUpdate = true;
    }
  }, [texture, material]);

  useFrame((_, delta) => {
    const obj = imgRef.current;
    if (!obj) return;
    const targetScale = hovered ? 1.4 : 1.0;
    const targetZ = hovered ? 0.4 : 0.05;
    const lerp = 1 - Math.exp(-14 * delta);
    const cs = obj.scale.x;
    const ns = cs + (targetScale - cs) * lerp;
    obj.scale.set(ns, ns, ns);
    obj.position.z = obj.position.z + (targetZ - obj.position.z) * lerp;
  });

  return (
    <group position={position}>
      <group ref={imgRef} position={[0, 0, 0.05]}>
        <mesh
          material={material}
          renderOrder={2}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = '';
          }}
          onClick={
            onClick
              ? (e) => {
                  e.stopPropagation();
                  onClick();
                }
              : undefined
          }
        >
          <planeGeometry args={[CARD_W, CARD_H]} />
        </mesh>
      </group>
      <Suspense fallback={null}>
        <Text
          font={KOREAN_FONT}
          position={[0, -CARD_H / 2 - 0.07, 0.03]}
          fontSize={0.085}
          color={c.fg}
          anchorX="center"
          anchorY="top"
          renderOrder={3}
        >
          {label}
        </Text>
        <Text
          font={KOREAN_FONT}
          position={[0, -CARD_H / 2 - 0.19, 0.03]}
          fontSize={0.06}
          color={c.dim}
          anchorX="center"
          anchorY="top"
          renderOrder={3}
        >
          {timestamp}
        </Text>
      </Suspense>
    </group>
  );
}

export function NodeScene({ onCardClick }) {
  const { camera } = useThree();
  const theme = useTheme();
  const c = colors(theme);

  useEffect(() => {
    camera.position.set(0, 0, 16);
    camera.fov = 45;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const { sampled, positions, columns } = useMemo(() => nodeLayout(), []);

  // Connections: each card → ONE card in the next column (the closest in
  // Y). Line goes from RIGHT-CENTER of source to LEFT-CENTER of target.
  // Stays within the same subgroup.
  const lineSegments = useMemo(() => {
    const out = [];
    const SEG = 16;
    function pushCubic(start, end) {
      const dx = end[0] - start[0];
      const ctrl1 = [start[0] + dx * 0.5, start[1], 0];
      const ctrl2 = [end[0] - dx * 0.5, end[1], 0];
      for (let i = 0; i < SEG; i++) {
        out.push(cubBez(start, ctrl1, ctrl2, end, i / SEG));
        out.push(cubBez(start, ctrl1, ctrl2, end, (i + 1) / SEG));
      }
    }
    for (const key of Object.keys(columns)) {
      const cols = columns[key];
      for (let c = 0; c < cols.length - 1; c++) {
        const sources = cols[c];
        const targets = cols[c + 1];
        if (targets.length === 0) continue;
        for (const src of sources) {
          const sPos = positions.get(src.id);
          // Pick the target whose Y is closest to source Y.
          let bestT = null;
          let bestDy = Infinity;
          for (const t of targets) {
            const tPos = positions.get(t.id);
            const dy = Math.abs(tPos[1] - sPos[1]);
            if (dy < bestDy) {
              bestDy = dy;
              bestT = t;
            }
          }
          if (!bestT) continue;
          const tPos = positions.get(bestT.id);
          const sRight = [sPos[0] + CARD_W / 2, sPos[1], sPos[2]];
          const tLeft = [tPos[0] - CARD_W / 2, tPos[1], tPos[2]];
          pushCubic(sRight, tLeft);
        }
      }
    }
    return out;
  }, [columns, positions]);

  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        enableRotate={false}
        screenSpacePanning
        minDistance={3}
        maxDistance={70}
        zoomSpeed={1.1}
        panSpeed={1.0}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />

      {lineSegments.length > 0 && (
        <Line
          points={lineSegments}
          segments
          color={c.line}
          lineWidth={1}
          transparent
          opacity={0.1}
          renderOrder={-1}
          depthWrite={false}
        />
      )}

      <Suspense fallback={null}>
        {Object.entries(REGIONS).map(([key, region]) => (
          <Text
            key={key}
            font={KOREAN_FONT}
            position={[
              -((NUM_COLS - 1) / 2) * COL_SPACING - 1.4,
              region.cy,
              0,
            ]}
            fontSize={0.22}
            color={c.fg}
            anchorX="right"
            anchorY="middle"
            letterSpacing={0.05}
          >
            {region.label}
          </Text>
        ))}
      </Suspense>

      {sampled.map((img) => {
        const pos = positions.get(img.id);
        if (!pos) return null;
        return (
          <NodeCard
            key={img.id}
            image={img}
            position={pos}
            label={shortName(img)}
            timestamp={timestampFor(img)}
            onClick={onCardClick ? () => onCardClick(img) : undefined}
          />
        );
      })}
    </>
  );
}
