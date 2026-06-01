import test from 'node:test';
import assert from 'node:assert/strict';
import { demoMission, buildMissionTimeline } from '../src/mission.js';
import { eciToGeodetic } from '../src/orbit/kernel.js';

test('propagates the configured demo mission into fixed-step samples', () => {
  const samples = buildMissionTimeline(demoMission);

  assert.equal(samples.length, 181);
  assert.equal(samples[0].epochSeconds, 0);
  assert.equal(samples.at(-1).epochSeconds, 10_800);
  assert.ok(samples.every((sample) => Number.isFinite(sample.latitudeDeg)));
  assert.ok(samples.every((sample) => sample.longitudeDeg >= -180 && sample.longitudeDeg <= 180));
  assert.ok(samples.every((sample) => Math.abs(sample.altitudeKm - demoMission.altitudeKm) < 5));
});

test('converts an equatorial ECI point at epoch zero to geodetic coordinates', () => {
  const geodetic = eciToGeodetic({
    epochSeconds: 0,
    positionEciKm: { x: 6978.137, y: 0, z: 0 },
    velocityEciKmPerSec: { x: 0, y: 7.5, z: 0 },
  });

  assert.equal(geodetic.latitudeDeg, 0);
  assert.equal(geodetic.longitudeDeg, 0);
  assert.equal(Number(geodetic.altitudeKm.toFixed(3)), 600);
});
