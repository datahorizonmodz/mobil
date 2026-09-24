import { GRAPHICS, PAINTS, type GraphicsPreset, type GraphicsSettings } from '../config/gameConfig';
import { VEHICLES, getVehicle } from '../config/vehicles';
import { activeGraphics, type SaveData } from '../app/save';
import type { Telemetry } from '../game/vehicle/vehicle';
export type Panel='lobby'|'garage'|'settings'|'controls'|'about';
export interface UIActions {drive:()=>void;open:(panel:Panel)=>void;selectVehicle:(id:string)=>void;selectPaint:(index:number)=>void;saveSettings:(changes:Partial<SaveData>)=>void;graphicsSetting:(key:keyof GraphicsSettings,value:number|boolean)=>void;resume:()=>void;reset:()=>void;mainMenu:()=>void;toggleCamera:()=>void;pause:()=>void;}
const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export class UI {
  private app=document.querySelector<HTMLElement>('#app')!;private panel:Panel='lobby';private save:SaveData;
  private loading:HTMLElement|null=null;private hud:HTMLElement|null=null;private pauseLayer:HTMLElement|null=null;
  private debug:HTMLElement|null=null;private mapOpen=false;
  constructor(save:SaveData,private actions:UIActions){this.save=save;this.renderMenu();}
  setSave(save:SaveData,render=true){this.save=save;if(render&&!this.hud)this.renderMenu();}
  showPanel(panel:Panel){this.panel=panel;this.renderMenu();}
  private nav(){return `<div class="menu-top"><div class="brand-mark"><span>CD</span><i></i></div><div class="brand-word">COASTLINE <span>// DRIVE</span></div><div class="edition">SUNSET COAST <b>•</b> FREE ROAM 01</div></div>`;}
  private renderMenu(){
    if(this.hud)return;
    const v=getVehicle(this.save.vehicleId),gfx=activeGraphics(this.save);
    let content='';
    if(this.panel==='lobby')content=`<div class="eyebrow"><span class="live-dot"></span> OPEN WORLD DRIVING EXPERIENCE <span class="line"></span> V1.0</div>
      <h1>FIND YOUR<br><em>OWN ROAD.</em></h1>
      <p class="lead">A fictional coast. Ten machines. Endless roads to take at your pace.</p>
      <div class="profile-box"><label for="playerName">DRIVER PROFILE</label><input id="playerName" maxlength="22" autocomplete="nickname" placeholder="Your driver name" value="${escapeHTML(this.save.playerName)}"/><div class="profile-bottom"><span>SELECTED VEHICLE</span><strong>${escapeHTML(v.name)} <small>↗</small></strong></div></div>
      <div class="main-actions"><button class="primary" data-action="drive">START DRIVING <span>↗</span></button><button class="secondary" data-panel="garage">EXPLORE GARAGE <span>→</span></button></div>
      <div class="menu-links"><button data-panel="settings">SETTINGS</button><button data-panel="controls">CONTROLS</button><button data-panel="about">ABOUT</button></div>`;
    if(this.panel==='garage'){
      const index=VEHICLES.findIndex(x=>x.id===v.id);
      content=`<div class="eyebrow"><span class="live-dot"></span> THE GARAGE <span class="line"></span> ${String(index+1).padStart(2,'0')} / ${VEHICLES.length}</div>
      <h2>CHOOSE YOUR<br><em>MACHINE.</em></h2><p class="lead">Every vehicle has its own character. Drag to orbit • scroll to zoom.</p>
      <div class="car-selector"><button class="arrow" data-action="prevVehicle" aria-label="Previous vehicle">←</button><div><small>${escapeHTML(v.vehicleClass.toUpperCase())} / ${String(index+1).padStart(2,'0')}</small><strong>${escapeHTML(v.name)}</strong></div><button class="arrow" data-action="nextVehicle" aria-label="Next vehicle">→</button></div>
      <div class="specs"><div><span>POWER</span><b>${v.horsepower} HP</b></div><div><span>WEIGHT</span><b>${v.mass.toLocaleString()} KG</b></div><div><span>TOP SPEED</span><b>${v.topSpeed} KM/H</b></div><div><span>DRIVETRAIN</span><b>${v.driven.toUpperCase()}</b></div><div><span>HANDLING</span><b>${Math.round(v.tireGrip*68)} / 100</b></div><div><span>BRAKING</span><b>${Math.round(v.brakingForce/170)} / 100</b></div></div>
      <div class="paint-heading">EXTERIOR FINISH <span>${PAINTS[this.save.paint].name}</span></div><div class="paint-swatches">${PAINTS.map((p,i)=>`<button class="swatch ${this.save.paint===i?'active':''}" style="--swatch:${p.hex}" data-paint="${i}" title="${p.name}" aria-label="${p.name}"></button>`).join('')}</div>
      <div class="main-actions"><button class="primary" data-action="drive">DRIVE ${escapeHTML(v.name.toUpperCase())} <span>↗</span></button><button class="secondary" data-panel="lobby">BACK TO LOBBY <span>←</span></button></div>`;
    }
    if(this.panel==='settings')content=`<div class="eyebrow">TUNE YOUR EXPERIENCE</div><h2>SETTINGS<span class="period">.</span></h2><div class="settings-scroll">
      <div class="section-heading">GRAPHICS</div><label class="field">QUALITY PRESET <select data-setting="graphics">${(['auto','low','medium','high','ultra'] as GraphicsPreset[]).map(p=>`<option value="${p}" ${this.save.graphics===p?'selected':''}>${p.toUpperCase()}${p==='auto'?' — DEVICE DETECTION':''}</option>`).join('')}</select></label><p class="field-note">Presets adjust resolution, shadows, draw distance and vegetation. Applies on the next drive.</p>
      <div class="settings-grid"><label class="field">RESOLUTION <select data-graphic="resolution">${[[.7,'70%'],[.85,'85%'],[1,'100%']].map(([x,n])=>`<option value="${x}" ${gfx.resolution===x?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">SHADOWS <select data-graphic="shadows">${[[0,'OFF'],[1024,'MEDIUM'],[2048,'HIGH'],[3072,'ULTRA']].map(([x,n])=>`<option value="${x}" ${gfx.shadows===x?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">DRAW DISTANCE <select data-graphic="renderDistance"><option value="1" ${gfx.renderDistance===1?'selected':''}>NEAR</option><option value="2" ${gfx.renderDistance===2?'selected':''}>FAR</option></select></label><label class="field">VEGETATION <select data-graphic="vegetation">${[[.35,'LOW'],[.65,'MEDIUM'],[1,'HIGH'],[1.25,'DENSE']].map(([x,n])=>`<option value="${x}" ${gfx.vegetation===x?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">FPS TARGET <select data-graphic="fpsTarget"><option value="30" ${gfx.fpsTarget===30?'selected':''}>30 FPS</option><option value="60" ${gfx.fpsTarget===60?'selected':''}>60 FPS</option></select></label></div><label class="check-field"><input type="checkbox" data-graphic="antialias" ${gfx.antialias?'checked':''}/> FXAA ANTI-ALIASING</label><label class="check-field"><input type="checkbox" data-graphic="bloom" ${gfx.bloom?'checked':''}/> SUBTLE BLOOM</label><label class="check-field"><input type="checkbox" data-graphic="reflections" ${gfx.reflections?'checked':''}/> ENVIRONMENT REFLECTIONS</label>
      <div class="section-heading">AUDIO</div><label class="field">MASTER VOLUME <input type="range" min="0" max="1" step="0.01" data-setting="volume" value="${this.save.volume}"/></label><label class="field">ENGINE VOLUME <input type="range" min="0" max="1" step="0.01" data-setting="engineVolume" value="${this.save.engineVolume}"/></label>
      <div class="section-heading">GAMEPLAY</div><label class="field">STARTING TIME <select data-setting="timeOfDay">${[[6,'SUNRISE'],[9,'MORNING'],[12,'NOON'],[16.5,'AFTERNOON'],[18.5,'SUNSET'],[22,'NIGHT']].map(([h,n])=>`<option value="${h}" ${this.save.timeOfDay===h?'selected':''}>${n}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-setting="autoTime" ${this.save.autoTime?'checked':''}/> AUTOMATIC DAY / NIGHT CYCLE</label><label class="field">UI SCALE <input type="range" min="0.8" max="1.3" step="0.05" data-setting="uiScale" value="${this.save.uiScale}"/></label><label class="check-field"><input type="checkbox" data-setting="reducedMotion" ${this.save.reducedMotion?'checked':''}/> REDUCED UI MOTION</label>
      </div><div class="main-actions"><button class="secondary" data-panel="lobby">← BACK</button></div>`;
    if(this.panel==='controls')content=`<div class="eyebrow">DRIVER HANDBOOK</div><h2>THE<br><em>CONTROLS.</em></h2><div class="control-list">${[['W / ↑','THROTTLE'],['S / ↓','BRAKE • REVERSE'],['A D / ← →','STEER'],['SPACE','HANDBRAKE'],['C','CHANGE CAMERA'],['R','RESET & REPAIR'],['ESC','PAUSE'],['M','EXPAND MAP'],['F3','PERFORMANCE STATS']].map(([key,value])=>`<div><kbd>${key}</kbd><span>${value}</span></div>`).join('')}</div><p class="field-note">Gamepad: left stick to steer, right trigger to accelerate, left trigger to brake, A for handbrake. Touch controls appear on mobile.</p><button class="secondary" data-panel="lobby">← BACK</button>`;
    if(this.panel==='about')content=`<div class="eyebrow">A ROAD WITHOUT A DESTINATION</div><h2>THE<br><em>COAST IS YOURS.</em></h2><p class="lead">Coastline Drive is a single-player driving sandbox set in an original, procedurally generated coastal region. Explore changing light, discover new districts and enjoy the ride.</p><div class="about-grid"><div><b>10</b><small>ORIGINAL VEHICLES</small></div><div><b>5</b><small>WORLD DISTRICTS</small></div><div><b>∞</b><small>ROADS TO DISCOVER</small></div></div><p class="field-note">Created with Babylon.js and Havok. Vehicle names, world, artwork and textures are original.</p><button class="secondary" data-panel="lobby">← BACK</button>`;
    this.app.innerHTML=`<div class="menu-shell">${this.nav()}<main class="menu-panel ${this.panel}">${content}</main><div class="menu-footer"><span>COASTLINE / 728391</span><span>EXPLORE AT YOUR OWN SPEED</span><span>◉ LOCAL SAVE</span></div></div>`;
    this.bindMenu();this.applyScale();
  }
  private bindMenu(){
    this.app.querySelectorAll<HTMLElement>('[data-panel]').forEach(el=>el.addEventListener('click',()=>this.actions.open(el.dataset.panel as Panel)));
    this.app.querySelectorAll<HTMLElement>('[data-action]').forEach(el=>el.addEventListener('click',()=>{
      const action=el.dataset.action;if(action==='drive')this.actions.drive();
      if(action==='prevVehicle'||action==='nextVehicle'){const i=VEHICLES.findIndex(v=>v.id===this.save.vehicleId);this.actions.selectVehicle(VEHICLES[(i+(action==='nextVehicle'?1:-1)+VEHICLES.length)%VEHICLES.length].id);}
    }));
    this.app.querySelectorAll<HTMLElement>('[data-paint]').forEach(el=>el.addEventListener('click',()=>this.actions.selectPaint(Number(el.dataset.paint))));
    this.app.querySelector<HTMLInputElement>('#playerName')?.addEventListener('input',e=>this.actions.saveSettings({playerName:(e.target as HTMLInputElement).value.slice(0,22)}));
    this.app.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(el=>el.addEventListener('change',()=>{
      const key=el.dataset.setting as keyof SaveData;const raw=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:el.value;
      const value=['volume','engineVolume','uiScale','timeOfDay'].includes(key)?Number(raw):raw;
      this.actions.saveSettings({[key]:value});
    }));
    this.app.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-graphic]').forEach(el=>el.addEventListener('change',()=>{
      const key=el.dataset.graphic as keyof GraphicsSettings;
      this.actions.graphicsSetting(key,el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:Number(el.value));
    }));
  }
  showLoading(stage:string,progress:number){
    if(!this.loading?.isConnected){this.app.innerHTML=`<div class="loading-screen"><div class="load-brand">COASTLINE <span>// DRIVE</span></div><div class="load-center"><div class="load-ring"></div><h2>THE ROAD<br><em>IS WAITING.</em></h2><p id="load-stage"></p><div class="load-track"><div id="load-fill"></div></div><span id="load-percent"></span></div><small>PREPARING YOUR DRIVE</small></div>`;this.loading=this.app.querySelector('.loading-screen');}
    this.loading!.querySelector('#load-stage')!.textContent=stage;
    (this.loading!.querySelector('#load-fill') as HTMLElement).style.width=`${progress}%`;
    this.loading!.querySelector('#load-percent')!.textContent=`${Math.round(progress)}%`;
  }
  showHUD(){this.loading=null;
    this.app.innerHTML=`<div class="hud" id="hud"><div class="hud-top"><div class="hud-brand">C<span>//</span>D</div><div class="hud-location"><small id="district">DOWNTOWN</small><span>SECTOR <b id="coords">00 / 00</b></span></div><div class="hud-actions"><span id="clock">16:30</span><button data-hud="pause" aria-label="Pause">Ⅱ</button></div></div><div class="hud-bottom"><div class="hud-left"><div class="map-disc" id="minimap"><div class="map-road horizontal"></div><div class="map-road vertical"></div><div class="map-player">▲</div></div><div class="vehicle-label"><span>NOW DRIVING</span><strong id="vehicle-name"></strong><small id="camera-mode">CHASE CAMERA</small></div></div><div class="speed-cluster"><div class="speed-readout"><span id="speed">000</span><div><b>KM/H</b><strong id="gear">1</strong></div></div><div class="rpm-track"><div id="rpm-fill"></div></div><div class="cluster-foot"><span>RPM <b id="rpm">0900</b></span><span>VEHICLE <b id="health">100%</b></span></div></div></div><div class="touch-controls"><div class="touch-steer"><button data-drive="left" aria-label="Steer left">◀</button><button data-drive="right" aria-label="Steer right">▶</button></div><div class="touch-pedals"><button data-drive="handbrake" class="mini" aria-label="Handbrake">P</button><button data-drive="brake" aria-label="Brake">BRAKE</button><button data-drive="throttle" class="accelerate" aria-label="Accelerate">GO</button></div><button class="touch-camera" data-hud="camera" aria-label="Change camera">CAM</button></div></div>`;
    this.hud=this.app.querySelector('#hud');this.bindHUD();this.applyScale();
  }
  private bindHUD(){this.app.querySelector('[data-hud="pause"]')?.addEventListener('click',()=>this.actions.pause());this.app.querySelector('[data-hud="camera"]')?.addEventListener('click',()=>this.actions.toggleCamera());}
  updateHUD(t:Telemetry,time:number,vehicle:string,district:string,coords:string,camera:string){if(!this.hud)return;
    const set=(id:string,text:string)=>{const el=this.hud!.querySelector(`#${id}`);if(el)el.textContent=text;};
    set('speed',String(Math.round(t.speed)).padStart(3,'0'));set('rpm',String(t.rpm).padStart(4,'0'));set('gear',t.gear);set('health',`${t.health}%`);
    set('clock',`${String(Math.floor(time)).padStart(2,'0')}:${String(Math.floor(time%1*60)).padStart(2,'0')}`);
    set('district',district.toUpperCase());set('coords',coords);set('vehicle-name',vehicle.toUpperCase());set('camera-mode',camera+' CAMERA');
    (this.hud.querySelector('#rpm-fill') as HTMLElement).style.width=`${Math.min(100,t.rpm/8500*100)}%`;
  }
  showPause(){if(this.pauseLayer)return;this.pauseLayer=document.createElement('div');this.pauseLayer.className='pause-layer';this.pauseLayer.innerHTML=`<div class="pause-card"><div class="eyebrow">TAKE A BREATH</div><h2>PAUSED<span class="period">.</span></h2><button class="primary" data-pause="resume">RESUME DRIVE ↗</button><button class="secondary" data-pause="reset">RESET & REPAIR</button><button class="secondary" data-pause="settings">SETTINGS</button><button class="secondary" data-pause="garage">RETURN TO GARAGE</button><button class="text-link" data-pause="menu">MAIN MENU</button></div>`;this.app.append(this.pauseLayer);
    this.pauseLayer.querySelectorAll<HTMLElement>('[data-pause]').forEach(el=>el.addEventListener('click',()=>{const a=el.dataset.pause;if(a==='resume')this.actions.resume();if(a==='reset'){this.actions.reset();this.actions.resume();}if(a==='garage')this.actions.open('garage');if(a==='menu')this.actions.mainMenu();if(a==='settings')this.showPauseSettings();}));
  }
  private showPauseSettings(){if(!this.pauseLayer)return;const p=this.pauseLayer.querySelector('.pause-card')!;p.innerHTML=`<div class="eyebrow">QUICK SETTINGS</div><h2>DISPLAY<span class="period">.</span></h2><label class="field">GRAPHICS PRESET <select id="quick-graphics">${Object.keys(GRAPHICS).map(x=>`<option value="${x}" ${this.save.graphics===x?'selected':''}>${x.toUpperCase()}</option>`).join('')}</select></label><label class="field">MASTER VOLUME <input type="range" id="quick-volume" min="0" max="1" step=".01" value="${this.save.volume}"/></label><label class="field">TIME OF DAY <input type="range" id="quick-time" min="0" max="23.9" step=".1" value="${this.save.timeOfDay}"/></label><p class="field-note">Graphics quality changes on the next drive.</p><button class="primary" id="quick-back">BACK TO PAUSE</button>`;
    p.querySelector<HTMLSelectElement>('#quick-graphics')!.onchange=e=>this.actions.saveSettings({graphics:(e.target as HTMLSelectElement).value as GraphicsPreset});
    p.querySelector<HTMLInputElement>('#quick-volume')!.oninput=e=>this.actions.saveSettings({volume:Number((e.target as HTMLInputElement).value)});
    p.querySelector<HTMLInputElement>('#quick-time')!.oninput=e=>this.actions.saveSettings({timeOfDay:Number((e.target as HTMLInputElement).value),autoTime:false});
    p.querySelector('#quick-back')!.addEventListener('click',()=>{this.hidePause();this.showPause();});
  }
  hidePause(){this.pauseLayer?.remove();this.pauseLayer=null;}
  toggleDebug(){if(this.debug){this.debug.remove();this.debug=null;}else{this.debug=document.createElement('pre');this.debug.className='debug-panel';this.app.append(this.debug);}}
  updateDebug(text:string){if(this.debug)this.debug.textContent=text;}
  toggleMap(){this.mapOpen=!this.mapOpen;this.hud?.classList.toggle('map-expanded',this.mapOpen);}
  showError(message:string){this.app.innerHTML=`<div class="error-screen"><div class="brand-word">COASTLINE // DRIVE</div><h2>COULD NOT START<br>THE ENGINE.</h2><p>${escapeHTML(message)}</p><button class="primary" id="reload">RETRY</button></div>`;this.app.querySelector('#reload')?.addEventListener('click',()=>location.reload());}
  showRuntimeError(stage:string,backend:string,error:unknown){
    if(this.app.querySelector('.runtime-error'))return;
    const message=error instanceof Error?error.message:String(error);
    const query=new URLSearchParams(location.search);query.set('safe','1');query.set('renderer','webgl');
    const screen=document.createElement('div');screen.className='error-screen runtime-error';
    screen.innerHTML=`<div class="brand-word">COASTLINE // DRIVE</div><h2>3D RENDER<br>INTERRUPTED.</h2><p>Stage: ${escapeHTML(stage)} · ${escapeHTML(backend)} · ${matchMedia('(pointer:coarse)').matches?'MOBILE':'DESKTOP'}<br>${escapeHTML(message)}</p><p>Try safe graphics if your browser cannot render this scene.</p><div class="runtime-actions"><button class="primary" data-runtime="safe">SAFE MODE</button><button class="secondary" data-runtime="reload">RELOAD</button></div>`;
    this.app.append(screen);
    screen.querySelector('[data-runtime="reload"]')?.addEventListener('click',()=>location.reload());
    screen.querySelector('[data-runtime="safe"]')?.addEventListener('click',()=>{location.href=`${location.pathname}?${query}`;});
  }
  clearGameplay(){this.hud=null;this.loading=null;this.pauseLayer=null;this.debug=null;this.app.innerHTML='';}
  private applyScale(){document.documentElement.style.setProperty('--ui-scale',String(this.save.uiScale));document.documentElement.classList.toggle('reduced-motion',this.save.reducedMotion);}
}
