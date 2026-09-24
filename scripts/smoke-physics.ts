import {readFileSync} from 'node:fs';
import HavokPhysics from '@babylonjs/havok';
import {FreeCamera,HavokPlugin,NullEngine,PBRMaterial,Scene,Vector3} from '@babylonjs/core';
import {VEHICLES} from '../src/config/vehicles';
import {Vehicle} from '../src/game/vehicle/vehicle';
import type {MaterialLibrary} from '../src/game/rendering/materials';
import {World} from '../src/game/world/world';
import {GRAPHICS} from '../src/config/gameConfig';
const wasmBinary=readFileSync('node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm');
const havok=await HavokPhysics({wasmBinary});
const engine=new NullEngine();const scene=new Scene(engine);
scene.enablePhysics(new Vector3(0,-9.81,0),new HavokPlugin(true,havok));
scene.activeCamera=new FreeCamera('test-camera',new Vector3(0,5,-10),scene);

const material=new PBRMaterial('test-material',scene);
const surfaces=Object.fromEntries(['asphalt','concrete','grass','sand','brick','plaster','stone','metal','roof','dirt'].map(k=>[k,material]));
const mats={surfaces,glass:material,darkGlass:material,window:material,rubber:material,roadLine:material,curb:material,paint:()=>new PBRMaterial('test-paint',scene),solid:()=>material} as unknown as MaterialLibrary;
const world=new World(scene,mats,{shadows:null} as never,GRAPHICS.low);
world.update(new Vector3(0,1,15),0);
if(world.loadedChunks!==9)throw new Error('World chunk streaming failed');
const car=new Vehicle(scene,mats,VEHICLES[0],'#aabbcc',new Vector3(0,1.15,0));
const steps=360;let peakSpeed=0;
for(let i=0;i<steps;i++){
  car.setInput({throttle:i<250?1:0,brake:i>=250?1:0,steer:i>85&&i<145?.35:0,handbrake:false});
  car.physicsStep(1/60);scene.getPhysicsEngine()!._step(1/60);peakSpeed=Math.max(peakSpeed,car.telemetry.speed);
}
const result={peakSpeed:+peakSpeed.toFixed(1),position:car.root.position.asArray().map(x=>+x.toFixed(2)),speed:+car.telemetry.speed.toFixed(1),rpm:car.telemetry.rpm,gear:car.telemetry.gear,traction:car.telemetry.traction,health:car.telemetry.health};
console.log(JSON.stringify({...result,loadedChunks:world.loadedChunks,meshes:scene.meshes.length}));
if(!Number.isFinite(car.root.position.x)||peakSpeed<25||car.root.position.z<8||car.root.position.y<.2||car.root.position.y>2||car.telemetry.traction<.5)throw new Error('Vehicle smoke test failed');
car.dispose();world.update(new Vector3(0,1,-480),0);if(!scene.meshes.some(m=>m.name==='coastal-overpass-deck'))throw new Error('Coastal bridge failed to stream');world.update(new Vector3(320,1,15),0);if(world.loadedChunks!==9)throw new Error('Chunk streaming failed after movement');world.update(new Vector3(0,1,15),0);if(world.loadedChunks!==9)throw new Error('Chunk regeneration failed');world.dispose();scene.dispose();engine.dispose();
