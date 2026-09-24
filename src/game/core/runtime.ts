import type { GraphicsSettings } from '../../config/gameConfig';

export type RendererChoice = 'webgl' | 'webgpu';
export type BootStage = 'BOOT'|'ENGINE_INIT'|'SCENE_INIT'|'PHYSICS_INIT'|'WORLD_INIT'|'VEHICLE_INIT'|'CAMERA_INIT'|'INPUT_INIT'|'FIRST_FRAME'|'RUNNING';
export interface RuntimeOptions { safe: boolean; renderer: RendererChoice; mobile: boolean; }

export function runtimeOptions(search: string, _coarsePointer: boolean): RuntimeOptions {
  const query = new URLSearchParams(search);
  const safe = query.get('safe') === '1';
  const forcedWebGPU = query.get('renderer') === 'webgpu' && !safe;
  // WebGPU is opt-in until the complete scene has been verified on each backend.
  return { safe, mobile: _coarsePointer, renderer: forcedWebGPU ? 'webgpu' : 'webgl' };
}

export function runtimeGraphics(settings: GraphicsSettings, safe: boolean): GraphicsSettings {
  return safe ? {
    ...settings, preset: 'low', resolution: .7, shadows: 0, renderDistance: 1,
    vegetation: .35, bloom: false, antialias: false, reflections: false, fpsTarget: 30,
  } : settings;
}

export class FrameStages {
  readonly failed = new Set<string>();
  constructor(private report: (stage: string, error: unknown, critical: boolean) => void) {}
  run(stage: string, critical: boolean, action: () => void): boolean {
    if (this.failed.has(stage)) return false;
    try { action(); return true; }
    catch (error) {
      this.failed.add(stage);
      try { this.report(stage, error, critical); }
      catch (reportError) { console.error('[Coastline] Diagnostic reporting failed:', stage, error, reportError); }
      return false;
    }
  }
  reset() { this.failed.clear(); }
}
