import { propagateOrbit } from './orbit/kernel.js';

export const demoMission = {
  name: 'AstroLab-LEO-01',
  description: '由本地二体动力学内核驱动的低轨遥感卫星框架演示。',
  startIso: '2026-06-01T00:00:00Z',
  propagatedHours: 3,
  stepSeconds: 60,
  initialState: {
    epochSeconds: 0,
    positionEciKm: { x: 6978.137, y: 0, z: 0 },
    velocityEciKmPerSec: { x: 0, y: 5.335865, z: 5.335865 },
  },
};

export const buildMissionTimeline = (mission) => propagateOrbit(
  mission.initialState,
  {
    durationSeconds: mission.propagatedHours * 3600,
    stepSeconds: mission.stepSeconds,
  },
);
