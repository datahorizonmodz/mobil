import { Axis, Color3, Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Quaternion, Ray, Scene, SpotLight, TransformNode, Vector3 } from '@babylonjs/core';
import type { VehicleConfig } from '../../config/vehicles';
import { MaterialLibrary } from '../rendering/materials';
import { terrainHeight } from '../world/terrain';
export interface DriveInput {throttle:number;brake:number;steer:number;handbrake:boolean;}
export interface Telemetry {speed:number;rpm:number;gear:string;health:number;traction:number;water:boolean;}
interface Wheel {mesh:TransformNode;mount:Vector3;front:boolean;spin:number;length:number;contact:boolean;}
export class Vehicle {
  root:Mesh; aggregate:PhysicsAggregate; wheels:Wheel[]=[];
  private paint:import('@babylonjs/core').PBRMaterial; private lights:SpotLight[]=[];
  private input:DriveInput={throttle:0,brake:0,steer:0,handbrake:false};
  private smoothSteer=0; private smoothThrottle=0; private rpm=900; private gear=1; private gearCooldown=0;
  health=100; private lastSpeed=0; private underwater=0; private wheelRadius:number;
  constructor(private scene:Scene,mats:MaterialLibrary,readonly config:VehicleConfig,color:string,position=new Vector3(0,1.05,15)) {
    const [width,,length]=config.dimensions;
    this.wheelRadius=config.vehicleClass.includes('SUV')||config.vehicleClass==='Pickup'?.43:.36;
    this.root=MeshBuilder.CreateBox('vehicle-physics-chassis',{width:width*.85,height:.48,depth:length*.86},scene);
    this.root.position.copyFrom(position);this.root.rotationQuaternion=Quaternion.Identity();this.root.visibility=0;
    this.paint=mats.paint(color);
    const visuals=Vehicle.createVisual(scene,mats,config,this.paint,this.root);
    this.wheels=visuals.wheels.map(w=>({...w,spin:0,length:.5,contact:false}));
    this.aggregate=new PhysicsAggregate(this.root,PhysicsShapeType.BOX,{mass:config.mass,friction:.7,restitution:.05},scene);
    this.aggregate.body.setLinearDamping(.13);this.aggregate.body.setAngularDamping(.75);
    for(const s of [-1,1]){
      const lamp=new SpotLight(`headlamp-${s}`,new Vector3(),new Vector3(0,-.08,1),Math.PI/4,12,scene);
      lamp.diffuse=Color3.FromHexString('#fff4d8');lamp.intensity=0;lamp.range=42;this.lights.push(lamp);
    }
  }
  static createVisual(scene:Scene,mats:MaterialLibrary,config:VehicleConfig,paint:import('@babylonjs/core').PBRMaterial,parent:TransformNode) {
    const [width,height,length]=config.dimensions;const suv=height>1.65;const bodyY=suv?.04:-.12;
    const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:import('@babylonjs/core').Material)=>{
      const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;return m;
    };
    const chrome=mats.solid('trim-'+config.id,'#8f999a',.27,.9);
    const black=mats.solid('underbody-'+config.id,'#10161a',.75,.12);
    const lamp=mats.solid('headlights-'+config.id,'#efe8d3',.2,.1);lamp.emissiveColor=Color3.FromHexString('#f8dfad').scale(.35);
    const tail=mats.solid('taillights-'+config.id,'#9d1c1c',.34,.04);tail.emissiveColor=Color3.FromHexString('#ed3530').scale(.6);
    box('sculpted-lower-body',width*.97,.43,length*.93,0,bodyY-.12,0,paint);
    box('shoulder-line',width,.17,length*.84,0,bodyY+.13,0,paint);
    box('front-bumper',width*.94,.17,.26,0,bodyY-.32,length*.47,black);
    box('rear-bumper',width*.92,.16,.24,0,bodyY-.32,-length*.47,black);
    box('hood',width*.91,.12,length*.29,0,bodyY+.23,length*.27,paint);
    box('trunk',width*.88,.11,length*.18,0,bodyY+.24,-length*.32,paint);
    const cabinLength=length*(config.id==='raven'?.34:.43);
    box('cabin',width*.77,height*.36,cabinLength,0,bodyY+.37,-length*.055,mats.darkGlass);
    box('roof',width*.76,.11,cabinLength*.72,0,bodyY+.37+height*.2,-length*.08,paint);
    for(const s of [-1,1]){
      box('side-glass',.03,height*.23,cabinLength*.79,s*width*.388,bodyY+.4,-length*.06,mats.glass);
      box('mirror',.22,.14,.34,s*(width*.51),bodyY+.37,length*.04,paint);
      box('headlamp',width*.23,.12,.07,s*width*.31,bodyY+.07,length*.472,lamp);
      box('taillamp',width*.27,.11,.06,s*width*.29,bodyY+.08,-length*.47,tail);
      box('door-handle',.14,.055,.33,s*width*.493,bodyY+.16,-length*.11,chrome);
      box('wheel-arch-front',.08,.19,.82,s*width*.5,bodyY-.2,config.wheelBase/2,black);
      box('wheel-arch-rear',.08,.19,.82,s*width*.5,bodyY-.2,-config.wheelBase/2,black);
    }
    box('front-grille',width*.34,.13,.06,0,bodyY-.08,length*.473,black);
    box('front-divider',width*.55,.025,.08,0,bodyY+.015,length*.476,chrome);
    box('dashboard',width*.68,.1,.33,0,bodyY+.26,length*.055,black);
    box('front-seat-left',.32,.33,.35,-width*.17,bodyY+.22,-length*.13,black);
    box('front-seat-right',.32,.33,.35,width*.17,bodyY+.22,-length*.13,black);
    const wheels:{mesh:TransformNode;mount:Vector3;front:boolean}[]=[];
    const wheelRadius=suv||config.vehicleClass==='Pickup'?.43:.36;
    for(const front of [true,false])for(const side of [-1,1]){
      const mount=new Vector3(side*config.track/2,-.14,front?config.wheelBase/2:-config.wheelBase/2);
      const pivot=new TransformNode(`wheel-pivot-${front}-${side}`,scene);pivot.parent=parent;pivot.position.copyFrom(mount);pivot.position.y-=.48;
      const tire=MeshBuilder.CreateCylinder('tire',{diameter:wheelRadius*2,height:.27,tessellation:20},scene);
      tire.parent=pivot;tire.rotation.z=Math.PI/2;tire.material=mats.rubber;
      const rim=MeshBuilder.CreateCylinder('five-spoke-rim',{diameter:wheelRadius*1.25,height:.288,tessellation:10},scene);
      rim.parent=pivot;rim.rotation.z=Math.PI/2;rim.material=chrome;
      const hub=MeshBuilder.CreateCylinder('hub',{diameter:wheelRadius*.28,height:.30,tessellation:12},scene);
      hub.parent=pivot;hub.rotation.z=Math.PI/2;hub.material=black;
      wheels.push({mesh:pivot,mount,front});
    }
    return {wheels};
  }
  setInput(input:DriveInput){this.input=input;}
  physicsStep(dt:number){
    const body=this.aggregate.body;const velocity=body.getLinearVelocity();const angular=body.getAngularVelocity();
    const forward=this.root.getDirection(Axis.Z).normalize();const right=this.root.getDirection(Axis.X).normalize();
    const speed=Vector3.Dot(velocity,forward);const kmh=Math.abs(speed)*3.6;
    this.smoothSteer+=(this.input.steer-this.smoothSteer)*Math.min(1,dt*5.5);
    this.smoothThrottle+=(this.input.throttle-this.smoothThrottle)*Math.min(1,dt*3.8);
    const steerAngle=this.smoothSteer*this.config.steeringAngle*Math.PI/180*(.37+.63/(1+kmh/75));
    this.gearCooldown=Math.max(0,this.gearCooldown-dt);
    if(this.input.brake>.1&&Math.abs(speed)<1.5)this.gear=0;
    else if(this.smoothThrottle>.08&&this.gear===0&&speed>=-.5)this.gear=1;
    const ratio=this.gear===0?3.1:this.config.gearRatios[this.gear-1];
    const wheelRPM=Math.abs(speed)/(2*Math.PI*this.wheelRadius)*60;
    const drivenRPM=wheelRPM*ratio*this.config.finalDrive;
    this.rpm=Math.min(this.config.redlineRPM+300,Math.max(this.config.idleRPM,this.rpm+(Math.max(this.config.idleRPM,drivenRPM+this.smoothThrottle*680)-this.rpm)*Math.min(1,dt*8)));
    if(this.gear>0&&this.gearCooldown===0){
      if(this.rpm>this.config.redlineRPM*.88&&this.gear<this.config.gearRatios.length){this.gear++;this.gearCooldown=.55;}
      else if(this.rpm<this.config.redlineRPM*.33&&this.gear>1){this.gear--;this.gearCooldown=.55;}
    }
    const peak=this.config.redlineRPM*.58;
    const torqueCurve=Math.max(.48,1-Math.pow((this.rpm-peak)/(this.config.redlineRPM*.85),2));
    const torque=this.config.maxTorque*torqueCurve*(.55+this.health*.0045);
    const drivenWheels=this.config.driven==='awd'?4:2;
    const engineForce=this.smoothThrottle*torque*ratio*this.config.finalDrive*.8/(this.wheelRadius*drivenWheels);
    let contacts=0;let gripTotal=0;
    this.root.computeWorldMatrix(true);
    for(const wheel of this.wheels){
      const mount=Vector3.TransformCoordinates(wheel.mount,this.root.getWorldMatrix());
      const ray=new Ray(mount.add(new Vector3(0,.18,0)),new Vector3(0,-1,0),1.55);
      const hit=this.scene.pickWithRay(ray,m=>m.metadata?.ground===true);
      const suspensionLength=hit?.hit?hit.distance-.18-this.wheelRadius:.82;
      const rest=this.config.vehicleClass==='Off-road SUV'?.64:.54;
      const length=Math.max(.06,Math.min(rest+.3,suspensionLength));
      wheel.length=length;wheel.contact=!!hit?.hit&&suspensionLength<rest+.22;
      wheel.mesh.position.y=wheel.mount.y-length;
      wheel.spin+=speed*dt/this.wheelRadius;
      wheel.mesh.rotation.x=wheel.spin;
      if(wheel.front)wheel.mesh.rotation.y=steerAngle;
      if(!wheel.contact)continue;
      contacts++;
      const normal=hit!.getNormal(true)??Vector3.Up();
      const r=mount.subtract(this.root.position);
      const pointVelocity=velocity.add(Vector3.Cross(angular,r));
      const vertical=Vector3.Dot(pointVelocity,normal);
      const compression=rest-length;
      const spring=Math.max(0,Math.min(this.config.mass*18,this.config.suspensionStiffness*compression-this.config.damping*vertical));
      const point=mount.subtract(new Vector3(0,length,0));
      body.applyForce(normal.scale(spring),point);
      let tireForward=forward;
      if(wheel.front)tireForward=forward.scale(Math.cos(steerAngle)).add(right.scale(Math.sin(steerAngle))).normalize();
      const tireRight=Vector3.Cross(Vector3.Up(),tireForward).normalize();
      const lateral=Vector3.Dot(pointVelocity,tireRight);
      let grip=this.config.tireGrip;
      if(this.input.handbrake&&!wheel.front)grip*=.24;
      if(this.root.position.z< -530)grip*=.55;
      const limit=Math.max(850,spring*grip);
      const lateralForce=Math.max(-limit,Math.min(limit,-lateral*this.config.mass*2.1));
      const driving=(this.config.driven==='awd'||(this.config.driven==='fwd'&&wheel.front)||(this.config.driven==='rwd'&&!wheel.front));
      let longitudinal=driving?engineForce:0;
      if(this.input.brake>.05&&speed>.45)longitudinal-=Math.min(this.config.brakingForce/4,this.input.brake*this.config.brakingForce/4);
      if(this.input.handbrake&&!wheel.front)longitudinal-=Math.sign(speed)*this.config.brakingForce*.2;
      if(this.gear===0&&this.input.brake>.05)longitudinal=-this.input.brake*torque*ratio*this.config.finalDrive*.55/(this.wheelRadius*4);
      longitudinal=Math.max(-limit,Math.min(limit,longitudinal));
      body.applyForce(tireForward.scale(longitudinal).add(tireRight.scale(lateralForce)),point);
      gripTotal+=Math.abs(lateralForce)/limit;
    }
    const drag=.5*1.22*this.config.dragCoefficient*2.3*speed*Math.abs(speed);
    const resistance=velocity.scale(-this.config.mass*.16);
    const water=this.root.position.z< -570&&this.root.position.y<1;
    body.applyForce(forward.scale(-drag).add(resistance).add(water?velocity.scale(-this.config.mass*2):Vector3.Zero()),this.root.position);
    if(kmh>this.config.topSpeed)body.applyForce(forward.scale(-(kmh-this.config.topSpeed)*180),this.root.position);
    if(contacts===0&&Math.abs(angular.z)>4)body.setAngularVelocity(angular.scale(.9));
    if(water){this.underwater+=dt;if(this.underwater>4)this.reset();}else this.underwater=0;
    if(this.lastSpeed-kmh>38&&this.lastSpeed>45)this.health=Math.max(25,this.health-(this.lastSpeed-kmh)*.22);
    this.lastSpeed=kmh;
    this.telemetry={speed:kmh,rpm:Math.round(this.rpm),gear:this.gear===0?'R':String(this.gear),health:Math.round(this.health),traction:contacts/4,water};
  }
  telemetry:Telemetry={speed:0,rpm:900,gear:'1',health:100,traction:0,water:false};
  updateLights(night:number){
    this.root.computeWorldMatrix(true);
    this.lights.forEach((light,i)=>{
      const s=i===0?-1:1;
      light.position=Vector3.TransformCoordinates(new Vector3(s*this.config.dimensions[0]*.3,-.04,this.config.dimensions[2]*.47),this.root.getWorldMatrix());
      light.direction=this.root.getDirection(new Vector3(s*.07,-.09,1)).normalize();light.intensity=night>0?night*17:0;
    });
  }
  reset(position?:Vector3){
    const x=Math.round(this.root.position.x/160)*160,z=Math.round(this.root.position.z/160)*160+22;
    const p=position??new Vector3(x,terrainHeight(x,z)+1.5,z);
    this.root.position.copyFrom(p);this.root.rotationQuaternion=Quaternion.Identity();this.aggregate.body.setTargetTransform(p,Quaternion.Identity());
    this.aggregate.body.setLinearVelocity(Vector3.Zero());this.aggregate.body.setAngularVelocity(Vector3.Zero());this.health=100;this.underwater=0;
  }
  dispose(){this.lights.forEach(l=>l.dispose());this.aggregate.dispose();this.root.dispose(false,false);this.paint.dispose();}
}
