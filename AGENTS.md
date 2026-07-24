# AstroLab

AstroLab is a single-product, frontend-only satellite mission visualization demo (CesiumJS 3D globe + a custom two-body/RK4 orbit kernel). There is no backend, database, or bundler.

## Cursor Cloud specific instructions

### Services / how to run
- Dev server: `npm run dev` serves the static app via `python3 -m http.server 5173` on http://localhost:5173. Open it in a browser to see the globe, orbital path, ground track, and live telemetry.
- Lint + tests: `npm run check` runs `node --check` on all `src` modules and the `node:test` unit tests in `tests/`. Node is only needed for this check, not for the live demo.

### Non-obvious caveats
- No installable dependencies: there is no lockfile or `node_modules`. CesiumJS is loaded from `cdn.jsdelivr.net` at runtime, so the browser environment needs outbound egress to that CDN.
- ES modules require HTTP, not `file://` — always view through the dev server, not by opening `index.html` directly.
- The Earth base imagery renders black by default. This is expected: the default Cesium `Viewer` pulls imagery from Cesium Ion, which returns `401` without a token (see the `401` for `api.cesium.com` in the browser console). This does NOT indicate a broken environment — the orbit propagation, satellite entity, glowing orbital path, ground track, and side-panel telemetry all still work. To enable full Earth imagery, set `globalThis.ASTROLAB_CESIUM_ION_TOKEN = '<token>'` before loading `src/main.js` in `index.html` (optional).
- The pink satellite marker is depth-tested against the globe, so it is hidden while on the far side of the orbit and reappears on the near side; the live telemetry in the side panel is the most reliable proof the animation loop is running.
