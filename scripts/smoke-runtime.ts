import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin, NullEngine, PBRMaterial, Scene, Vector3 } from '@babylonjs/core';
import { GRAPHICS } from '../src/config/gameConfig';
import { VEHICLES } from '../src/config/vehicles';
import { runtimeGraphics, runtimeOptions, FrameStages } from '../src/game/core/runtime';
import { DriveCamera } from '../src/game/camera/cameras';
import { Controls } from '../src/game/input/controls';
import { Atmosphere } from '../src/game/rendering/atmosphere';
import type { MaterialLibrary } from '../src/game/rendering/materials';
import { Water } from '../src/game/rendering/water';
import { Vehicle } from '../src/game/vehicle/vehicle';
import { World } from '../src/game/world/world';

const browser=new Window({url:'http://localhost/'});
Object.defineProperty(globalThis,'window',{value:browser});
Object.defineProperty(globalThis,'document',{value:browser.document});
Object.defineProperty(globalThis,'navigator',{value:browser.navigator,configurable:true});

if(runtimeOptions('?safe=1&renderer=webgpu',true).renderer!=='webgl')throw Error('Safe renderer policy failed');
if(runtimeOptions('?renderer=webgpu',false).renderer!=='webgpu')throw Error('Forced renderer failed');
if(runtimeGraphics(GRAPHICS.ultra,true).reflections)throw Error('Safe graphics left reflections enabled');
let rendered=0;
const stages=new FrameStages(()=>{});
stages.run('water',false,()=>{throw Error('optional failure');});
stages.run('render',true,()=>{rendered++;});
if(rendered!==1||!stages.failed.has('water'))throw Error('Frame stage isolation failed');

const engine=new NullEngine({renderWidth:1280,renderHeight:720});const scene=new Scene(engine);
const havok=await HavokPhysics({wasmBinary:readFileSync('node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm')});
scene.enablePhysics(new Vector3(0,-9.81,0),new HavokPlugin(true,havok));
const material=new PBRMaterial('test-material',scene);
const surfaces=Object.fromEntries(['asphalt','concrete','grass','sand','brick','plaster','stone','metal','roof','dirt'].map(k=>[k,material]));
const mats={surfaces,glass:material,darkGlass:material,window:material,rubber:material,roadLine:material,curb:material,paint:()=>new PBRMaterial('test-paint',scene),solid:()=>material} as unknown as MaterialLibrary;
const atmosphere=new Atmosphere(scene,mats,GRAPHICS.low,false);
const world=new World(scene,mats,atmosphere,GRAPHICS.low);world.update(new Vector3(0,1,15),0);
const car=new Vehicle(scene,mats,VEHICLES[0],'#aabbcc');
const camera=new DriveCamera(scene,car);new Water(scene,8,false);
await scene.whenReadyAsync();
scene.render();
const active=scene.getActiveMeshes().data.slice(0,scene.getActiveMeshes().length);
for(const label of ['terrain-0-0','road-z','sculpted-lower-body','atmospheric-sky']){
  if(!active.some(mesh=>mesh.name===label))throw Error(`${label} is absent from active render meshes`);
}
if(!active.some(mesh=>mesh.name.includes('facade')||mesh.name.includes('building')))throw Error('Buildings outside the rendered scene');
if(scene.lights.length<2)throw Error('Spawn lighting missing');
if(car.root.getChildMeshes().length<16||world.loadedChunks!==9)throw Error('Missing vehicle or spawn chunks');

browser.document.body.innerHTML='<div id="hud"><button data-drive="throttle">GO</button><button data-drive="brake">BRAKE</button><button data-drive="left">LEFT</button></div>';
const controls=new Controls(browser.document.getElementById('hud')!);
const go=browser.document.querySelector('[data-drive="throttle"]')!;
const left=browser.document.querySelector('[data-drive="left"]')!;
const brake=browser.document.querySelector('[data-drive="brake"]')!;
go.dispatchEvent(new browser.PointerEvent('pointerdown',{bubbles:true,pointerId:1}));
if(controls.read().throttle!==1)throw Error('Pointer GO did not reach controls');
left.dispatchEvent(new browser.PointerEvent('pointerdown',{bubbles:true,pointerId:2}));
if(controls.read().steer!==-1)throw Error('Pointer steering did not reach controls');
left.dispatchEvent(new browser.PointerEvent('pointercancel',{bubbles:true,pointerId:2}));
if(controls.read().steer!==0)throw Error('Pointercancel left steering stuck');
let peak=0;
for(let i=0;i<210;i++){
  car.setInput(controls.read());car.physicsStep(1/60);scene.getPhysicsEngine()!._step(1/60);
  camera.update(1/60);peak=Math.max(peak,car.telemetry.speed);
}
if(peak<20||car.root.position.z<20||car.telemetry.traction<.5)throw Error(`GO did not move vehicle: peak ${peak}, contact ${car.telemetry.traction}`);
go.dispatchEvent(new browser.PointerEvent('pointerup',{bubbles:true,pointerId:1}));
if(controls.read().throttle!==0)throw Error('GO stayed held after pointerup');
brake.dispatchEvent(new browser.PointerEvent('pointerdown',{bubbles:true,pointerId:3}));
if(controls.read().brake!==1)throw Error('Pointer brake did not reach controls');
for(let i=0;i<120;i++){car.setInput(controls.read());car.physicsStep(1/60);scene.getPhysicsEngine()!._step(1/60);}
if(car.telemetry.speed>12)throw Error('Braking did not slow vehicle');
brake.dispatchEvent(new browser.PointerEvent('pointerup',{bubbles:true,pointerId:3}));
camera.next();if(camera.mode!=='FAR')throw Error('Camera mode switching failed');
console.log(JSON.stringify({activeMeshes:active.length,vehicleVisuals:car.root.getChildMeshes().length,chunks:world.loadedChunks,peakSpeed:Math.round(peak),wheelContact:car.telemetry.traction,position:car.root.position.asArray()}));
controls.dispose();scene.dispose();engine.dispose();await browser.happyDOM.abort();
