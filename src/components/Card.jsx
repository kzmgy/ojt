import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import {
  TextureLoader,
  VideoTexture,
  SRGBColorSpace,
  LinearFilter,
  Vector3,
  Quaternion,
  Euler,
  Color,
} from 'three';
import { makeRoundedMaterial, CORNER_RADIUS } from '../lib/roundedMaterial';
import { KOREAN_FONT } from '../lib/cardLabels';
import { useTheme, colors } from '../lib/theme';

const CARD_W = 0.7;
const CARD_H = 0.7 * 9 / 16;
const BORDER = 0.022;
const CARD_ASPECT = CARD_W / CARD_H;

const _worldPos = new Vector3();
const _outwardDir = new Vector3();
const _parentQuat = new Quaternion();
const _worldQuat = new Quaternion();
const _euler = new Euler();

// (rounded-rect material moved to ../lib/roundedMaterial.js)

export function Card({
  image,
  inCloud,
  cloudPosition,
  rowIdx,         // index in current row, or -1 if not in row
  anchorIdx,      // pinned center reference (does NOT change with scroll)
  step,
  selectedScale,
  relatedScale,
  carouselRef,
  intrinsicYaw,
  label,
  timestamp,
  onClick,
}) {
  const animRef = useRef();
  const labelRef = useRef();
  const timeRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState(null);
  const [videoTexture, setVideoTexture] = useState(null);
  const transRef = useRef(inCloud ? 0 : 1);

  // Video plays only while the card is part of the carousel row AND has a clip.
  const isInRowWithVideo = !inCloud && rowIdx >= 0 && !!image.videoSrc;

  // No border for any photo card (all 3 groups are real photos now).
  const hasBorder = false;

  const imageMat = useMemo(
    () => makeRoundedMaterial({
      color: 0x0a0a0a,
      opacity: 1,
      halfW: CARD_W / 2,
      halfH: CARD_H / 2,
    }),
    []
  );
  const borderMat = useMemo(
    () => makeRoundedMaterial({
      color: 0x0a0a0a,
      opacity: 1,
      halfW: CARD_W / 2 + BORDER,
      halfH: CARD_H / 2 + BORDER,
    }),
    []
  );

  useEffect(
    () => () => {
      imageMat.dispose();
      borderMat.dispose();
    },
    [imageMat, borderMat]
  );

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
        tex.anisotropy = 2;

        if (tex.image && tex.image.width && tex.image.height) {
          const imgAspect = tex.image.width / tex.image.height;
          if (imgAspect > CARD_ASPECT) {
            tex.repeat.x = CARD_ASPECT / imgAspect;
            tex.repeat.y = 1;
            tex.offset.x = (1 - tex.repeat.x) / 2;
            tex.offset.y = 0;
          } else {
            tex.repeat.x = 1;
            tex.repeat.y = imgAspect / CARD_ASPECT;
            tex.offset.x = 0;
            tex.offset.y = (1 - tex.repeat.y) / 2;
          }
        }
        setTexture(tex);
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.warn('[Card] failed to load', image.src, err);
      }
    );
    return () => {
      alive = false;
    };
  }, [image.src]);

  // Mount/unmount the video element when the card enters/leaves the row.
  useEffect(() => {
    if (!isInRowWithVideo) {
      setVideoTexture((prev) => {
        if (prev) {
          const v = prev.image;
          if (v && typeof v.pause === 'function') v.pause();
          prev.dispose();
        }
        return null;
      });
      return;
    }

    const video = document.createElement('video');
    video.src = image.videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    // Prevent the element from being added to the DOM tree but keep it
    // alive so the browser keeps decoding.
    video.style.display = 'none';

    const vt = new VideoTexture(video);
    vt.colorSpace = SRGBColorSpace;
    vt.minFilter = LinearFilter;
    vt.generateMipmaps = false;

    // cover-fit (same logic as still images) once metadata is ready.
    const applyCover = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      const aspect = w / h;
      if (aspect > CARD_ASPECT) {
        vt.repeat.x = CARD_ASPECT / aspect;
        vt.repeat.y = 1;
        vt.offset.x = (1 - vt.repeat.x) / 2;
        vt.offset.y = 0;
      } else {
        vt.repeat.x = 1;
        vt.repeat.y = aspect / CARD_ASPECT;
        vt.offset.x = 0;
        vt.offset.y = (1 - vt.repeat.y) / 2;
      }
      vt.needsUpdate = true;
    };
    video.addEventListener('loadedmetadata', applyCover);

    video.play().catch(() => {});
    setVideoTexture(vt);

    return () => {
      video.removeEventListener('loadedmetadata', applyCover);
      video.pause();
      video.src = '';
      video.load();
      vt.dispose();
    };
  }, [isInRowWithVideo, image.videoSrc]);

  useEffect(() => {
    const active = videoTexture || texture;
    if (active) {
      imageMat.map = active;
      imageMat.color = new Color(0xffffff);
      imageMat.needsUpdate = true;
    }
  }, [texture, videoTexture, imageMat]);

  useFrame((state, delta) => {
    const obj = animRef.current;
    if (!obj || !obj.parent) return;

    const lerp = 1 - Math.exp(-12 * delta);

    const transTarget = inCloud ? 0 : 1;
    transRef.current += (transTarget - transRef.current) * lerp;
    const t = transRef.current;

    let tx, ty, tz, tScale, tOp, isInRow = false;
    if (inCloud) {
      tx = cloudPosition[0];
      ty = cloudPosition[1];
      tz = cloudPosition[2];
      tScale = 1;
      tOp = 0.95;
    } else if (rowIdx === -1) {
      tx = 0; ty = 0; tz = -10;
      tScale = 0.001;
      tOp = 0;
    } else {
      isInRow = true;
      // Anchor-based layout: position is fixed by rowIdx, scrolled by carouselRef
      const layoutX = (rowIdx - anchorIdx) * step;
      tx = layoutX + (carouselRef ? carouselRef.current.scrollPos : 0);
      ty = 0;

      const distNorm = Math.min(1, Math.abs(tx) / step);
      const prox = 1 - distNorm;
      const prox2 = prox * prox;

      tScale = relatedScale + (selectedScale - relatedScale) * prox2;
      tz = 0.6 * prox2;
      tOp = 0.6 + 0.4 * prox2;
    }

    if (hovered && !inCloud && isInRow) {
      tOp = 1;
      tScale = tScale * 1.04;
    }

    obj.position.x += (tx - obj.position.x) * lerp;
    obj.position.y += (ty - obj.position.y) * lerp;
    obj.position.z += (tz - obj.position.z) * lerp;
    obj.scale.x += (tScale - obj.scale.x) * lerp;
    obj.scale.y += (tScale - obj.scale.y) * lerp;
    obj.scale.z += (tScale - obj.scale.z) * lerp;

    imageMat.opacity += (tOp - imageMat.opacity) * lerp;
    if (hasBorder) {
      borderMat.opacity += (tOp - borderMat.opacity) * lerp;
    }

    // Corner radius — applied to every card all the time (cloud + grid).
    const targetRadius = CORNER_RADIUS;
    const cur = imageMat.userData.uniforms.uRadius.value;
    const nextR = cur + (targetRadius - cur) * lerp;
    imageMat.userData.uniforms.uRadius.value = nextR;
    if (hasBorder) {
      borderMat.userData.uniforms.uRadius.value = nextR + BORDER;
    }

    // Rotation
    obj.getWorldPosition(_worldPos);
    obj.parent.getWorldQuaternion(_parentQuat);

    _outwardDir.set(Math.sin(intrinsicYaw), 0, Math.cos(intrinsicYaw));
    _outwardDir.applyQuaternion(_parentQuat);
    const cloudYaw = Math.atan2(_outwardDir.x, _outwardDir.z);
    const gridYaw = Math.atan2(
      state.camera.position.x - _worldPos.x,
      state.camera.position.z - _worldPos.z
    );
    const cosB = (1 - t) * Math.cos(cloudYaw) + t * Math.cos(gridYaw);
    const sinB = (1 - t) * Math.sin(cloudYaw) + t * Math.sin(gridYaw);
    const worldYaw = Math.atan2(sinB, cosB);
    _euler.set(0, worldYaw, 0);
    _worldQuat.setFromEuler(_euler);
    obj.quaternion.copy(_parentQuat).invert().multiply(_worldQuat);

    // Text label opacity by facing direction. Front-facing reaches the
    // design maxima (label 70 %, timestamp 50 %); back drops to ~10 % of
    // those, so the labels fade smoothly with the sphere rotation.
    if (inCloud && (labelRef.current || timeRef.current)) {
      const dx = state.camera.position.x - _worldPos.x;
      const dz = state.camera.position.z - _worldPos.z;
      const len = Math.hypot(dx, dz) || 1;
      const cos =
        (Math.sin(worldYaw) * dx + Math.cos(worldYaw) * dz) / len;
      const facing = Math.max(0, cos);
      const base = 0.1 + 0.9 * facing; // 0.1 (back) → 1.0 (front)
      if (labelRef.current && labelRef.current.material) {
        labelRef.current.material.transparent = true;
        labelRef.current.material.opacity = base * 0.7;
      }
      if (timeRef.current && timeRef.current.material) {
        timeRef.current.material.transparent = true;
        timeRef.current.material.opacity = base * 0.5;
      }
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    onClick && onClick();
  };

  return (
    <group ref={animRef}>
      {hasBorder && (
        <mesh position={[0, 0, -0.008]} material={borderMat}>
          <planeGeometry args={[CARD_W + BORDER * 2, CARD_H + BORDER * 2]} />
        </mesh>
      )}
      <mesh
        material={imageMat}
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
        onClick={handleClick}
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
      </mesh>
      {/* Title + timestamp under the card — only shown in cloud (sphere)
          mode. Same font sizes as the Node view. */}
      {inCloud && label && <CardLabels labelRef={labelRef} timeRef={timeRef} label={label} timestamp={timestamp} />}
    </group>
  );
}

export const CARD_SIZE = { w: CARD_W, h: CARD_H };

function CardLabels({ labelRef, timeRef, label, timestamp }) {
  const theme = useTheme();
  const c = colors(theme);
  return (
    <Suspense fallback={null}>
      <Text
        ref={labelRef}
        font={KOREAN_FONT}
        position={[0, -CARD_H / 2 - 0.07, 0.001]}
        fontSize={0.085}
        color={0xffffff}
        letterSpacing={-0.032}
        anchorX="center"
        anchorY="top"
        material-transparent
        material-opacity={0.7}
      >
        {label}
      </Text>
      {timestamp && (
        <Text
          ref={timeRef}
          font={KOREAN_FONT}
          position={[0, -CARD_H / 2 - 0.19, 0.001]}
          fontSize={0.06}
          color={0xffffff}
          letterSpacing={-0.02}
          anchorX="center"
          anchorY="top"
          material-transparent
          material-opacity={0.5}
        >
          {timestamp}
        </Text>
      )}
    </Suspense>
  );
}
