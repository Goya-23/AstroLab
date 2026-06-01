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

/** 固定相机：以地心为参考，同时看到地球球体与 LEO 轨道高度 */
export const frameEarthAndOrbit = (viewer, mission) => {
  const { BoundingSphere, Cartesian3, HeadingPitchRange, Math: CesiumMath } = getCesium();
  const orbitRadiusMeters = initialOrbitRadiusKm(mission) * 1000;
  const framingSphere = new BoundingSphere(Cartesian3.ZERO, orbitRadiusMeters * 1.25);

  viewer.trackedEntity = undefined;
  viewer.selectedEntity = undefined;

  return viewer.camera.flyToBoundingSphere(framingSphere, {
    duration: 1.2,
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(-32), orbitRadiusMeters * 2.4),
  });
};

export const createViewer = (container) => {
  const { Ion, Viewer } = getCesium();
  Ion.defaultAccessToken = globalThis.ASTROLAB_CESIUM_ION_TOKEN ?? '';

  const viewer = new Viewer(container, {
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

  viewer.trackedEntity = undefined;
  return viewer;
};

export const loadMissionScene = (viewer, mission, samples) => {
  const {
    Cartesian3,
    ClockRange,
    Color,
    JulianDate,
    LabelStyle,
    SampledPositionProperty,
    TimeInterval,
    TimeIntervalCollection,
  } = getCesium();
  const start = JulianDate.fromIso8601(mission.startIso);
  const stop = JulianDate.addSeconds(start, mission.propagatedHours * 3600, new JulianDate());
  const sampledPosition = new SampledPositionProperty();
  const orbitPositions = samples.map(toCartesian);

  samples.forEach((sample) => {
    const time = JulianDate.addSeconds(start, sample.epochSeconds, new JulianDate());
    sampledPosition.addSample(time, toCartesian(sample));
  });

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.clockRange = ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 60;
  viewer.clock.shouldAnimate = false;
  viewer.timeline.zoomTo(start, stop);

  const pathColor = Color.fromCssColorString(mission.visual?.pathColor ?? '#ff2bd6');
  const groundTrackColor = Color.fromCssColorString(mission.visual?.groundTrackColor ?? '#22c55e');

  const orbitTrack = viewer.entities.add({
    name: `${mission.name} 空间轨道`,
    polyline: {
      positions: orbitPositions,
      width: 4,
      material: pathColor.withAlpha(0.95),
    },
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
  });

  viewer.trackedEntity = undefined;
  viewer.selectedEntity = undefined;

  if (viewer.homeButton) {
    viewer.homeButton.viewModel.command.beforeExecute.addEventListener((event) => {
      event.cancel = true;
      frameEarthAndOrbit(viewer, mission);
    });
  }

  frameEarthAndOrbit(viewer, mission).then(() => {
    viewer.clock.shouldAnimate = true;
  });

  return {
    satellite,
    orbitTrack,
    groundTrack,
    currentSample: samples[0],
  };
};
