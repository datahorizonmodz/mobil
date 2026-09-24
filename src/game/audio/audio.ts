export class GameAudio {
  private ctx:AudioContext|null=null;private oscillator:OscillatorNode|null=null;private filter:BiquadFilterNode|null=null;private gain:GainNode|null=null;
  private master=.65;private engine=.72;
  async start(){try{this.ctx??=new AudioContext();await this.ctx.resume();this.oscillator=this.ctx.createOscillator();this.filter=this.ctx.createBiquadFilter();this.gain=this.ctx.createGain();this.oscillator.type='sawtooth';this.filter.type='lowpass';this.filter.frequency.value=320;this.gain.gain.value=.001;this.oscillator.connect(this.filter).connect(this.gain).connect(this.ctx.destination);this.oscillator.start();}catch{this.dispose();}}
  setLevels(master:number,engine:number){this.master=master;this.engine=engine;}
  update(rpm:number,throttle:number,speed:number){if(!this.ctx||!this.oscillator||!this.filter||!this.gain)return;const t=this.ctx.currentTime;
    this.oscillator.frequency.setTargetAtTime(35+rpm*.027,t,.08);
    this.filter.frequency.setTargetAtTime(240+rpm*.19+throttle*470,t,.09);
    this.gain.gain.setTargetAtTime(this.master*this.engine*(.012+Math.min(.026,rpm/290000)+throttle*.013+speed/12000),t,.1);
  }
  dispose(){try{this.oscillator?.stop();}catch{}this.oscillator?.disconnect();this.filter?.disconnect();this.gain?.disconnect();this.ctx?.close().catch(()=>{});this.ctx=null;}
}
