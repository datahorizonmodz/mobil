import { ArcRotateCamera, Color3, Engine, FreeCamera, FxaaPostProcess, GlowLayer, HavokPlugin, HemisphericLight, MeshBuilder, PointLight, ReflectionProbe, Scene, StandardMaterial, TransformNode, Vector3, WebGPUEngine } from '@babylonjs/core';
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
import { FrameStages, runtimeGraphics, runtimeOptions, type BootStage } from './runtime';
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
  private options=runtimeOptions(location.search,matchMedia('(pointer:coarse)').matches);
  private backend='WebGL2';private recovering=false;
  private bootStage:BootStage='BOOT';private debugVisible=new URLSearchParams(location.search).get('debug')==='1';
  private stages=new FrameStages((stage,error,critical)=>this.reportStage(stage,error,critical));
  constructor(){this.ui=new UI(this.save,{
    drive:()=>void this.drive(),open:p=>this.open(p),selectVehicle:id=>this.selectVehicle(id),
    selectPaint:i=>this.selectPaint(i),saveSettings:c=>this.updateSave(c),graphicsSetting:(key,value)=>this.updateSave({graphicsOverrides:{...this.save.graphicsOverrides,[key]:value}},false),resume:()=>this.resume(),
    reset:()=>this.vehicle?.reset(),mainMenu:()=>this.open('lobby'),toggleCamera:()=>this.camera?.next(),pause:()=>this.pause(),
  });}
  async init(){
    this.boot('ENGINE_INIT','INITIALIZING RENDERER',8);
    try{
      if(this.options.renderer==='webgpu'&&'gpu' in navigator&&await WebGPUEngine.IsSupportedAsync){
        try{const gpu=new WebGPUEngine(this.canvas,{antialias:true});await gpu.initAsync();this.engine=gpu;this.backend='WebGPU';}
        catch(error){console.warn('[Coastline] WebGPU initialization failed, using WebGL2:',error);this.engine=this.createWebGL();}
      }else this.engine=this.createWebGL();
      this.engine.setHardwareScalingLevel(1);
      this.bootStage='SCENE_INIT';this.createGarage();this.ui.showPanel('lobby');
      this.engine.runRenderLoop(()=>this.tick());
      console.info('[Coastline] Renderer',this.backend,'safe',this.options.safe,'canvas',this.canvas.clientWidth,this.canvas.clientHeight);
      const resize=()=>{if(this.canvas.clientWidth&&this.canvas.clientHeight)this.engine.resize();};
      window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
      window.visualViewport?.addEventListener('resize',resize);resize();
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing&&!this.paused)this.pause();});
      window.addEventListener('keydown',e=>{if(e.code==='Escape'&&this.paused&&!e.repeat){e.stopImmediatePropagation();this.resume();}});
    }catch(e){console.error('[Coastline] Renderer initialization',this.bootStage,e);this.ui.showRuntimeError(this.bootStage,this.backend,e);}
  }
  private boot(stage:BootStage,label:string,progress:number){
    this.bootStage=stage;console.info(`[Coastline] ${stage}`,label);this.ui.showLoading(label,progress);
  }
  private createWebGL(){
    const engine=new Engine(this.canvas,true,{preserveDrawingBuffer:false,stencil:true,disableWebGL2Support:false});
    if(engine.webGLVersion<2){engine.dispose();throw new Error('WebGL2 is required. Enable hardware acceleration or use a current browser.');}
    this.backend='WebGL2';return engine;
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
    if(!this.options.safe&&activeGraphics(this.save).reflections&&this.backend==='WebGL2'){
      const probe=new ReflectionProbe('showroom-reflections',128,scene,true);
      probe.position.set(0,1.5,0);probe.renderList=scene.meshes.filter(m=>m!==this.preview);
      probe.refreshRate=0;scene.onAfterRenderObservable.addOnce(()=>{scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.46;});this.reflection=probe;
    }
  }
  private makePreview(){if(!this.scene||!this.materials)return;
    this.preview?.dispose(false,false);this.previewPaint?.dispose();
    const v=getVehicle(this.save.vehicleId);const paint=this.materials.paint(PAINTS[this.save.paint].hex);
    const root=new TransformNode('garage-car',this.scene);root.position.y=1.3;
    Vehicle.createVisual(this.scene,this.materials,v,paint,root);this.preview=root;this.previewPaint=paint;
  }
  private async drive(){if(this.transition)return;this.transition=true;this.boot('SCENE_INIT','PREPARING YOUR VEHICLE',12);
    await new Promise(r=>setTimeout(r,30));
    try{
      this.disposeScene();
      this.stages.reset();this.playing=false;this.lastTick=0;this.lastHud=0;
      const preset=runtimeGraphics(activeGraphics(this.save),this.options.safe);this.engine.setHardwareScalingLevel(1/preset.resolution);
      const scene=new Scene(this.engine);this.scene=scene;scene.clearColor=Color3.FromHexString('#a6bec9').toColor4();
      this.boot('PHYSICS_INIT','STARTING HAVOK PHYSICS',27);await new Promise(r=>setTimeout(r,25));
      const havok=await HavokPhysics();scene.enablePhysics(new Vector3(0,-9.81,0),new HavokPlugin(true,havok));scene.getPhysicsEngine()?.setTimeStep(1/60);
      if(!scene.getPhysicsEngine())throw new Error('Havok did not enable the scene physics engine.');
      this.boot('WORLD_INIT','GENERATING COASTAL DISTRICTS',55);await new Promise(r=>setTimeout(r,25));
      const mats=new MaterialLibrary(scene);this.materials=mats;
      const advanced=this.backend==='WebGL2'&&!this.options.safe&&!matchMedia('(pointer:coarse)').matches;
      const atmosphere=new Atmosphere(scene,mats,preset,advanced);this.atmosphere=atmosphere;atmosphere.time=this.save.timeOfDay;atmosphere.auto=this.save.autoTime;
      this.world=new World(scene,mats,atmosphere,preset);this.world.update(new Vector3(0,1,15),0);
      this.boot('VEHICLE_INIT','ASSEMBLING YOUR DRIVE',76);await new Promise(r=>setTimeout(r,25));
      const v=getVehicle(this.save.vehicleId);this.vehicle=new Vehicle(scene,mats,v,PAINTS[this.save.paint].hex);
      atmosphere.shadows?.addShadowCaster(this.vehicle.root,true);
      this.bootStage='CAMERA_INIT';this.camera=new DriveCamera(scene,this.vehicle);
      if(preset.antialias)new FxaaPostProcess('fxaa',1,this.camera.camera);
      this.water=new Water(scene,preset.renderDistance===1?16:32,advanced);
      if(preset.reflections&&this.backend==='WebGL2'&&!this.options.safe){
        const probe=new ReflectionProbe('coastal-reflections',128,scene,true);
        const center=new Vector3(0,2,15);probe.position.copyFrom(center);
        probe.renderList=scene.meshes.filter(m=>m!==this.vehicle?.root&&m!==this.water?.mesh&&Vector3.DistanceSquared(m.getAbsolutePosition(),center)<16000).slice(0,90);
        probe.refreshRate=0;scene.onAfterRenderObservable.addOnce(()=>{scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.32;});this.reflection=probe;
      }
      if(preset.bloom){this.glow=new GlowLayer('soft-night-glow',scene,{blurKernelSize:12});this.glow.intensity=.18;}
      this.boot('FIRST_FRAME','FINALIZING LIGHTING',94);await new Promise(r=>setTimeout(r,65));
      this.validateScene();
      const ready=await Promise.race([scene.whenReadyAsync().then(()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),15000))]);
      if(!ready)throw new Error('Essential scene materials did not become ready in 15 seconds. Check shader and texture errors in the console.');
      this.validateScene();scene.render();
      if(scene.getActiveMeshes().length<5)throw new Error('First frame contains too few visible meshes. Camera or materials failed.');
      console.info('[Coastline] First 3D frame ready',this.diagnostics());
      this.audio.setLevels(this.save.volume,this.save.engineVolume);void this.audio.start();
      scene.onBeforePhysicsObservable.add(()=>{if(!this.paused&&this.vehicle&&this.controls)this.stages.run('physics',true,()=>this.vehicle!.physicsStep(1/60));});
      this.bootStage='INPUT_INIT';this.ui.showHUD();this.controls=new Controls(document.querySelector('#hud')!);
      this.playing=true;this.paused=false;this.bootStage='RUNNING';
      this.ui.updateHUD(this.vehicle.telemetry,this.atmosphere.time,this.vehicle.config.name,districtAt(this.vehicle.root.position.x,this.vehicle.root.position.z),'00 / 00',this.camera.mode);
      if(this.debugVisible)this.ui.toggleDebug();
    }catch(e){console.error('[Coastline] Gameplay failed at',this.bootStage,e,this.diagnostics());this.playing=false;
      if(this.backend==='WebGPU'){
        console.warn('[Coastline] Recreating scene with WebGL2 after WebGPU validation failure');
        this.disposeScene();this.engine.dispose();
        try{this.engine=this.createWebGL();this.engine.runRenderLoop(()=>this.tick());this.transition=false;await this.drive();return;}
        catch(fallbackError){this.ui.showRuntimeError('WebGPU fallback',this.backend,fallbackError);}
      }else{
        try{this.createDiagnosticScene();}catch(fallbackError){console.error('[Coastline] Diagnostic scene also failed',fallbackError);}
        this.ui.showRuntimeError(this.bootStage,this.backend,e);
      }
    }
    finally{this.transition=false;}
  }
  private tick(){if(!this.scene||this.paused||this.transition)return;
    const now=performance.now();
    if(this.playing&&runtimeGraphics(activeGraphics(this.save),this.options.safe).fpsTarget===30&&now-this.lastTick<31)return;
    const dt=this.lastTick?Math.min(.05,(now-this.lastTick)/1000):1/60;this.lastTick=now;
    const scene=this.scene;
    if(this.playing&&this.vehicle&&this.camera&&this.atmosphere&&this.world){
      let input={steer:0,throttle:0,brake:0,handbrake:false};
      this.stages.run('input',true,()=>{input=this.controls?.read()??input;this.vehicle!.setInput(input);});
      this.stages.run('camera',true,()=>this.camera!.update(dt));
      this.stages.run('atmosphere',false,()=>this.atmosphere!.update(dt,this.vehicle!.root.position));
      this.stages.run('vehicle lights',false,()=>this.vehicle!.updateLights(Math.max(0,1-this.atmosphere!.ambient.intensity)));
      this.stages.run('world streaming',false,()=>this.world!.update(this.vehicle!.root.position,Math.max(0,1-this.atmosphere!.ambient.intensity)));
      this.stages.run('water',false,()=>this.water?.update(dt,this.camera!.camera.position,this.atmosphere!.ambient.intensity));
      this.stages.run('audio',false,()=>this.audio.update(this.vehicle!.telemetry.rpm,input.throttle,this.vehicle!.telemetry.speed));
      this.stages.run('controls',false,()=>{
        if(this.controls?.consume('camera'))this.camera!.next();if(this.controls?.consume('reset'))this.vehicle!.reset();
        if(this.controls?.consume('pause'))this.pause();if(this.controls?.consume('map'))this.ui.toggleMap();if(this.controls?.consume('debug'))this.ui.toggleDebug();
        const p=this.vehicle!.root.position;if(p.y< -8||Math.abs(p.x)>1550||p.z>1550||p.z< -700)this.vehicle!.reset(new Vector3(0,1.4,20));
      });
      if(performance.now()-this.lastHud>90){
        this.stages.run('HUD',false,()=>{const p=this.vehicle!.root.position;this.ui.updateHUD(this.vehicle!.telemetry,this.atmosphere!.time,this.vehicle!.config.name,districtAt(p.x,p.z),`${Math.round(p.x/160)} / ${Math.round(p.z/160)}`,this.camera!.mode);});
        this.stages.run('debug panel',false,()=>this.ui.updateDebug(this.diagnostics()));
        this.lastHud=performance.now();
      }
    }else if(this.preview)this.stages.run('garage rotation',false,()=>{this.preview!.rotation.y+=dt*.10;});
    // Rendering is never gated by a gameplay, water, audio or HUD update failure.
    this.stages.run('render',true,()=>scene.render());
  }
  private validateScene(){
    const scene=this.scene,car=this.vehicle;
    if(!scene?.activeCamera||!car||!this.world||!this.atmosphere)throw new Error('Missing gameplay camera, vehicle, world or light system.');
    if(!this.canvas.clientWidth||!this.canvas.clientHeight)throw new Error('3D canvas has zero dimensions.');
    if(this.world.loadedChunks<1||!scene.meshes.some(m=>m.name.startsWith('terrain-'))||!scene.meshes.some(m=>m.name==='road-z'))throw new Error('Spawn terrain or road was not generated.');
    if(!scene.meshes.some(m=>m.name==='sculpted-lower-body')||car.root.getChildMeshes().length<16)throw new Error('The selected vehicle has no visible body.');
    if(scene.lights.length<1)throw new Error('Gameplay has no active lights.');
    if(Vector3.Distance(scene.activeCamera.position,car.root.position)>30||scene.activeCamera.position.y<.3)throw new Error('Spawn camera is outside the vehicle view.');
    console.info('[Coastline] Scene validated',this.diagnostics());
  }
  private createDiagnosticScene(){
    this.disposeScene();
    const scene=new Scene(this.engine);this.scene=scene;scene.clearColor=Color3.FromHexString('#719bb6').toColor4();
    const camera=new FreeCamera('diagnostic-camera',new Vector3(7,6,-12),scene);
    camera.setTarget(new Vector3(0,1,5));scene.activeCamera=camera;
    const light=new HemisphericLight('diagnostic-light',Vector3.Up(),scene);light.intensity=1.3;
    const color=(name:string,hex:string)=>{const mat=new StandardMaterial(name,scene);mat.diffuseColor=Color3.FromHexString(hex);return mat;};
    const ground=MeshBuilder.CreateGround('diagnostic-ground',{width:80,height:80},scene);ground.material=color('ground-green','#78946b');
    const road=MeshBuilder.CreateGround('diagnostic-road',{width:10,height:80},scene);road.position.y=.02;road.material=color('road-gray','#414d55');
    const car=MeshBuilder.CreateBox('diagnostic-car',{width:1.8,height:.8,depth:3.8},scene);car.position.set(0,.7,5);car.material=color('car-orange','#df784a');
    const building=MeshBuilder.CreateBox('diagnostic-building',{width:6,height:9,depth:5},scene);building.position.set(12,4.5,15);building.material=color('building-white','#c6bca8');
    scene.render();console.info('[Coastline] Diagnostic fallback scene rendered',scene.getActiveMeshes().length);
  }
  private diagnostics(){
    try{
    const scene=this.scene,car=this.vehicle,position=car?.root.position;
    return `BOOT ${this.bootStage} DEVICE ${this.options.mobile?'MOBILE':'DESKTOP'}\nRENDERER ${this.backend}${this.options.safe?' SAFE':''}\nCANVAS ${this.canvas.width}×${this.canvas.height} CSS ${this.canvas.clientWidth}×${this.canvas.clientHeight} DPR ${devicePixelRatio} SCALE ${this.engine?.getHardwareScalingLevel()?.toFixed(2)??'?'}\nFPS ${this.engine?.getFps().toFixed(0)??'?'} MESHES ${scene?.meshes.length??0} ACTIVE ${scene?.getActiveMeshes().length??0} MATERIALS ${scene?.materials.length??0} LIGHTS ${scene?.lights.length??0}\nCAMERA ${scene?.activeCamera?.name??'none'} ${(scene?.activeCamera?.position.asArray()??[]).map(n=>n.toFixed(1)).join(', ')} NEAR ${scene?.activeCamera?.minZ??'?'} FAR ${scene?.activeCamera?.maxZ??'?'}\nWORLD CHUNKS ${this.world?.loadedChunks??0} TERRAIN ${scene?.meshes.filter(m=>m.name.startsWith('terrain-')).length??0} ROAD ${scene?.meshes.filter(m=>m.name==='road-z').length??0} BUILDINGS ${scene?.meshes.filter(m=>m.name.includes('building')).length??0}\nPHYSICS ${!!scene?.getPhysicsEngine()} BODY ${!!car?.aggregate.body} VEHICLE ${(position?.asArray()??[]).map(n=>n.toFixed(2)).join(', ')} VISUALS ${car?.root.getChildMeshes().length??0} WHEELS ${car?.wheels.length??0} CONTACT ${car?.telemetry.traction??0}\nSKY ${this.atmosphere?.shaderReady??'n/a'} WATER ${this.water?.shaderReady??'n/a'} TEXTURE FAILURES ${this.materials?.failedTextures.join(', ')||'none'}\nSPEED ${car?.telemetry.speed.toFixed(1)??0} RPM ${car?.telemetry.rpm??0} GEAR ${car?.telemetry.gear??'?'} FAILED ${[...this.stages.failed].join(', ')||'none'}`;
    }catch(error){return `BOOT ${this.bootStage} RENDERER ${this.backend} DIAGNOSTICS FAILED ${String(error)}`;}
  }
  private reportStage(stage:string,error:unknown,critical:boolean){
    console.error(`[Coastline] ${critical?'Fatal':'Optional'} stage ${stage} failed`,error,this.diagnostics());
    if(critical&&stage==='render'&&this.backend==='WebGPU'&&!this.recovering){void this.recoverWebGL();return;}
    if(critical)this.ui.showRuntimeError(stage,this.backend,error);
  }
  private async recoverWebGL(){
    this.recovering=true;this.transition=true;const wasPlaying=this.playing;
    try{
      this.disposeScene();this.engine.dispose();this.engine=this.createWebGL();this.stages.reset();
      this.engine.runRenderLoop(()=>this.tick());this.transition=false;
      if(wasPlaying)await this.drive();
      else{this.createGarage();this.ui.showPanel('lobby');}
      console.warn('[Coastline] WebGPU render failed; running on WebGL2');
    }catch(error){console.error('[Coastline] WebGL2 recovery failed',error);this.ui.showRuntimeError('WebGPU recovery',this.backend,error);}
    finally{this.transition=false;this.recovering=false;}
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
