import { Color3, DirectionalLight, Effect, HemisphericLight, Mesh, MeshBuilder, Scene, ShaderMaterial, ShadowGenerator, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { GraphicsSettings } from '../../config/gameConfig';
import { MaterialLibrary } from './materials';

Effect.ShadersStore['coastSkyVertexShader']=`precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vDir; void main(){vDir=position; gl_Position=worldViewProjection*vec4(position,1.); gl_Position.z=gl_Position.w*.9999;}`;
Effect.ShadersStore['coastSkyFragmentShader']=`precision highp float; varying vec3 vDir; uniform vec3 sunDir; uniform float daylight; uniform float sunset; uniform float time;
float hash(vec3 p){return fract(sin(dot(floor(p),vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){vec3 d=normalize(vDir); float h=clamp(d.y*.5+.5,0.,1.); vec3 night=vec3(.012,.025,.065); vec3 zenith=mix(night,vec3(.16,.42,.67),daylight); vec3 horizon=mix(vec3(.055,.085,.14),vec3(.68,.77,.78),daylight); horizon=mix(horizon,vec3(.98,.43,.22),sunset*.8); vec3 color=mix(horizon,zenith,smoothstep(.08,.85,h)); float sun=pow(max(dot(d,normalize(sunDir)),0.),1700.); color+=vec3(1.,.83,.57)*sun*daylight*2.; float glow=pow(max(dot(d,normalize(sunDir)),0.),24.); color+=vec3(1.,.46,.19)*glow*sunset*.32; float stars=step(.9985,hash(d*200.))*pow(max(d.y,0.),.5)*(1.-daylight); color+=vec3(stars); gl_FragColor=vec4(color,1.);}`;

export class Atmosphere {
  readonly sun:DirectionalLight; readonly ambient:HemisphericLight; readonly shadows:ShadowGenerator|null;
  readonly sky:Mesh; private shader:ShaderMaterial|null=null; private fallback:StandardMaterial; time=16.5; auto=true;
  private lamps: Array<{light:import('@babylonjs/core').PointLight; position:Vector3}> = [];
  constructor(private scene:Scene, private mats:MaterialLibrary, graphics:GraphicsSettings, advanced=true) {
    this.sun=new DirectionalLight('sun',new Vector3(-.35,-.85,-.35),scene);
    this.sun.intensity=2.4;this.sun.shadowMaxZ=graphics.renderDistance===1?170:350;
    this.ambient=new HemisphericLight('skylight',new Vector3(0,1,0),scene);
    this.ambient.intensity=.9; this.ambient.groundColor=new Color3(.18,.2,.19);
    this.shadows=graphics.shadows>0 ? new ShadowGenerator(graphics.shadows,this.sun) : null;
    if(this.shadows) { this.shadows.usePercentageCloserFiltering=true; this.shadows.filteringQuality=ShadowGenerator.QUALITY_MEDIUM; this.shadows.bias=.0007; this.shadows.normalBias=.015; this.shadows.darkness=.32; }
    this.sky=MeshBuilder.CreateSphere('atmospheric-sky',{diameter:1800,segments:24,sideOrientation:Mesh.BACKSIDE},scene);
    this.fallback=new StandardMaterial('reliable-sky',scene);
    this.fallback.disableLighting=true;this.fallback.backFaceCulling=false;this.fallback.disableDepthWrite=true;this.fallback.fogEnabled=false;
    this.sky.material=this.fallback;this.sky.isPickable=false;this.sky.infiniteDistance=true;
    if(advanced){
      this.shader=new ShaderMaterial('sky-shader',scene,{vertex:'coastSky',fragment:'coastSky'},{attributes:['position'],uniforms:['worldViewProjection','sunDir','daylight','sunset','time']});
      this.shader.backFaceCulling=false;this.shader.disableDepthWrite=true;
      this.sky.material=this.shader;
      this.shader.forceCompilation(this.sky,undefined,undefined,reason=>{
        console.error('[Coastline] Atmosphere shader failed; switching to reliable sky:',reason);
        this.sky.material=this.fallback;this.shader?.dispose();this.shader=null;
      });
    }
    scene.fogMode=Scene.FOGMODE_EXP2; scene.fogDensity=graphics.renderDistance===1?.0027:.00125;
    this.update(0,new Vector3());
  }
  update(dt:number,player:Vector3) {
    if(this.auto) this.time=(this.time+dt*.055)%24;
    const angle=(this.time-6)/24*Math.PI*2;
    const elevation=Math.sin(angle);
    const day=Math.max(.045,Math.min(1,(elevation+.1)*2.25));
    const sunset=Math.max(0,1-Math.abs(elevation)*3)*day;
    const sunDir=new Vector3(Math.cos(angle)*.5,elevation,Math.sin(angle)*.8).normalize();
    this.sun.direction=sunDir.scale(-1); this.sun.intensity=.12+day*2.55;
    this.sun.diffuse=Color3.Lerp(Color3.FromHexString('#ffaf78'),Color3.FromHexString('#fff4db'),Math.min(1,day*.9));
    this.ambient.intensity=.22+day*.78;
    this.ambient.diffuse=Color3.Lerp(Color3.FromHexString('#63769a'),Color3.FromHexString('#c8e1ec'),day);
    this.scene.fogColor=Color3.Lerp(Color3.FromHexString('#102033'),Color3.FromHexString('#abc8d4'),day);
    this.mats.window.emissiveColor=Color3.FromHexString('#f6c68e').scale((1-day)*.85);
    this.shader?.setVector3('sunDir',sunDir);this.shader?.setFloat('daylight',day);this.shader?.setFloat('sunset',sunset);this.shader?.setFloat('time',this.time);
    this.fallback.emissiveColor=Color3.Lerp(Color3.FromHexString('#10243b'),Color3.FromHexString('#83b7d2'),day);
    this.scene.clearColor=this.fallback.emissiveColor.toColor4();
    this.sky.position.copyFrom(player);
    const night=day<.35;
    for(const item of this.lamps) item.light.setEnabled(night && Vector3.DistanceSquared(item.position,player)<2400);
  }
  registerLamp(light:import('@babylonjs/core').PointLight,position:Vector3) { this.lamps.push({light,position}); }
  unregisterLamp(light:import('@babylonjs/core').PointLight) { this.lamps=this.lamps.filter(item=>item.light!==light); }
  get shaderReady(){return !this.shader||this.shader.isReady(this.sky);}
  dispose(){ this.sky.dispose(); this.shader?.dispose();this.fallback.dispose(); this.shadows?.dispose(); this.sun.dispose(); this.ambient.dispose(); }
}
