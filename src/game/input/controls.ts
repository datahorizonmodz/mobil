import type { DriveInput } from '../vehicle/vehicle';
type Action='left'|'right'|'throttle'|'brake'|'handbrake';
export class Controls {
  private keys=new Set<string>();private touches=new Set<Action>();
  private padCameraHeld=false;private padPauseHeld=false;private mapRequest=false;private cameraRequest=false;private resetRequest=false;private pauseRequest=false;private debugRequest=false;
  constructor(private target:HTMLElement){window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur);this.bindTouch();}
  private down=(e:KeyboardEvent)=>{
    if(['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    if(e.repeat&&['KeyC','KeyR','Escape','F3'].includes(e.code))return;
    this.keys.add(e.code);
    if(e.code==='KeyC')this.cameraRequest=true;if(e.code==='KeyR')this.resetRequest=true;
    if(e.code==='Escape')this.pauseRequest=true;if(e.code==='KeyM')this.mapRequest=true;if(e.code==='F3')this.debugRequest=true;
  };
  private up=(e:KeyboardEvent)=>{this.keys.delete(e.code);};
  private blur=()=>{this.keys.clear();this.touches.clear();};
  private bindTouch(){this.target.querySelectorAll<HTMLElement>('[data-drive]').forEach(el=>{
    const action=el.dataset.drive as Action;
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);this.touches.add(action);el.classList.add('pressed');});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,()=>{this.touches.delete(action);el.classList.remove('pressed');});
  });}
  consume(event:'camera'|'reset'|'pause'|'debug'|'map') {const key=`${event}Request` as const;const result=this[key];this[key]=false;return result;}
  read():DriveInput {
    const pad=navigator.getGamepads?.()[0];
    const steer=(this.keys.has('KeyD')||this.keys.has('ArrowRight')||this.touches.has('right')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')||this.touches.has('left')?1:0);
    const throttle=this.keys.has('KeyW')||this.keys.has('ArrowUp')||this.touches.has('throttle')?1:0;
    const brake=this.keys.has('KeyS')||this.keys.has('ArrowDown')||this.touches.has('brake')?1:0;
    if(pad){const cameraPressed=!!pad.buttons[3]?.pressed,pausePressed=!!pad.buttons[9]?.pressed;if(cameraPressed&&!this.padCameraHeld)this.cameraRequest=true;if(pausePressed&&!this.padPauseHeld)this.pauseRequest=true;this.padCameraHeld=cameraPressed;this.padPauseHeld=pausePressed;
      return {steer:Math.abs(pad.axes[0])>.12?pad.axes[0]:steer,throttle:Math.max(throttle,pad.buttons[7]?.value||0),brake:Math.max(brake,pad.buttons[6]?.value||0),handbrake:this.keys.has('Space')||this.touches.has('handbrake')||!!pad.buttons[0]?.pressed};}
    return {steer,throttle,brake,handbrake:this.keys.has('Space')||this.touches.has('handbrake')};
  }
  dispose(){window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);this.touches.clear();}
}
