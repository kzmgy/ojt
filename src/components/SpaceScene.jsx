import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import {
  TextureLoader,
  SRGBColorSpace,
  LinearFilter,
  DoubleSide,
  Color,
} from 'three';
import { IMAGES } from '../data/images';
import { makeRoundedMaterial, CORNER_RADIUS } from '../lib/roundedMaterial';
import { shortName, timestampFor, KOREAN_FONT } from '../lib/cardLabels';
import { useTheme, colors } from '../lib/theme';

// Cards from data/images.js sit on a sphere of radius 5. Multiply by
// SPACE_SCALE so the user (camera at origin) is INSIDE a much larger
// sphere — gives the "vast space surrounding you" feel.
const SPACE_SCALE = 1.85;
const CARD_W = 0.98;
const CARD_H = (CARD_W * 9) / 16;

const SPACE_POSITIONS = IMAGES.map((img) => [
  img.position[0] * SPACE_SCALE,
  img.position[1] * SPACE_SCALE,
  img.position[2] * SPACE_SCALE,
]);

// Same-subgroup connection lines. Each card → its nearest peer.
// Cubic bezier with HORIZONTAL TANGENTS that exit/enter from the
// LEFT or RIGHT edge of each card (never the centre). Same curve
// style as the Sphere/Node views.
const SPACE_LINE_PAIRS = (() => {
  const SEG = 40;
  const CARD_HALF_W = CARD_W / 2;
  const result = [];
  const seen = new Set();

  const bySub = {};
  IMAGES.forEach((c, i) => {
    if (!bySub[c.subgroup]) bySub[c.subgroup] = [];
    bySub[c.subgroup].push({ id: c.id, subgroup: c.subgroup, pos: SPACE_POSITIONS[i] });
  });

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

  for (const groupKey of Object.keys(bySub)) {
    const peers = bySub[groupKey];
    for (const card of peers) {
      let nearest = null;
      let nearestD2 = Infinity;
      for (const o of peers) {
        if (o.id === card.id) continue;
        const dx = o.pos[0] - card.pos[0];
        const dy = o.pos[1] - card.pos[1];
        const dz = o.pos[2] - card.pos[2];
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

      const a = card.pos;
      const b = nearest.pos;

      // Each card's horizontal "right" direction (perpendicular to its
      // outward radial axis, in the world XZ plane).
      const yawA = Math.atan2(a[0], a[2]);
      const yawB = Math.atan2(b[0], b[2]);
      const rA = [Math.cos(yawA), 0, -Math.sin(yawA)];
      const rB = [Math.cos(yawB), 0, -Math.sin(yawB)];

      // Pick the side of A that faces B (left vs right) and same for B.
      const aToB = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const dotA = aToB[0] * rA[0] + aToB[1] * rA[1] + aToB[2] * rA[2];
      const exitDir = dotA >= 0 ? rA : [-rA[0], -rA[1], -rA[2]];
      const exitA = [
        a[0] + exitDir[0] * CARD_HALF_W,
        a[1] + exitDir[1] * CARD_HALF_W,
        a[2] + exitDir[2] * CARD_HALF_W,
      ];

      const bToA = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const dotB = bToA[0] * rB[0] + bToA[1] * rB[1] + bToA[2] * rB[2];
      const entryDir = dotB >= 0 ? rB : [-rB[0], -rB[1], -rB[2]];
      const entryB = [
        b[0] + entryDir[0] * CARD_HALF_W,
        b[1] + entryDir[1] * CARD_HALF_W,
        b[2] + entryDir[2] * CARD_HALF_W,
      ];

      const dx = entryB[0] - exitA[0];
      const dy = entryB[1] - exitA[1];
      const dz = entryB[2] - exitA[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ctrlLen = dist * 0.4;

      const p0 = exitA;
      const p1 = [
        exitA[0] + exitDir[0] * ctrlLen,
        exitA[1] + exitDir[1] * ctrlLen,
        exitA[2] + exitDir[2] * ctrlLen,
      ];
      const p3 = entryB;
      const p2 = [
        entryB[0] + entryDir[0] * ctrlLen,
        entryB[1] + entryDir[1] * ctrlLen,
        entryB[2] + entryDir[2] * ctrlLen,
      ];

      const points = [];
      for (let i = 0; i <= SEG; i++) {
        points.push(cubBez(p0, p1, p2, p3, i / SEG));
      }
      const center = cubBez(p0, p1, p2, p3, 0.5);
      result.push({ points, center });
    }
  }
  return result;
})();

function SpaceCard({ image, position, label, timestamp, onClick }) {
  const groupRef = useRef();
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

  // Each card faces the camera at origin (inward).
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(0, 0, 0);
    }
  }, [position]);

  return (
    <group ref={groupRef} position={position}>
      <mesh
        material={material}
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
      <Suspense fallback={null}>
        <Text
          font={KOREAN_FONT}
          position={[0, -CARD_H / 2 - 0.10, 0.001]}
          fontSize={0.096}
          color={c.fg}
          letterSpacing={-0.032}
          anchorX="center"
          anchorY="top"
          material-transparent
          material-opacity={0.7}
        >
          {label}
        </Text>
        <Text
          font={KOREAN_FONT}
          position={[0, -CARD_H / 2 - 0.27, 0.001]}
          fontSize={0.068}
          color={c.fg}
          letterSpacing={-0.02}
          anchorX="center"
          anchorY="top"
          material-transparent
          material-opacity={0.5}
        >
          {timestamp}
        </Text>
      </Suspense>
    </group>
  );
}

export function SpaceScene({ onCardClick }) {
  const { camera, gl } = useThree();
  const theme = useTheme();
  const c = colors(theme);

  const drag = useRef({ active: false, lastX: 0, lastY: 0, moved: 0 });
  const lookState = useRef({ yaw: 0, pitch: 0, vx: 0, vy: 0 });
  const fovRef = useRef(75);
  const lineRefs = useRef([]);

  // Reset camera on enter
  useEffect(() => {
    camera.position.set(0, 0, 0);
    camera.fov = 75;
    camera.near = 0.05;
    camera.far = 100;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const dom = gl.domElement;

    const onDown = (e) => {
      drag.current.active = true;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved = 0;
      lookState.current.vx = 0;
      lookState.current.vy = 0;
    };

    const onMove = (e) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.current.moved < 4) return;
      lookState.current.yaw -= dx * 0.0045;
      lookState.current.pitch -= dy * 0.0045;
      lookState.current.vx = -dx * 0.0045;
      lookState.current.vy = -dy * 0.0045;
      const HALF_PI = Math.PI / 2 - 0.05;
      lookState.current.pitch = Math.max(
        -HALF_PI,
        Math.min(HALF_PI, lookState.current.pitch)
      );
    };

    const onUp = () => {
      drag.current.active = false;
    };

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 0.1) return;
      e.preventDefault();
      const next = fovRef.current + e.deltaY * 0.04;
      // FOV min lowered to 8° → much stronger zoom-in possible.
      fovRef.current = Math.max(8, Math.min(110, next));
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
  }, [gl]);

  useFrame((_, delta) => {
    const lerp = 1 - Math.exp(-7 * delta);

    // Inertial decay + gentle auto-rotation (like a planetarium drift)
    // when the user isn't actively dragging.
    if (!drag.current.active) {
      lookState.current.yaw += lookState.current.vx;
      lookState.current.pitch += lookState.current.vy;
      lookState.current.vx *= 0.92;
      lookState.current.vy *= 0.92;
      // Slow yaw drift — same feel as Sphere's auto-rotate.
      lookState.current.yaw += 0.0012;
      const HALF_PI = Math.PI / 2 - 0.05;
      lookState.current.pitch = Math.max(
        -HALF_PI,
        Math.min(HALF_PI, lookState.current.pitch)
      );
    }

    camera.rotation.order = 'YXZ';
    camera.rotation.y +=
      (lookState.current.yaw - camera.rotation.y) * lerp;
    camera.rotation.x +=
      (lookState.current.pitch - camera.rotation.x) * lerp;
    camera.rotation.z = 0;

    const targetFov = fovRef.current;
    camera.fov += (targetFov - camera.fov) * lerp;
    camera.updateProjectionMatrix();

    // Connection lines always visible at low opacity (#0a0a0a, 10%)
    for (let i = 0; i < lineRefs.current.length; i++) {
      const ln = lineRefs.current[i];
      if (!ln || !ln.material) continue;
      const cur = ln.material.opacity;
      ln.material.opacity = cur + (0.1 - cur) * lerp;
      ln.material.transparent = true;
    }
  });

  return (
    <>
      {SPACE_LINE_PAIRS.map((pair, i) => (
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

      {IMAGES.map((img, i) => (
        <SpaceCard
          key={img.id}
          image={img}
          position={SPACE_POSITIONS[i]}
          label={shortName(img)}
          timestamp={timestampFor(img)}
          onClick={() => {
            if (drag.current.moved > 8) return;
            onCardClick && onCardClick(img);
          }}
        />
      ))}
    </>
  );
}
