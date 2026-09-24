import { Effect, Mesh, MeshBuilder, Scene, ShaderMaterial, Vector3 } from '@babylonjs/core';
Effect.ShadersStore['coastWaterVertexShader']=`precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; uniform mat4 world; uniform float clock; varying vec3 vWorld; varying float vWave; void main(){vec3 p=position; float wave=sin(p.x*.045+clock*.8)*.10+cos(p.z*.06-clock*.67)*.09; p.y+=wave; vWorld=(world*vec4(p,1.)).xyz; vWave=wave; gl_Position=worldViewProjection*vec4(p,1.);}`;
Effect.ShadersStore['coastWaterFragmentShader']=`precision highp float; varying vec3 vWorld; varying float vWave; uniform vec3 cameraPosition; uniform float clock; uniform float daylight; void main(){float ripple=sin(vWorld.x*.19+clock*1.6)*cos(vWorld.z*.23-clock*1.2); vec3 normal=normalize(vec3(ripple*.12,1.,sin(vWorld.z*.16+clock)*.11)); vec3 view=normalize(cameraPosition-vWorld); float fres=pow(1.-max(dot(normal,view),0.),3.); vec3 deep=vec3(.025,.18,.24); vec3 shallow=vec3(.11,.37,.43); vec3 color=mix(deep,shallow,.42+.2*ripple); color+=fres*vec3(.24,.42,.46)+pow(max(dot(reflect(normalize(vec3(.5,-1.,.2)),normal),view),0.),90.)*.7*daylight; color*=.36+.64*daylight; gl_FragColor=vec4(color,.86);}`;
export class Water {
  mesh:Mesh; material:ShaderMaterial; private clock=0;
  constructor(scene:Scene,subdivisions=32) {
    this.material=new ShaderMaterial('animated-water',scene,{vertex:'coastWater',fragment:'coastWater'},{attributes:['position'],uniforms:['world','worldViewProjection','clock','cameraPosition','daylight'],needAlphaBlending:true});
    this.material.backFaceCulling=false;
    this.mesh=MeshBuilder.CreateGround('coastal-ocean',{width:4200,height:1700,subdivisions},scene);
    this.mesh.position.set(0,-.75,-1320); this.mesh.material=this.material; this.mesh.isPickable=false; this.mesh.renderingGroupId=1;
  }
  update(dt:number,camera:Vector3,daylight:number) {this.clock+=dt;this.material.setFloat('clock',this.clock);this.material.setVector3('cameraPosition',camera);this.material.setFloat('daylight',daylight);}
  dispose(){this.mesh.dispose();this.material.dispose();}
}
