/**
 * Cesium is loaded from the CDN in index.html so this adapter can stay small
 * and the demo can run without a bundler while the project structure is still
 * ready for a future Vite/React/Vue migration.
 */
const getCesium = () => {
  if (!globalThis.Cesium) {
    throw new Error('Cesium global is missing. Check the CDN script in index.html.');
  }
  return globalThis.Cesium;
};

const toCartesian = (sample) => {
  const { Cartesian3 } = getCesium();
  return Cartesian3.fromDegrees(sample.longitudeDeg, sample.latitudeDeg, sample.altitudeKm * 1000);
};

export const createViewer = (container) => {
  const { Ion, Viewer } = getCesium();
  Ion.defaultAccessToken = globalThis.ASTROLAB_CESIUM_ION_TOKEN ?? '';

  return new Viewer(container, {
    animation: true,
    baseLayerPicker: true,
    geocoder: false,
    homeButton: true,
    infoBox: true,
    sceneModePicker: true,
    selectionIndicator: false,
    shouldAnimate: true,
    timeline: true,
  });
};

export const loadMissionScene = (viewer, mission, samples) => {
  const {
    Cartesian3,
    ClockRange,
    Color,
    JulianDate,
    LabelStyle,
    PathGraphics,
    PolylineGlowMaterialProperty,
    SampledPositionProperty,
    TimeInterval,
    TimeIntervalCollection,
  } = getCesium();
  const start = JulianDate.fromIso8601(mission.startIso);
  const stop = JulianDate.addSeconds(start, mission.propagatedHours * 3600, new JulianDate());
  const sampledPosition = new SampledPositionProperty();

  samples.forEach((sample) => {
    const time = JulianDate.addSeconds(start, sample.epochSeconds, new JulianDate());
    sampledPosition.addSample(time, toCartesian(sample));
  });

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 120;
  viewer.timeline.zoomTo(start, stop);

  const satellite = viewer.entities.add({
    availability: new TimeIntervalCollection([new TimeInterval({ start, stop })]),
    name: mission.name,
    description: mission.description,
    position: sampledPosition,
    point: {
      pixelSize: 12,
      color: Color.CYAN,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: mission.name,
      font: '14px sans-serif',
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      style: LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cartesian3(0, -28, 0),
    },
    path: new PathGraphics({
      resolution: mission.stepSeconds,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Color.CYAN,
      }),
      width: 3,
      leadTime: mission.stepSeconds * 10,
      trailTime: mission.stepSeconds * 30,
    }),
  });

  const groundTrack = viewer.entities.add({
    name: `${mission.name} 地面轨迹`,
    polyline: {
      positions: samples.map((sample) => Cartesian3.fromDegrees(sample.longitudeDeg, sample.latitudeDeg, 0)),
      width: 2,
      material: Color.ORANGE.withAlpha(0.75),
      clampToGround: true,
    },
  });

  viewer.trackedEntity = satellite;

  return {
    satellite,
    groundTrack,
    currentSample: samples[0],
  };
};
