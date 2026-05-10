// Shared rounded-rect material used across Sphere / Group / Node scenes.
// Patches MeshBasicMaterial so fragments outside a rounded rectangle
// (defined in the geometry's local XY plane) are discarded.

import { MeshBasicMaterial, Vector2 } from 'three';

export const CORNER_RADIUS = 0.03; // ~8px on typical card sizes

export function patchRoundedShader(shader, uniforms) {
  shader.uniforms.uRadius = uniforms.uRadius;
  shader.uniforms.uHalfSize = uniforms.uHalfSize;

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
       varying vec2 vLocalPos;`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vLocalPos = position.xy;`
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
       varying vec2 vLocalPos;
       uniform float uRadius;
       uniform vec2 uHalfSize;
       float sdRoundBox(vec2 p, vec2 b, float r) {
         vec2 q = abs(p) - b + vec2(r);
         return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
       }`
    )
    .replace(
      'void main() {',
      `void main() {
         if (uRadius > 0.0005) {
           float d = sdRoundBox(vLocalPos, uHalfSize, uRadius);
           if (d > 0.0) discard;
         }`
    );
}

export function makeRoundedMaterial({
  color = 0xffffff,
  opacity = 1,
  halfW,
  halfH,
  transparent = true,
  side,
  radius = CORNER_RADIUS,
}) {
  const opts = {
    color,
    transparent,
    opacity,
    toneMapped: false,
  };
  if (side !== undefined) opts.side = side;
  const mat = new MeshBasicMaterial(opts);
  mat.userData.uniforms = {
    uRadius: { value: radius },
    uHalfSize: { value: new Vector2(halfW, halfH) },
  };
  mat.onBeforeCompile = (shader) => patchRoundedShader(shader, mat.userData.uniforms);
  return mat;
}
