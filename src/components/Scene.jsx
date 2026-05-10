import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import { FrontSide } from 'three';
import { Card, CARD_SIZE } from './Card';
import { IMAGES, SPHERE_RADIUS as SPHERE_R } from '../data/images';
import { shortName, timestampFor } from '../lib/cardLabels';
import { useTheme, colors } from '../lib/theme';

const DRAG_THRESHOLD = 4;

// Positions are computed once in data/images.js (so the image count and
// the sphere-slot count are guaranteed to match).
const CLOUD_POSITIONS = IMAGES.map((img) => img.position);
const CLOUD_INTRINSIC_YAW = CLOUD_POSITIONS.map((p) => Math.atan2(p[0], p[2]));

// Label sits a bit above the interstellar cluster, on the sphere surface.
const LABEL_POS = (() => {
  const y = 2.4;
  const z = Math.sqrt(Math.max(0, SPHERE_R * SPHERE_R - y * y));
  return [0, y, z];
})();

// Same-subgroup connection pairs. Each pair is stored separately so we
// can fade individual lines based on whether they're on the FRONT or
// BACK of the rotating sphere.
const SPHERE_LINE_PAIRS = (() => {
  const SEG = 40; // smoother curves — was 16
  const CARD_HALF_W = 0.7 / 2;
  const result = [];
  const seen = new Set();

  const bySub = {};
  for (const c of IMAGES) {
    if (!bySub[c.subgroup]) bySub[c.subgroup] = [];
    bySub[c.subgroup].push(c);
  }

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

  for (const card of IMAGES) {
    const peers = bySub[card.subgroup];
    if (!peers || peers.length < 2) continue;

    let nearest = null;
    let nearestD2 = Infinity;
    const cp = card.position;
    for (const o of peers) {
      if (o.id === card.id) continue;
      const op = o.position;
      const dx = op[0] - cp[0];
      const dy = op[1] - cp[1];
      const dz = op[2] - cp[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < nearestD2) {
        nearestD2 = d2;
        nearest = o;
      }
    }
    if (!nearest) continue;
    const key = card.id < nearest.id ? `${card.id}-${nearest.id}` : `${nearest.id}-${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tp = nearest.position;
    const yawS = Math.atan2(cp[0], cp[2]);
    const yawT = Math.atan2(tp[0], tp[2]);
    const rS = [Math.cos(yawS), 0, -Math.sin(yawS)];
    const rT = [Math.cos(yawT), 0, -Math.sin(yawT)];

    const p0 = [
      cp[0] + rS[0] * CARD_HALF_W,
      cp[1] + rS[1] * CARD_HALF_W,
      cp[2] + rS[2] * CARD_HALF_W,
    ];
    const p3 = [
      tp[0] - rT[0] * CARD_HALF_W,
      tp[1] - rT[1] * CARD_HALF_W,
      tp[2] - rT[2] * CARD_HALF_W,
    ];

    const dx = p3[0] - p0[0];
    const dy = p3[1] - p0[1];
    const dz = p3[2] - p0[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ctrlLen = dist * 0.4;

    const p1 = [
      p0[0] + rS[0] * ctrlLen,
      p0[1] + rS[1] * ctrlLen,
      p0[2] + rS[2] * ctrlLen,
    ];
    const p2 = [
      p3[0] - rT[0] * ctrlLen,
      p3[1] - rT[1] * ctrlLen,
      p3[2] - rT[2] * ctrlLen,
    ];

    const points = [];
    for (let i = 0; i <= SEG; i++) {
      points.push(cubBez(p0, p1, p2, p3, i / SEG));
    }
    const center = cubBez(p0, p1, p2, p3, 0.5);
    result.push({ points, center });
  }
  return result;
})();

export function Scene({ gridState, setGridState }) {
  const groupRef = useRef();
  const { gl, camera, size } = useThree();
  const theme = useTheme();
  const c = colors(theme);
  const aspect = size.width / Math.max(1, size.height);
  const isCompact = size.width < 700 || aspect < 1.3;
  const inGrid = !!gridState;

  // Cloud (globe) drag state
  const drag = useRef({
    active: false,
    lastX: 0, lastY: 0,
    rotX: 0, rotY: 0,
    vx: 0, vy: 0,
    moved: 0,
  });

  // Carousel scroll state — continuous, momentum-based.
  const carouselRef = useRef({
    scrollPos: 0,
    velocity: 0,
    active: false,
    lastX: 0,
    lastT: 0,
    moved: 0,
    targetScrollPos: null, // when set, scrollPos lerps toward this and ignores velocity
  });

  // Cloud-mode user zoom override (camera.position.z). null = use default.
  const cloudZoomRef = useRef(null);
  const CLOUD_Z_MIN = 4;
  const CLOUD_Z_MAX = 26;

  // Sphere connection lines — one ref per pair so we can fade lines on
  // the back of the sphere independently of those on the front.
  const lineRefs = useRef([]);

  // Tracks previous inGrid so we can SNAP the camera to the grid distance
  // on entry — guarantees the carousel always renders at the same size,
  // independent of how far the user had zoomed in cloud mode.
  const prevInGridRef = useRef(false);

  // Reset FOV on mount — other scenes (e.g. Space) may have changed it.
  useEffect(() => {
    camera.fov = 45;
    camera.updateProjectionMatrix();
  }, [camera]);

  const stepRef = useRef(1.4);
  const pendingFocusedId = useRef(null);

  useEffect(() => {
    const dom = gl.domElement;

    const onDown = (e) => {
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved = 0;

      if (inGrid) {
        carouselRef.current.active = true;
        carouselRef.current.lastX = e.clientX;
        carouselRef.current.lastT = performance.now();
        carouselRef.current.moved = 0;
        carouselRef.current.velocity = 0;
        carouselRef.current.targetScrollPos = null;
      } else {
        drag.current.active = true;
        drag.current.vx = 0;
        drag.current.vy = 0;
      }
    };

    const onMove = (e) => {
      if (carouselRef.current.active) {
        const now = performance.now();
        const dx = e.clientX - carouselRef.current.lastX;
        const dt = Math.max(1, now - carouselRef.current.lastT);

        const visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
        const pxToWorld = visH / size.height;
        const dxWorld = dx * pxToWorld;

        // Drag right (dx>0) → row visually moves right → focused goes BACK
        carouselRef.current.scrollPos += dxWorld;
        carouselRef.current.velocity = (dxWorld / dt) * 1000;
        carouselRef.current.lastX = e.clientX;
        carouselRef.current.lastT = now;
        carouselRef.current.moved += Math.abs(dx);
        return;
      }

      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.current.moved < DRAG_THRESHOLD) return;
      drag.current.rotY += dx * 0.005;
      drag.current.rotX += dy * 0.005;
      drag.current.rotX = Math.max(-1.0, Math.min(1.0, drag.current.rotX));
      drag.current.vx = dx * 0.005;
      drag.current.vy = dy * 0.005;
    };

    const onUp = () => {
      carouselRef.current.active = false;
      drag.current.active = false;
    };

    // Wheel / trackpad:
    //   - Grid mode → horizontal carousel scroll
    //   - Cloud mode → camera dolly in/out
    const onWheel = (e) => {
      if (inGrid) {
        const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(raw) < 0.1) return;
        e.preventDefault();
        const visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
        const pxToWorld = visH / size.height;
        carouselRef.current.scrollPos -= raw * pxToWorld;
        carouselRef.current.velocity = 0;
        carouselRef.current.targetScrollPos = null;
        return;
      }
      // Cloud mode: dolly the camera. Trackpad pinch and wheel both deliver
      // deltaY. Positive deltaY = scroll down = zoom OUT.
      if (Math.abs(e.deltaY) < 0.1) return;
      e.preventDefault();
      const baseZ = isCompact ? 14 : 12;
      const current = cloudZoomRef.current ?? baseZ;
      const next = current + e.deltaY * 0.012;
      cloudZoomRef.current = Math.max(CLOUD_Z_MIN, Math.min(CLOUD_Z_MAX, next));
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, inGrid, camera, size.height, isCompact]);

  useFrame((state, delta) => {
    const lerp = 1 - Math.exp(-5 * delta);

    if (groupRef.current) {
      let targetRotX = 0, targetRotY = 0;
      if (!inGrid) {
        if (!drag.current.active) {
          drag.current.rotY += drag.current.vx;
          drag.current.rotX += drag.current.vy;
          drag.current.vx *= 0.93;
          drag.current.vy *= 0.93;
          drag.current.rotX = Math.max(-1.0, Math.min(1.0, drag.current.rotX));
          drag.current.rotY += 0.0014;
        }
        targetRotX = drag.current.rotX;
        targetRotY = drag.current.rotY;
        const pointer = state.pointer;
        targetRotY += pointer.x * 0.08;
        targetRotX += -pointer.y * 0.05;
      }
      groupRef.current.rotation.x +=
        (targetRotX - groupRef.current.rotation.x) * lerp;
      groupRef.current.rotation.y +=
        (targetRotY - groupRef.current.rotation.y) * lerp;
    }

    // Carousel scroll updates
    const car = carouselRef.current;
    if (gridState && stepRef.current > 0) {
      const step = stepRef.current;

      // 1) Animate toward targetScrollPos (used when clicking another card)
      if (car.targetScrollPos != null) {
        const diff = car.targetScrollPos - car.scrollPos;
        if (Math.abs(diff) < 0.001) {
          car.scrollPos = car.targetScrollPos;
          car.targetScrollPos = null;
          car.velocity = 0;
        } else {
          const decay = 1 - Math.exp(-7 * delta);
          car.scrollPos += diff * decay;
        }
      } else if (!car.active) {
        // 2) Apply momentum from drag release
        if (Math.abs(car.velocity) > 0.001) {
          car.scrollPos += car.velocity * delta;
          car.velocity *= Math.exp(-3.0 * delta);
        }
        // 3) When momentum is gone, settle to the NEAREST snap point
        if (Math.abs(car.velocity) < 0.05) {
          const target = Math.round(car.scrollPos / step) * step;
          const decay = 1 - Math.exp(-7 * delta);
          car.scrollPos += (target - car.scrollPos) * decay;
          if (Math.abs(target - car.scrollPos) < 0.001 &&
              Math.abs(car.velocity) < 0.01) {
            car.scrollPos = target;
            car.velocity = 0;
          }
        }
      }

      // Clamp to row bounds
      const minScroll = (gridState.anchorIdx - (gridState.rowIds.length - 1)) * step;
      const maxScroll = gridState.anchorIdx * step;
      if (car.scrollPos > maxScroll) {
        car.scrollPos = maxScroll;
        car.velocity = 0;
      } else if (car.scrollPos < minScroll) {
        car.scrollPos = minScroll;
        car.velocity = 0;
      }

      // Derive current focusedId
      const stepsFromAnchor = Math.round(car.scrollPos / step);
      const fIdx = Math.max(
        0,
        Math.min(gridState.rowIds.length - 1, gridState.anchorIdx - stepsFromAnchor)
      );
      const newFocusedId = gridState.rowIds[fIdx];
      if (newFocusedId !== gridState.focusedId) {
        pendingFocusedId.current = newFocusedId;
      }
    }

    // Camera animation. Cloud mode honors the user's wheel-zoom override
    // when present; grid mode uses its own fixed distance.
    const cloudZBase = isCompact ? 14 : 12;
    const cloudZ = cloudZoomRef.current ?? cloudZBase;
    const gridZ = isCompact ? 13 : 9;

    // SNAP camera to a canonical state the moment we enter grid view —
    // forces the carousel to render at the SAME size regardless of which
    // scene the user came from or how much they had zoomed.
    if (inGrid && !prevInGridRef.current) {
      camera.position.set(0, 0, gridZ);
      camera.fov = 45;
      camera.updateProjectionMatrix();
    }
    prevInGridRef.current = inGrid;

    const targetCamZ = inGrid ? gridZ : cloudZ;
    camera.position.z += (targetCamZ - camera.position.z) * lerp;
    camera.position.x += (0 - camera.position.x) * lerp;
    camera.position.y += (0 - camera.position.y) * lerp;
    camera.lookAt(0, 0, 0);

    // Sphere connection lines:
    //   • Hidden in grid mode
    //   • Hidden on the BACK of the sphere
    //   • Visible at FULL opacity on the front (#E2E2E2)
    if (groupRef.current && lineRefs.current.length > 0) {
      const camPos = camera.position;
      const camLen = Math.hypot(camPos.x, camPos.y, camPos.z) || 1;
      const cnx = camPos.x / camLen;
      const cny = camPos.y / camLen;
      const cnz = camPos.z / camLen;

      const m = groupRef.current.matrixWorld.elements;

      for (let i = 0; i < SPHERE_LINE_PAIRS.length; i++) {
        const lineObj = lineRefs.current[i];
        if (!lineObj || !lineObj.material) continue;
        const c = SPHERE_LINE_PAIRS[i].center;
        const wx = m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12];
        const wy = m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13];
        const wz = m[2] * c[0] + m[6] * c[1] + m[10] * c[2] + m[14];
        const wlen = Math.hypot(wx, wy, wz) || 1;
        const nx = wx / wlen;
        const ny = wy / wlen;
        const nz = wz / wlen;
        const facing = nx * cnx + ny * cny + nz * cnz;
        let frontFactor = 0;
        if (facing > 0.3) frontFactor = 1;
        else if (facing > 0) frontFactor = facing / 0.3;

        const targetOp = inGrid ? 0 : frontFactor * 0.1;
        const cur = lineObj.material.opacity;
        lineObj.material.opacity = cur + (targetOp - cur) * lerp;
        lineObj.material.transparent = true;
      }
    }
  });

  // Apply pending focusedId update on next tick (avoids state-set-in-frame).
  useEffect(() => {
    if (!gridState || !pendingFocusedId.current) return;
    if (pendingFocusedId.current === gridState.focusedId) {
      pendingFocusedId.current = null;
      return;
    }
    const id = requestAnimationFrame(() => {
      const next = pendingFocusedId.current;
      pendingFocusedId.current = null;
      if (next && gridState && next !== gridState.focusedId) {
        setGridState({ ...gridState, focusedId: next });
      }
    });
    return () => cancelAnimationFrame(id);
  });

  function buildRow(focusedId) {
    const card = IMAGES.find((i) => i.id === focusedId);
    if (!card) return { rowIds: [focusedId], anchorIdx: 0 };
    const rel = card.relatedIds.slice();
    const half = Math.floor(rel.length / 2);
    const rowIds = [...rel.slice(0, half), focusedId, ...rel.slice(half)];
    return { rowIds, anchorIdx: half };
  }

  const SELECTED_SCALE = isCompact ? 5.0 : 8.5;
  // Related cards 1.5× bigger than before — they may slightly overlap the
  // focused card, that's intentional for a layered carousel feel.
  const RELATED_SCALE = isCompact ? 2.88 : 4.5;
  const SPACING = isCompact ? 0.22 : 0.4;

  const step = useMemo(
    () => (SELECTED_SCALE * CARD_SIZE.w) / 2 + SPACING + (RELATED_SCALE * CARD_SIZE.w) / 2,
    [SELECTED_SCALE, RELATED_SCALE, SPACING]
  );
  stepRef.current = step;

  const rowIndex = useMemo(() => {
    if (!inGrid) return null;
    const m = new Map();
    gridState.rowIds.forEach((id, i) => m.set(id, i));
    return m;
  }, [inGrid, gridState]);

  const anchorIdx = inGrid ? gridState.anchorIdx : 0;

  return (
    <group ref={groupRef}>
      {/* Group label for the Interstellar cluster — rotates with the globe */}
      <Text
        position={LABEL_POS}
        fontSize={0.096}
        color={c.fg}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        material-side={FrontSide}
        material-toneMapped={false}
        visible={!inGrid}
      >
        INTERSTELLAR
      </Text>

      {/* Same-subgroup connection lines, one <Line> per pair so each
          line can fade independently based on whether it's on the
          camera-facing side of the sphere. Opacity is updated each
          frame in useFrame. */}
      {SPHERE_LINE_PAIRS.map((pair, i) => (
        <Line
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          points={pair.points}
          color={c.line}
          lineWidth={1}
          transparent
          opacity={0}
          depthWrite={false}
        />
      ))}

      {IMAGES.map((img, i) => {
        const ri = rowIndex ? rowIndex.get(img.id) : undefined;
        const rowIdx = ri === undefined ? -1 : ri;
        return (
          <Card
            key={img.id}
            image={img}
            inCloud={!inGrid}
            cloudPosition={CLOUD_POSITIONS[i]}
            rowIdx={rowIdx}
            anchorIdx={anchorIdx}
            step={step}
            selectedScale={SELECTED_SCALE}
            relatedScale={RELATED_SCALE}
            carouselRef={carouselRef}
            intrinsicYaw={CLOUD_INTRINSIC_YAW[i]}
            label={shortName(img)}
            timestamp={timestampFor(img)}
            onClick={() => {
              if (drag.current.moved > DRAG_THRESHOLD * 2) return;
              if (carouselRef.current.moved > DRAG_THRESHOLD * 2) return;
              if (!inGrid) {
                const { rowIds, anchorIdx: aIdx } = buildRow(img.id);
                carouselRef.current.scrollPos = 0;
                carouselRef.current.velocity = 0;
                carouselRef.current.targetScrollPos = null;
                setGridState({ rowIds, focusedId: img.id, anchorIdx: aIdx });
              } else if (rowIdx >= 0 && img.id !== gridState.focusedId) {
                // Animate scrollPos so the clicked card slides to center.
                carouselRef.current.targetScrollPos =
                  (gridState.anchorIdx - rowIdx) * step;
                carouselRef.current.velocity = 0;
              }
            }}
          />
        );
      })}
    </group>
  );
}
