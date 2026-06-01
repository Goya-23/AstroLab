# AstroLab

AstroLab 是一个用于探索“自研轨道动力学内核 + Cesium 三维地球可视化”的卫星任务框架 Demo。

## Demo 目标

当前版本先完成一个最小闭环：

1. **任务定义**：在 `src/mission.js` 中声明卫星名称、起始历元、初始 ECI 状态和传播时长。
2. **轨道动力学内核**：在 `src/orbit/kernel.js` 中用二体引力模型和 RK4 积分器传播轨道状态。
3. **Cesium 适配层**：在 `src/visualization/cesiumAdapter.js` 中把传播采样转换为 Cesium 的时间动态实体、空间轨迹和地面轨迹。
4. **任务看板**：在 `src/main.js` 中渲染 Cesium Viewer，并同步显示当前采样的经纬高遥测。

## 快速开始

```bash
npm run dev
```

然后打开 <http://localhost:5173>。Demo 使用 Cesium CDN，不需要安装依赖即可运行。

如需使用 Cesium ion 资产，可在 `index.html` 加载 `src/main.js` 之前设置：

```html
<script>globalThis.ASTROLAB_CESIUM_ION_TOKEN = 'your_token';</script>
```

没有 token 时，Demo 仍可作为框架代码起点；如果在线底图资产受限，可继续验证本地的轨道传播、时间轴实体和任务看板代码。

## 后续演进方向

- 将 `src/orbit/kernel.js` 替换为更完整的自研动力学内核，例如 J2、大气阻力、太阳/月球摄动和推力模型。
- 把 `MissionDefinition` 扩展为多星、多载荷、多地面站和任务事件序列。
- 在 Cesium 适配层中增加传感器视锥、覆盖分析、地面站可见性窗口和任务事件标注。
- 增加 Web Worker 或 WASM 边界，让高频传播与渲染线程解耦。

## 检查

```bash
npm run check
```
