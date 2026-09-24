import { GRAPHICS, recommendedPreset, WORLD_SEED, type GraphicsPreset, type GraphicsSettings } from '../config/gameConfig';
import { getVehicle } from '../config/vehicles';
export interface SaveData { saveVersion:1; playerName:string; vehicleId:string; paint:number; graphics:GraphicsPreset; graphicsOverrides:Partial<GraphicsSettings>; volume:number; engineVolume:number; environmentVolume:number; uiScale:number; reducedMotion:boolean; timeOfDay:number; autoTime:boolean; seed:number; }
const KEY='coastline-drive-save-v1';
const defaults:SaveData={saveVersion:1,playerName:'DRIVER',vehicleId:'metro',paint:3,graphics:'auto',graphicsOverrides:{},volume:.65,engineVolume:.72,environmentVolume:.45,uiScale:1,reducedMotion:false,timeOfDay:16.5,autoTime:true,seed:WORLD_SEED};
export function loadSave():SaveData {
  try { const data=JSON.parse(localStorage.getItem(KEY)||'null') as Partial<SaveData>|null;
    if(data?.saveVersion!==1) return {...defaults};
    return {...defaults,...data,graphicsOverrides:data.graphicsOverrides||{},playerName:String(data.playerName||'DRIVER').slice(0,22),vehicleId:getVehicle(data.vehicleId||'metro').id,paint:Math.max(0,Math.min(7,Number(data.paint)||0)),graphics:(data.graphics && (data.graphics==='auto'||data.graphics in GRAPHICS))?data.graphics:'auto'};
  } catch { return {...defaults}; }
}
export function storeSave(data:SaveData) { try { localStorage.setItem(KEY,JSON.stringify(data)); } catch { /* private mode */ } }
export function activePreset(save:SaveData) { return save.graphics==='auto'?recommendedPreset():save.graphics; }
export function activeGraphics(save:SaveData):GraphicsSettings {
  const base=GRAPHICS[activePreset(save)],over=save.graphicsOverrides;
  return {...base,...over,resolution:[.7,.85,1].includes(Number(over.resolution))?Number(over.resolution):base.resolution,
    shadows:[0,1024,2048,3072].includes(Number(over.shadows))?Number(over.shadows):base.shadows,
    renderDistance:[1,2].includes(Number(over.renderDistance))?Number(over.renderDistance):base.renderDistance,
    vegetation:[.35,.65,1,1.25].includes(Number(over.vegetation))?Number(over.vegetation):base.vegetation,
    fpsTarget:[30,60].includes(Number(over.fpsTarget))?Number(over.fpsTarget):base.fpsTarget};
}
