import { ArcRotateCamera, Color3, Engine, FxaaPostProcess, GlowLayer, HavokPlugin, HemisphericLight, MeshBuilder, PointLight, ReflectionProbe, Scene, TransformNode, Vector3, WebGPUEngine } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { activeGraphics, loadSave, storeSave, type SaveData } from '../../app/save';
import { PAINTS } from '../../config/gameConfig';
import { getVehicle } from '../../config/vehicles';
import { UI, type Panel } from '../../ui/ui';
import { GameAudio } from '../audio/audio';
import { DriveCamera } from '../camera/cameras';
import { Controls } from '../input/controls';
import { Atmosphere } from '../rendering/atmosphere';
import { MaterialLibrary } from '../rendering/materials';
import { Water } from '../rendering/water';
import { Vehicle } from '../vehicle/vehicle';
import { districtAt } from '../world/terrain';
import { World } from '../world/world';
export class GameApp {
  private canvas=document.querySelector<HTMLCanvasElement>('#game')!;
  private engine!:Engine|WebGPUEngine;private scene:Scene|null=null;
  private save:SaveData=loadSave();private ui:UI;
  private materials:MaterialLibrary|null=null;private preview:import('@babylonjs/core').TransformNode|null=null;
  private previewPaint:import('@babylonjs/core').PBRMaterial|null=null;
  private world:World|null=null;private atmosphere:Atmosphere|null=null;private water:Water|null=null;
  private vehicle:Vehicle|null=null;private camera:DriveCamera|null=null;private controls:Controls|null=null;
  private audio=new GameAudio();private glow:GlowLayer|null=null;private reflection:ReflectionProbe|null=null;
  private playing=false;private paused=false;private transition=false;private lastHud=0;private lastTick=0;
  constructor(){this.ui=new UI(this.save,{
    drive:()=>void this.drive(),open:p=>this.open(p),selectVehicle:id=>this.selectVehicle(id),
    selectPaint:i=>this.selectPaint(i),saveSettings:c=>this.updateSave(c),graphicsSetting:(key,value)=>this.updateSave({graphicsOverrides:{...this.save.graphicsOverrides,[key]:value}},false),resume:()=>this.resume(),
    reset:()=>this.vehicle?.reset(),mainMenu:()=>this.open('lobby'),toggleCamera:()=>this.camera?.next(),pause:()=>this.pause(),
  });}
  async init(){
    this.ui.showLoading('INITIALIZING RENDERER',8);
    try{
      if('gpu' in navigator && await WebGPUEngine.IsSupportedAsync){
        try{const gpu=new WebGPUEngine(this.canvas,{antialias:true});await gpu.initAsync();this.engine=gpu;}
        catch{this.engine=new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:true});}
      }else this.engine=new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:true});
      this.engine.setHardwareScalingLevel(1);
      this.createGarage();this.ui.showPanel('lobby');
      this.engine.runRenderLoop(()=>this.tick());
      window.addEventListener('resize',()=>this.engine.resize());
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing&&!this.paused)this.pause();});
      window.addEventListener('keydown',e=>{if(e.code==='Escape'&&this.paused&&!e.repeat){e.stopImmediatePropagation();this.resume();}});
    }catch(e){this.ui.showError(e instanceof Error?e.message:String(e));}
  }
  private createGarage(){
    this.disposeScene();
    const scene=new Scene(this.engine);this.scene=scene;
    scene.clearColor=Color3.FromHexString('#172833').toColor4();
    const mats=new MaterialLibrary(scene);this.materials=mats;
    const camera=new ArcRotateCamera('garage-orbit',-Math.PI*.72,Math.PI*.37,9.2,new Vector3(0,.8,0),scene);
    camera.lowerRadiusLimit=5.6;camera.upperRadiusLimit=14;camera.lowerBetaLimit=.45;camera.upperBetaLimit=1.6;
    camera.wheelPrecision=55;camera.panningSensibility=0;camera.attachControl(this.canvas,true);scene.activeCamera=camera;
    const hemi=new HemisphericLight('garage-ambient',new Vector3(0,1,0),scene);hemi.intensity=1.15;
    for(const [x,y,z,intensity,color] of [[-5,7,-1,48,'#adcde0'],[5,5,4,38,'#f5bd86'],[0,7,-5,32,'#e9f4f1']] as const){
      const light=new PointLight('garage-softbox',new Vector3(x,y,z),scene);light.intensity=intensity;light.range=18;light.diffuse=Color3.FromHexString(color);
    }
    const floor=MeshBuilder.CreateGround('showroom-floor',{width:80,height:80},scene);floor.material=mats.surfaces.concrete;
    const platform=MeshBuilder.CreateCylinder('display-platform',{diameter:6.7,height:.22,tessellation:72},scene);platform.position.y=.12;platform.material=mats.surfaces.metal;
    const top=MeshBuilder.CreateCylinder('display-top',{diameter:6.2,height:.08,tessellation:72},scene);top.position.y=.25;top.material=mats.surfaces.asphalt;
    const rim=MeshBuilder.CreateTorus('display-ring',{diameter:6.5,thickness:.035,tessellation:72},scene);rim.position.y=.27;rim.material=mats.roadLine;
    for(let i=-3;i<=3;i++){
      const strip=MeshBuilder.CreateBox('showroom-ceiling-light',{width:.09,height:.05,depth:13},scene);
      strip.position.set(i*2.2,6.2,0);strip.material=mats.roadLine;
    }
    for(const side of [-1,1]){
      const wall=MeshBuilder.CreateBox('showroom-wall',{width:.32,height:7,depth:80},scene);wall.position.set(side*17,3.5,0);wall.material=mats.surfaces.stone;
    }
    const back=MeshBuilder.CreateBox('showroom-backdrop',{width:80,height:7,depth:.3},scene);back.position.set(0,3.5,-18);back.material=mats.surfaces.metal;
    this.makePreview();
    const probe=new ReflectionProbe('showroom-reflections',128,scene,true);
    probe.position.set(0,1.5,0);probe.renderList=scene.meshes.filter(m=>m!==this.preview);
    probe.refreshRate=0;scene.onAfterRenderObservable.addOnce(()=>{scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.46;});this.reflection=probe;
  }
  private makePreview(){if(!this.scene||!this.materials)return;
    this.preview?.dispose(false,false);this.previewPaint?.dispose();
    const v=getVehicle(this.save.vehicleId);const paint=this.materials.paint(PAINTS[this.save.paint].hex);
    const root=new TransformNode('garage-car',this.scene);root.position.y=1.3;
    Vehicle.createVisual(this.scene,this.materials,v,paint,root);this.preview=root;this.previewPaint=paint;
  }
  private async drive(){if(this.transition)return;this.transition=true;this.ui.showLoading('PREPARING YOUR VEHICLE',12);
    await new Promise(r=>setTimeout(r,30));
    try{
      this.disposeScene();
      const preset=activeGraphics(this.save);this.engine.setHardwareScalingLevel(1/preset.resolution);
      const scene=new Scene(this.engine);this.scene=scene;scene.clearColor=Color3.FromHexString('#a6bec9').toColor4();
      this.ui.showLoading('STARTING HAVOK PHYSICS',27);await new Promise(r=>setTimeout(r,25));
      const havok=await HavokPhysics();scene.enablePhysics(new Vector3(0,-9.81,0),new HavokPlugin(true,havok));scene.getPhysicsEngine()?.setTimeStep(1/60);
      this.ui.showLoading('GENERATING COASTAL DISTRICTS',55);await new Promise(r=>setTimeout(r,25));
      const mats=new MaterialLibrary(scene);this.materials=mats;
      const atmosphere=new Atmosphere(scene,mats,preset);this.atmosphere=atmosphere;atmosphere.time=this.save.timeOfDay;atmosphere.auto=this.save.autoTime;
      this.world=new World(scene,mats,atmosphere,preset);this.world.update(new Vector3(0,1,15),0);
      this.ui.showLoading('ASSEMBLING YOUR DRIVE',76);await new Promise(r=>setTimeout(r,25));
      const v=getVehicle(this.save.vehicleId);this.vehicle=new Vehicle(scene,mats,v,PAINTS[this.save.paint].hex);
      atmosphere.shadows?.addShadowCaster(this.vehicle.root,true);
      this.camera=new DriveCamera(scene,this.vehicle);
      if(preset.antialias)new FxaaPostProcess('fxaa',1,this.camera.camera);
      this.water=new Water(scene,preset.renderDistance===1?16:32);
      if(preset.reflections){
        const probe=new ReflectionProbe('coastal-reflections',128,scene,true);
        const center=new Vector3(0,2,15);probe.position.copyFrom(center);
        probe.renderList=scene.meshes.filter(m=>m!==this.vehicle?.root&&m!==this.water?.mesh&&Vector3.DistanceSquared(m.getAbsolutePosition(),center)<16000).slice(0,90);
        probe.refreshRate=0;scene.onAfterRenderObservable.addOnce(()=>{scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.32;});this.reflection=probe;
      }
      if(preset.bloom){this.glow=new GlowLayer('soft-night-glow',scene,{blurKernelSize:12});this.glow.intensity=.18;}
      this.audio.setLevels(this.save.volume,this.save.engineVolume);void this.audio.start();
      scene.onBeforePhysicsObservable.add(()=>{if(!this.paused&&this.vehicle&&this.controls)this.vehicle.physicsStep(1/60);});
      this.ui.showLoading('FINALIZING LIGHTING',94);await new Promise(r=>setTimeout(r,65));
      this.ui.showHUD();this.controls=new Controls(document.querySelector('#hud')!);
      this.playing=true;this.paused=false;
    }catch(e){console.error(e);this.ui.showError(e instanceof Error?e.message:String(e));this.playing=false;}
    finally{this.transition=false;}
  }
  private tick(){if(!this.scene||this.paused)return;
    const now=performance.now();
    if(this.playing&&activeGraphics(this.save).fpsTarget===30&&now-this.lastTick<31)return;
    const dt=this.lastTick?Math.min(.05,(now-this.lastTick)/1000):1/60;this.lastTick=now;
    if(this.playing&&this.vehicle&&this.camera&&this.atmosphere&&this.world){
      this.vehicle.setInput(this.controls?.read()??{steer:0,throttle:0,brake:0,handbrake:false});
      this.camera.update(dt);this.atmosphere.update(dt,this.vehicle.root.position);
      this.vehicle.updateLights(Math.max(0,1-this.atmosphere.ambient.intensity));
      this.world.update(this.vehicle.root.position,Math.max(0,1-this.atmosphere.ambient.intensity));
      this.water?.update(dt,this.camera.camera.position,this.atmosphere.ambient.intensity);
      this.audio.update(this.vehicle.telemetry.rpm,this.controls?.read().throttle??0,this.vehicle.telemetry.speed);
      if(this.controls?.consume('camera'))this.camera.next();if(this.controls?.consume('reset'))this.vehicle.reset();
      if(this.controls?.consume('pause'))this.pause();if(this.controls?.consume('map'))this.ui.toggleMap();if(this.controls?.consume('debug'))this.ui.toggleDebug();
      if(this.vehicle.root.position.y< -8||Math.abs(this.vehicle.root.position.x)>1550||this.vehicle.root.position.z>1550||this.vehicle.root.position.z< -700)this.vehicle.reset(new Vector3(0,1.4,20));
      if(performance.now()-this.lastHud>90){const p=this.vehicle.root.position;this.ui.updateHUD(this.vehicle.telemetry,this.atmosphere.time,this.vehicle.config.name,districtAt(p.x,p.z),`${Math.round(p.x/160)} / ${Math.round(p.z/160)}`,this.camera.mode);
        this.ui.updateDebug(`FPS ${this.engine.getFps().toFixed(0)}\nMESHES ${this.scene.meshes.length}\nVISIBLE ${this.scene.getActiveMeshes().length}\nTRIANGLES ${Math.round(Array.from(this.scene.getActiveMeshes().data.slice(0,this.scene.getActiveMeshes().length)).reduce((n,m)=>n+m.getTotalIndices()/3,0))}\nCHUNKS ${this.world.loadedChunks}\nPOSITION ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\nSPEED ${this.vehicle.telemetry.speed.toFixed(0)} km/h\nRPM ${this.vehicle.telemetry.rpm}\nGEAR ${this.vehicle.telemetry.gear}`);
        this.lastHud=performance.now();}
    }else if(this.preview){this.preview.rotation.y+=dt*.10;}
    this.scene.render();
  }
  private pause(){if(!this.playing||this.paused)return;this.paused=true;this.ui.showPause();}
  private resume(){this.ui.hidePause();this.lastTick=0;this.paused=false;}
  private open(panel:Panel){if(this.playing){this.controls?.dispose();this.controls=null;this.audio.dispose();this.ui.clearGameplay();this.playing=false;this.paused=false;this.createGarage();this.engine.setHardwareScalingLevel(1);}this.ui.showPanel(panel);}
  private selectVehicle(id:string){this.save.vehicleId=id;storeSave(this.save);this.makePreview();this.ui.setSave(this.save);}
  private selectPaint(i:number){this.save.paint=i;storeSave(this.save);this.makePreview();this.ui.setSave(this.save);}
  private updateSave(change:Partial<SaveData>,render=true){this.save={...this.save,...change};storeSave(this.save);
    this.audio.setLevels(this.save.volume,this.save.engineVolume);
    if(this.atmosphere&&change.timeOfDay!==undefined){this.atmosphere.time=this.save.timeOfDay;this.atmosphere.auto=this.save.autoTime;}
    if(this.atmosphere&&change.autoTime!==undefined)this.atmosphere.auto=this.save.autoTime;
    if(change.playerName===undefined)this.ui.setSave(this.save,render);
  }
  private disposeScene(){this.controls?.dispose();this.controls=null;this.audio.dispose();this.glow?.dispose();this.glow=null;
    this.reflection?.dispose();this.reflection=null;
    this.vehicle?.dispose();this.vehicle=null;this.camera?.dispose();this.camera=null;this.water?.dispose();this.water=null;
    this.world?.dispose();this.world=null;this.atmosphere?.dispose();this.atmosphere=null;
    this.preview?.dispose(false,false);this.preview=null;this.previewPaint?.dispose();this.previewPaint=null;
    this.materials?.dispose();this.materials=null;this.scene?.dispose();this.scene=null;
  }
}
