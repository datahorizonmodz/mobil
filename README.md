# COASTLINE // DRIVE

An original single-player 3D coastal driving sandbox. Built with TypeScript, Vite, Babylon.js and Havok. The simulation and world run entirely in the browser; no game server, account or API key is needed.

## Start

```bash
npm install
npm run dev
```

Open the URL printed by Vite. A browser with WebGL2 and WASM support is required. WebGPU is selected when the browser supports it; otherwise the game creates a WebGL engine.

## Build and preview

```bash
npm run build
npm run preview
```

`npm run build` runs strict TypeScript validation and emits a static site in `dist/`. The Havok WASM module, font files and all textures are bundled or served locally. No localhost URLs are baked into the build.

## Vercel

1. Push or upload this project root to a repository.
2. Import the repository into Vercel.
3. Choose **Vite** if framework detection does not select it automatically.
4. Set build command to `npm run build` and output directory to `dist`.
5. Deploy. No environment variables are required.

For manual static hosting, serve the complete `dist/` directory over HTTPS. The optional service worker is registered only in production.

## How to play

- Enter a driver name in the lobby, choose a vehicle and paint in the garage, then press **Drive**.
- Drag the garage canvas to orbit; use the mouse wheel to zoom.
- **W / Up** accelerate; **S / Down** brake, then reverse near a stop.
- **A / D** or arrow keys steer; **Space** handbrake.
- **C** cycles chase, far chase, hood and cockpit views.
- **R** resets and repairs the car. **Esc** pauses or resumes. **M** expands the map display. **F3** toggles performance data.
- On touchscreens, steering, pedals, handbrake, camera and pause controls appear.
- Gamepads use the left stick, triggers, A button and face button for camera.

The game autosaves the driver name, vehicle, paint, graphics, audio, UI and time preferences to a versioned localStorage record. If storage is unavailable, play continues with session defaults.

## What is implemented

- Ten fictional vehicles with distinct mass, gearing, torque, grip, suspension, brake and steering parameters.
- Dynamic Havok chassis with four raycast spring and damper wheel contacts, tire forces, shifting, drag, braking, reverse, body pitch and roll, and reset/repair.
- Deterministic 160 m streaming chunks, district-specific buildings, hills, tree and bush thin instances, sidewalks, street lighting, textured roads, crosswalks, coast, ocean and a drivable raised overpass.
- Original generated albedo, normal and packed roughness/metallic/AO maps for ten surfaces. Regenerate using `python3 scripts/generate_textures.py` (requires Pillow and NumPy).
- PBR vehicle materials, limited environment probes, dynamic sun, night lamps, headlights, fog, procedural sky and animated water shader.
- Graphics presets and working overrides for resolution scale, shadow resolution, draw distance, vegetation density, FPS cap, FXAA, bloom and reflection probe. Changes to these render features take effect on the next drive.
- Responsive lobby, garage, settings, pause, HUD, synthesized engine tone, gamepad/touch controls, manifest and offline asset cache.

## Architecture

- `src/config`: vehicle data and graphics presets.
- `src/game/core`: engine, scene lifecycle and game flow.
- `src/game/vehicle`: geometry and Havok vehicle dynamics.
- `src/game/world`: terrain, districts, buildings, bridge and chunk streaming.
- `src/game/rendering`: PBR surfaces, sky, lights, shadows and water.
- `src/game/input`, `camera`, `audio`: controls and presentation.
- `src/ui`: menus, settings, HUD and pause.
- `public/textures`: generated original texture maps. `scripts/generate_textures.py` is the source generator.

## Validation

```bash
npm run typecheck
npm run test:physics
npm run test:ui
npm run build
```

The physics smoke test initializes Havok with a NullEngine, streams the authored world, drives/brakes the hatchback for six simulated seconds, verifies wheel contact and motion, then checks chunk unloading/regeneration and the bridge. The UI smoke test exercises the lobby, garage, paint selector, graphics override and HUD. Browser performance varies by GPU; start with AUTO or LOW on mobile.

## Scope and current limits

The schematic HUD map shows orientation rather than a full navigation map. AI traffic, rain, tunnels, SSAO, granular vehicle body deformation and cloud saves are future systems. Browser compositors control VSync; the app offers an FPS target but cannot force VSync off. This is an original stylized driving sandbox, not a photorealistic asset pack.

Dependencies retain their own licenses. The generated textures, procedural meshes and fictional vehicle designs in this repository are original. The bundled Barlow Condensed and DM Sans fonts are distributed under OFL through Fontsource.
