import { CHUNK_SIZE } from '../../config/gameConfig';
import { hash2, smooth } from '../../utils/random';
function noise(x:number,z:number):number {const xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi;const sx=smooth(0,1,fx),sz=smooth(0,1,fz);const a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);return ((a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz)*2-1;}
export function terrainHeight(x:number,z:number):number {
  const hill=smooth(430,1050,Math.hypot(x*.82,z*.95));
  const n=noise(x/170,z/170)*8+noise(x/52,z/52)*2.2;
  const roadDistance=Math.min(Math.abs(x-Math.round(x/CHUNK_SIZE)*CHUNK_SIZE),Math.abs(z-Math.round(z/CHUNK_SIZE)*CHUNK_SIZE));
  const flatten=smooth(11,42,roadDistance);
  const coast=z< -510 ? -smooth(510,650,-z)*2.1 : 0;
  return hill*n*flatten + coast + noise(x/21,z/21)*.13*flatten;
}
export type District='downtown'|'suburb'|'industrial'|'hills'|'coast';
export function districtAt(x:number,z:number):District {
  if(z< -350) return 'coast';
  if(x>360 && z<380) return 'industrial';
  if(z>430 || Math.abs(x)>850) return 'hills';
  if(Math.abs(x)<330 && Math.abs(z)<340) return 'downtown';
  return 'suburb';
}
