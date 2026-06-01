import { EARTH_MU_KM3_PER_SEC2, EARTH_RADIUS_KM, propagateOrbit } from './orbit/kernel.js';

/** 改这个高度（km），保存刷新后应看到左侧「标称高度」与轨迹形状一起变化 */
export const ALTITUDE_KM = 600;

const orbitRadiusKm = EARTH_RADIUS_KM + ALTITUDE_KM;
const circularSpeedKmPerSec = Math.sqrt(EARTH_MU_KM3_PER_SEC2 / orbitRadiusKm);

/** 改 pathColor / groundTrackColor，保存刷新后轨迹颜色应立刻变化 */
export const demoVisual = {
  tag: '圆轨道 LEO · 洋红卫星轨迹 · 绿色地面轨迹',
  pathColor: '#ff2bd6',
  groundTrackColor: '#22c55e',
};

export const demoMission = {
  name: 'AstroLab-LEO-01',
  description: '由本地二体动力学内核驱动的低轨遥感卫星框架演示。',
  startIso: '2026-06-01T00:00:00Z',
  propagatedHours: 3,
  stepSeconds: 60,
  altitudeKm: ALTITUDE_KM,
  visual: demoVisual,
  initialState: {
    epochSeconds: 0,
    positionEciKm: { x: orbitRadiusKm, y: 0, z: 0 },
    velocityEciKmPerSec: { x: 0, y: circularSpeedKmPerSec, z: 0 },
  },
};

export const buildMissionTimeline = (mission) => propagateOrbit(
  mission.initialState,
  {
    durationSeconds: mission.propagatedHours * 3600,
    stepSeconds: mission.stepSeconds,
  },
);
