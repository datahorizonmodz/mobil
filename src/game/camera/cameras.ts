import { FreeCamera, Ray, Scene, Vector3, Axis } from '@babylonjs/core';
import { Vehicle } from '../vehicle/vehicle';
const MODES=['CHASE','FAR','HOOD','COCKPIT'] as const;
export class DriveCamera {
  readonly camera:FreeCamera; private index=0; private target=new Vector3();
  get mode(){return MODES[this.index];}
  constructor(private scene:Scene,private vehicle:Vehicle){
    this.camera=new FreeCamera('drive-camera',new Vector3(0,4,-8),scene);
    this.camera.minZ=.12;this.camera.maxZ=1100;this.camera.fov=.84;scene.activeCamera=this.camera;
    this.target=vehicle.root.position.clone();
  }
  next(){this.index=(this.index+1)%MODES.length;}
  update(dt:number){
    const car=this.vehicle.root;car.computeWorldMatrix(true);const f=car.getDirection(Axis.Z).normalize();const up=car.getDirection(Axis.Y).normalize();
    const speed=this.vehicle.telemetry.speed;
    const mode=this.mode;
    let dest:Vector3,aim:Vector3;
    if(mode==='HOOD'){dest=car.position.add(f.scale(this.vehicle.config.dimensions[2]*.32)).add(up.scale(.50));aim=dest.add(f.scale(22));}
    else if(mode==='COCKPIT'){dest=car.position.add(f.scale(.48)).add(up.scale(.49));aim=dest.add(f.scale(24));}
    else {const far=mode==='FAR';const distance=(far?11:6.5)+Math.min(3,speed*.018);dest=car.position.subtract(f.scale(distance)).add(new Vector3(0,far?5.1:3.05,0));
      const delta=dest.subtract(car.position);const ray=new Ray(car.position.add(new Vector3(0,1.2,0)),delta.normalize(),delta.length());
      const hit=this.scene.pickWithRay(ray,m=>m.metadata?.ground===true);
      if(hit?.hit&&hit.distance>1)dest=ray.origin.add(ray.direction.scale(Math.max(1.7,hit.distance-.5)));
      aim=car.position.add(f.scale(3+speed*.028)).add(new Vector3(0,.75,0));}
    const blend=1-Math.exp(-dt*(mode==='HOOD'||mode==='COCKPIT'?12:5.5));
    this.camera.position=Vector3.Lerp(this.camera.position,dest,blend);
    this.target=Vector3.Lerp(this.target,aim,1-Math.exp(-dt*7));
    this.camera.setTarget(this.target);
    this.camera.fov=.84+Math.min(.17,speed/1000);
  }
  dispose(){this.camera.dispose();}
}
