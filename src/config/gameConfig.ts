export const WORLD_SEED = 728391;
export const CHUNK_SIZE = 160;
export const WORLD_RADIUS = 1500;
export const FIXED_STEP = 1 / 60;
export const PAINTS = [
  {name:'Pearl White', hex:'#e9e6dd'}, {name:'Obsidian Black', hex:'#181d23'},
  {name:'Metallic Silver', hex:'#9da8ac'}, {name:'Racing Red', hex:'#b72430'},
  {name:'Deep Blue', hex:'#224d7b'}, {name:'Forest Green', hex:'#285e4c'},
  {name:'Graphite Gray', hex:'#4b555d'}, {name:'Sunset Orange', hex:'#df6834'},
];
export type GraphicsPreset = 'auto'|'low'|'medium'|'high'|'ultra';
export interface GraphicsSettings {
  preset: GraphicsPreset; resolution: number; shadows: number; renderDistance: number;
  vegetation: number; bloom: boolean; antialias: boolean; reflections: boolean; fpsTarget: number;
}
export const GRAPHICS: Record<Exclude<GraphicsPreset,'auto'>, GraphicsSettings> = {
  low: {preset:'low',resolution:.7,shadows:0,renderDistance:1,vegetation:.35,bloom:false,antialias:false,reflections:false,fpsTarget:30},
  medium: {preset:'medium',resolution:.85,shadows:1024,renderDistance:1,vegetation:.65,bloom:false,antialias:true,reflections:false,fpsTarget:60},
  high: {preset:'high',resolution:1,shadows:2048,renderDistance:2,vegetation:1,bloom:true,antialias:true,reflections:true,fpsTarget:60},
  ultra: {preset:'ultra',resolution:1,shadows:3072,renderDistance:2,vegetation:1.25,bloom:true,antialias:true,reflections:true,fpsTarget:60},
};
export function recommendedPreset(): Exclude<GraphicsPreset,'auto'> {
  const mobile = matchMedia('(pointer:coarse)').matches;
  return mobile ? 'low' : (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
}
