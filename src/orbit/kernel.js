import { add, magnitude, scale } from './vector.js';

export const EARTH_MU_KM3_PER_SEC2 = 398600.4418;
export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_ROTATION_RAD_PER_SEC = 7.2921159e-5;

/**
 * @typedef {import('./vector.js').Vector3} Vector3
 * @typedef {{ epochSeconds: number, positionEciKm: Vector3, velocityEciKmPerSec: Vector3 }} OrbitState
 * @typedef {{ durationSeconds: number, stepSeconds: number }} PropagationOptions
 * @typedef {OrbitState & { latitudeDeg: number, longitudeDeg: number, altitudeKm: number }} OrbitSample
 */

/** @param {Vector3} position @returns {Vector3} */
const acceleration = (position) => {
  const radius = magnitude(position);
  const factor = -EARTH_MU_KM3_PER_SEC2 / radius ** 3;
  return scale(position, factor);
};

/** @param {OrbitState} state */
const derivative = (state) => ({
  dPosition: state.velocityEciKmPerSec,
  dVelocity: acceleration(state.positionEciKm),
});

/** @param {OrbitState} state @param {{ dPosition: Vector3, dVelocity: Vector3 }} delta @param {number} dt @returns {OrbitState} */
const offsetState = (state, delta, dt) => ({
  epochSeconds: state.epochSeconds + dt,
  positionEciKm: add(state.positionEciKm, scale(delta.dPosition, dt)),
  velocityEciKmPerSec: add(state.velocityEciKmPerSec, scale(delta.dVelocity, dt)),
});

/** @param {OrbitState} state @param {number} dt @returns {OrbitState} */
const rk4Step = (state, dt) => {
  const k1 = derivative(state);
  const k2 = derivative(offsetState(state, k1, dt / 2));
  const k3 = derivative(offsetState(state, k2, dt / 2));
  const k4 = derivative(offsetState(state, k3, dt));

  const weightedPosition = scale(
    add(add(k1.dPosition, scale(k2.dPosition, 2)), add(scale(k3.dPosition, 2), k4.dPosition)),
    dt / 6,
  );
  const weightedVelocity = scale(
    add(add(k1.dVelocity, scale(k2.dVelocity, 2)), add(scale(k3.dVelocity, 2), k4.dVelocity)),
    dt / 6,
  );

  return {
    epochSeconds: state.epochSeconds + dt,
    positionEciKm: add(state.positionEciKm, weightedPosition),
    velocityEciKmPerSec: add(state.velocityEciKmPerSec, weightedVelocity),
  };
};

/** @param {number} longitudeDeg @returns {number} */
const normalizeLongitude = (longitudeDeg) => {
  const normalized = ((longitudeDeg + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

/** @param {OrbitState} state @returns {Pick<OrbitSample, 'latitudeDeg' | 'longitudeDeg' | 'altitudeKm'>} */
export const eciToGeodetic = (state) => {
  const theta = EARTH_ROTATION_RAD_PER_SEC * state.epochSeconds;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const ecef = {
    x: cosTheta * state.positionEciKm.x + sinTheta * state.positionEciKm.y,
    y: -sinTheta * state.positionEciKm.x + cosTheta * state.positionEciKm.y,
    z: state.positionEciKm.z,
  };
  const radius = magnitude(ecef);

  return {
    latitudeDeg: Math.asin(ecef.z / radius) * 180 / Math.PI,
    longitudeDeg: normalizeLongitude(Math.atan2(ecef.y, ecef.x) * 180 / Math.PI),
    altitudeKm: radius - EARTH_RADIUS_KM,
  };
};

/** @param {OrbitState} initialState @param {PropagationOptions} options @returns {OrbitSample[]} */
export const propagateOrbit = (initialState, options) => {
  const samples = [];
  let state = initialState;

  for (let elapsed = 0; elapsed <= options.durationSeconds; elapsed += options.stepSeconds) {
    samples.push({
      ...state,
      ...eciToGeodetic(state),
    });
    state = rk4Step(state, options.stepSeconds);
  }

  return samples;
};
