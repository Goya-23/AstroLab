/**
 * @typedef {{ x: number, y: number, z: number }} Vector3
 */

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const add = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

/** @param {Vector3} v @param {number} factor @returns {Vector3} */
export const scale = (v, factor) => ({
  x: v.x * factor,
  y: v.y * factor,
  z: v.z * factor,
});

/** @param {Vector3} v @returns {number} */
export const magnitude = (v) => Math.hypot(v.x, v.y, v.z);
