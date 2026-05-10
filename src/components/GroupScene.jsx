import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import {
  TextureLoader,
  SRGBColorSpace,
  LinearFilter,
  DoubleSide,
  Color,
} from 'three';
import { IMAGES } from '../data/images';
import { makeRoundedMaterial, CORNER_RADIUS } from '../lib/roundedMaterial';
import { useTheme, colors } from '../lib/theme';

// All three hemispheres are the same size now (between the previous
// interstellar and baseball sizes). Card sizes also unified.
const HEMI_RADIUS = 3.05;
const HEMI_CARD_SIZE = 0.48;

const HEMISPHERES = [
  { key: 'interstellar', color: '#7a8cc8', label: 'INTERSTELLAR' },
  { key: 'baseball',     color: '#8fbb8c', label: 'BASEBALL' },
  { key: 'hongkong',     color: '#d68bb0', label: 'HONGKONG' },
];

// Carousel slot positions: [front-center, back-right, back-left]
const SLOTS = [
  { pos: [0, -0.5,  1.5], scale: 1.0 },
  { pos: [5.5, -0.8, -3], scale: 0.55 },
  { pos: [-5.5, -0.8, -3], scale: 0.55 },
];

// Distribute N points on the *top* hemisphere of radius R using a
// half-sphere fibonacci spiral.
function fibTopHemisphere(N, R) {
  const out = [];
  if (N <= 0) return out;
  const offset = 1 / N;
  const inc = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = i * offset + offset / 2;       // 0 → 1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * inc;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    // Slight outward push so cards don't z-fight with the dome surface
    const k = 1.005;
    out.push([x * R * k, y * R * k, z * R * k]);
  }
  return out;
}

function HemiCard({ image, position, width, height, onClick }) {
  const groupRef = useRef();
  const [texture, setTexture] = useState(null);

  const material = useMemo(
    () =>
      makeRoundedMaterial({
        color: 0xe5e5e5,
        opacity: 1,
        halfW: width / 2,
        halfH: height / 2,
        side: DoubleSide,
        radius: CORNER_RADIUS,
      }),
    [width, height]
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    let alive = true;
    new TextureLoader().load(image.src, (tex) => {
      if (!alive) {
        tex.dispose();
        return;
      }
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      const cardAspect = width / height;
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
    });
    return () => {
      alive = false;
    };
  }, [image.src, width, height]);

  useEffect(() => {
    if (texture) {
      material.map = texture;
      material.color = new Color(0xffffff);
      material.needsUpdate = true;
    }
  }, [texture, material]);

  // Make card face radially outward from hemisphere center
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(position[0] * 2, position[1] * 2, position[2] * 2);
    }
  }, [position]);

  return (
    <group ref={groupRef} position={position}>
      <mesh
        material={material}
        onClick={
          onClick
            ? (e) => {
                e.stopPropagation();
                onClick();
              }
            : undefined
        }
      >
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

function Hemisphere({ hem, slot, isSelected, onSelect, onCardClick }) {
  const groupRef = useRef();
  const theme = useTheme();
  const c = colors(theme);
  const cards = useMemo(
    () => IMAGES.filter((img) => img.subgroup === hem.key),
    [hem.key]
  );
  const cardPositions = useMemo(
    () => fibTopHemisphere(cards.length, HEMI_RADIUS),
    [cards.length]
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const lerp = 1 - Math.exp(-5 * delta);
    groupRef.current.position.x +=
      (slot.pos[0] - groupRef.current.position.x) * lerp;
    groupRef.current.position.y +=
      (slot.pos[1] - groupRef.current.position.y) * lerp;
    groupRef.current.position.z +=
      (slot.pos[2] - groupRef.current.position.z) * lerp;
    groupRef.current.scale.x +=
      (slot.scale - groupRef.current.scale.x) * lerp;
    groupRef.current.scale.y +=
      (slot.scale - groupRef.current.scale.y) * lerp;
    groupRef.current.scale.z +=
      (slot.scale - groupRef.current.scale.z) * lerp;
  });

  // Three concentric semi-transparent dome layers fake a soft "blur"
  // glow — the colour fades softly toward the rim instead of having a
  // hard sphere edge.
  const domeLayers = [
    { r: HEMI_RADIUS * 0.96, op: isSelected ? 0.10 : 0.07 },
    { r: HEMI_RADIUS * 1.02, op: isSelected ? 0.08 : 0.06 },
    { r: HEMI_RADIUS * 1.10, op: isSelected ? 0.06 : 0.04 },
    { r: HEMI_RADIUS * 1.18, op: isSelected ? 0.04 : 0.025 },
  ];

  return (
    <group ref={groupRef}>
      {/* Soft, blurred dome — multiple translucent layers */}
      {domeLayers.map((layer, i) => (
        <mesh
          key={i}
          onClick={
            i === 0
              ? (e) => {
                  e.stopPropagation();
                  onSelect();
                }
              : undefined
          }
        >
          <sphereGeometry
            args={[layer.r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshBasicMaterial
            color={hem.color}
            transparent
            opacity={layer.op}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Cards on hemisphere surface */}
      {cards.map((card, i) => (
        <HemiCard
          key={card.id}
          image={card}
          position={cardPositions[i]}
          width={HEMI_CARD_SIZE * 16 / 9}
          height={HEMI_CARD_SIZE}
          onClick={
            isSelected && onCardClick ? () => onCardClick(card) : () => onSelect()
          }
        />
      ))}

      {/* Group label above hemisphere */}
      <Text
        position={[0, HEMI_RADIUS + 0.4, 0]}
        fontSize={0.28}
        color={c.fg}
        anchorX="center"
        anchorY="bottom"
        letterSpacing={0.06}
      >
        {hem.label}
      </Text>
    </group>
  );
}

export function GroupScene({ onCardClick }) {
  const { camera } = useThree();
  const [selected, setSelected] = useState('interstellar');

  // Reset camera when entering this scene
  useEffect(() => {
    camera.position.set(0, 1.5, 14);
    camera.fov = 45;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const sIdx = HEMISPHERES.findIndex((h) => h.key === selected);

  // Map each hemisphere to a slot. Selected → slot 0; others fill slots
  // 1, 2 in their original order.
  const slotMap = useMemo(() => {
    const m = new Map();
    let nextSlot = 1;
    HEMISPHERES.forEach((h, i) => {
      if (i === sIdx) m.set(h.key, SLOTS[0]);
      else m.set(h.key, SLOTS[nextSlot++]);
    });
    return m;
  }, [sIdx]);

  return (
    <>
      {HEMISPHERES.map((hem) => (
        <Hemisphere
          key={hem.key}
          hem={hem}
          slot={slotMap.get(hem.key)}
          isSelected={selected === hem.key}
          onSelect={() => setSelected(hem.key)}
          onCardClick={onCardClick}
        />
      ))}
    </>
  );
}
