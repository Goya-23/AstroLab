import { ALTITUDE_KM, buildMissionTimeline, demoMission, demoVisual } from './mission.js';
import { createViewer, frameEarthAndOrbit, loadMissionScene } from './visualization/cesiumAdapter.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = `
  <main class="mission-shell">
    <section class="side-panel">
      <p class="eyebrow">AstroLab Framework Demo</p>
      <h1>Cesium 卫星任务可视化</h1>
      <p class="summary">先以二体 RK4 传播器作为“自研轨道动力学内核”的最小闭环，打通任务定义、状态传播、Cesium 时间轴与轨迹渲染。</p>
      <p class="demo-tag" id="demoTag"></p>
      <dl class="telemetry">
        <div><dt>任务</dt><dd id="missionName">-</dd></div>
        <div><dt>标称高度</dt><dd id="nominalAlt">-</dd></div>
        <div><dt>历元</dt><dd id="epoch">-</dd></div>
        <div><dt>纬度</dt><dd id="lat">-</dd></div>
        <div><dt>经度</dt><dd id="lon">-</dd></div>
        <div><dt>高度</dt><dd id="alt">-</dd></div>
      </dl>
      <button type="button" class="frame-button" id="frameView">对准地球与轨迹</button>
      <div class="architecture">
        <h2>当前框架</h2>
        <ol>
          <li><strong>Mission Definition</strong>：任务元数据与初始状态。</li>
          <li><strong>Orbit Kernel</strong>：自研传播器输出 ECI/LLA 采样。</li>
          <li><strong>Cesium Adapter</strong>：采样转换为时间动态实体。</li>
        </ol>
      </div>
    </section>
    <section class="viewer-panel">
      <div id="cesiumContainer"></div>
    </section>
  </main>
`;

const samples = buildMissionTimeline(demoMission);
const viewer = createViewer(document.querySelector('#cesiumContainer'));
const scene = loadMissionScene(viewer, demoMission, samples);

const missionName = document.querySelector('#missionName');
const demoTag = document.querySelector('#demoTag');
const nominalAlt = document.querySelector('#nominalAlt');
const epoch = document.querySelector('#epoch');
const lat = document.querySelector('#lat');
const lon = document.querySelector('#lon');
const alt = document.querySelector('#alt');

missionName.textContent = demoMission.name;
demoTag.textContent = demoVisual.tag;
nominalAlt.textContent = `${ALTITUDE_KM} km（改 src/mission.js 后刷新验证）`;

const renderTelemetry = () => {
  const elapsedSeconds = Math.max(0, Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, viewer.clock.startTime));
  const sampleIndex = Math.min(samples.length - 1, Math.round(elapsedSeconds / demoMission.stepSeconds));
  const sample = samples[sampleIndex] ?? scene.currentSample;
  epoch.textContent = `T+${Math.round(sample.epochSeconds / 60)} min`;
  lat.textContent = `${sample.latitudeDeg.toFixed(2)}°`;
  lon.textContent = `${sample.longitudeDeg.toFixed(2)}°`;
  alt.textContent = `${sample.altitudeKm.toFixed(1)} km`;
};

viewer.clock.onTick.addEventListener(renderTelemetry);
renderTelemetry();

document.querySelector('#frameView').addEventListener('click', () => {
  viewer.trackedEntity = undefined;
  frameEarthAndOrbit(viewer, demoMission);
});
