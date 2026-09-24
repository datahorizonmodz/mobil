# COASTLINE // DRIVE — Progress

## Current checkpoint
v1.1 rendering and input repair. Source is prepared for a fresh Vercel build; GPU validation on the affected Android browser is still required after redeployment.

## Completed
- Vite/TypeScript/Babylon/Havok project and local PBR texture generation.
- Ten vehicle definitions; raycast suspension, gearbox, tire forces, braking, steering, damage and reset.
- Chunked deterministic coastal district world, road markings, buildings, vegetation, water, overpass, sun and night lighting.
- Lobby, garage, player name, paint, HUD, pause, settings, audio, save, mobile/gamepad input and PWA assets.
- TypeScript, headless Havok world/vehicle smoke test, UI smoke test and static asset response checks.
- WebGL2 by default; experimental WebGPU is opt-in and falls back to a recreated WebGL2 engine after a failed first frame.
- Boot-stage and frame-stage diagnostics, visible fatal overlay, mobile `?debug=1` panel, `?safe=1`, reliable sky/water fallbacks, first-frame validation before HUD.
- Camera spawn/raycast fix, pointer capture handling, texture failure fallback and versioned service-worker update behavior.
- Runtime integration test confirms active terrain, road, car, sky and buildings, wheel contact, touch GO and Havok movement in Babylon NullEngine.
- Fresh `npm ci`, typecheck, all three smoke tests, final production build and production preview path/MIME check passed. The emitted Havok WASM and all 30 WebP maps returned HTTP 200.

## Exact next step
Deploy the updated source, then verify actual GPU pixels and Android touch driving with `?debug=1`; compare normal mode with `?safe=1` if a device-specific failure remains.

## Known limits
AI traffic, advanced weather, a geographic map and cloud saves remain outside the current version. The available cloud browser reports no WebGL support, and local preview cannot be opened from it; NullEngine tests prove scene composition and physics but cannot prove Android GPU rendering. This workspace copy has no `.git` metadata, so no commit or push was performed.
