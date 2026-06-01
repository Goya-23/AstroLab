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

const initialOrbitRadiusKm = (mission) => {
  const { x, y, z } = mission.initialState.positionEciKm;
  return Math.hypot(x, y, z);
};

export const createViewer = (container) => {
  const { Ion, Viewer } = getCesium();
  Ion.defaultAccessToken = globalThis.ASTROLAB_CESIUM_ION_TOKEN ?? '';

  return new Viewer(container, {
    animation: true,
    baseLayerPicker: true,
    geocoder: false,
    homeButton: true,
    infoBox: false,
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
    HeadingPitchRange,
    JulianDate,
    LabelStyle,
    Math: CesiumMath,
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
  viewer.clock.multiplier = 60;
  viewer.timeline.zoomTo(start, stop);

  const pathColor = Color.fromCssColorString(mission.visual?.pathColor ?? '#ff2bd6');
  const groundTrackColor = Color.fromCssColorString(mission.visual?.groundTrackColor ?? '#22c55e');

  const satellite = viewer.entities.add({
    availability: new TimeIntervalCollection([new TimeInterval({ start, stop })]),
    name: mission.name,
    description: mission.description,
    position: sampledPosition,
    point: {
      pixelSize: 14,
      color: pathColor,
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
        glowPower: 0.15,
        color: pathColor,
      }),
      width: 4,
      leadTime: 0,
      trailTime: mission.propagatedHours * 3600,
    }),
  });

  const groundTrack = viewer.entities.add({
    name: `${mission.name} 地面轨迹`,
    polyline: {
      positions: samples.map((sample) => Cartesian3.fromDegrees(sample.longitudeDeg, sample.latitudeDeg, 0)),
      width: 3,
      material: groundTrackColor.withAlpha(0.9),
      clampToGround: true,
    },
  });

  viewer.trackedEntity = undefined;
  const viewDistanceMeters = initialOrbitRadiusKm(mission) * 1_000 * 4;
  viewer.flyTo([satellite, groundTrack], {
    duration: 1.5,
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), viewDistanceMeters),
  });

  return {
    satellite,
    groundTrack,
    currentSample: samples[0],
  };
};
