import { Color3, Matrix, Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, PointLight, Quaternion, Scene, StandardMaterial, TransformNode, Vector3, VertexData } from '@babylonjs/core';
import { CHUNK_SIZE, WORLD_RADIUS, type GraphicsSettings } from '../../config/gameConfig';
import { Random } from '../../utils/random';
import { MaterialLibrary } from '../rendering/materials';
import { Atmosphere } from '../rendering/atmosphere';
import { districtAt, terrainHeight, type District } from './terrain';
interface Chunk {root:TransformNode; colliders:PhysicsAggregate[]; district:District;}
const identity=Quaternion.Identity();
const matrix=(x:number,y:number,z:number,sx=1,sy=1,sz=1)=>Matrix.Compose(new Vector3(sx,sy,sz),identity,new Vector3(x,y,z));
export class World {
  private chunks=new Map<string,Chunk>(); private lampMat:StandardMaterial;
  private lights:PointLight[]=[]; private lastCX=9999; private lastCZ=9999;
  constructor(private scene:Scene,private mats:MaterialLibrary,private atmosphere:Atmosphere,private settings:GraphicsSettings) {
    this.lampMat=new StandardMaterial('warm-streetlights',scene); this.lampMat.diffuseColor=Color3.FromHexString('#fff0bf');this.lampMat.emissiveColor=Color3.FromHexString('#ffd796');
    for(let i=0;i<4;i++){const l=new PointLight(`lamp-light-${i}`,new Vector3(),scene);l.diffuse=Color3.FromHexString('#ffcf8c');l.intensity=0;l.range=25;this.lights.push(l);}
  }
  get loadedChunks(){return this.chunks.size;}
  update(player:Vector3,night:number){
    const cx=Math.round(player.x/CHUNK_SIZE),cz=Math.round(player.z/CHUNK_SIZE);
    if(cx!==this.lastCX||cz!==this.lastCZ){this.lastCX=cx;this.lastCZ=cz;this.stream(cx,cz);}
    const lights:Vector3[]=[];
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++) {
      if(Math.hypot(x*CHUNK_SIZE-player.x,z*CHUNK_SIZE-player.z)>230)continue;
      for(const side of [-1,1])lights.push(new Vector3(x*CHUNK_SIZE+side*13,6.5,z*CHUNK_SIZE+side*13));
    }
    lights.sort((a,b)=>Vector3.DistanceSquared(a,player)-Vector3.DistanceSquared(b,player));
    this.lights.forEach((l,i)=>{l.position.copyFrom(lights[i]??player);l.intensity=night>.1?night*12:0;});
    this.lampMat.emissiveColor=Color3.FromHexString('#ffd799').scale(.12+night*.9);
  }
  private stream(cx:number,cz:number) {
    const radius=this.settings.renderDistance;
    const desired=new Set<string>();
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      const x=cx+dx,z=cz+dz;if(Math.abs(x*CHUNK_SIZE)>WORLD_RADIUS||z*CHUNK_SIZE>WORLD_RADIUS||z*CHUNK_SIZE< -640)continue;
      const key=`${x},${z}`;desired.add(key);if(!this.chunks.has(key))this.chunks.set(key,this.createChunk(x,z));
    }
    for(const [key,c] of this.chunks) if(!desired.has(key)){c.colliders.forEach(p=>p.dispose());c.root.dispose(false,false);this.chunks.delete(key);}
  }
  private addBox(root:TransformNode,name:string,w:number,h:number,d:number,pos:Vector3,mat:import('@babylonjs/core').Material):Mesh {
    const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},this.scene);m.parent=root;m.position.copyFrom(pos);m.material=mat;m.isPickable=false;return m;
  }
  private createChunk(cx:number,cz:number):Chunk {
    const root=new TransformNode(`chunk-${cx}-${cz}`,this.scene);root.position.set(cx*CHUNK_SIZE,0,cz*CHUNK_SIZE);
    const colliders:PhysicsAggregate[]=[]; const rng=new Random((cx*73856093^cz*19349663^728391)>>>0);
    const district=districtAt(cx*CHUNK_SIZE,cz*CHUNK_SIZE);
    const terrain=this.createTerrain(root,cx,cz,district);
    colliders.push(new PhysicsAggregate(terrain,PhysicsShapeType.MESH,{mass:0,friction:.85,restitution:0},this.scene));
    if(cz>=-3){this.createRoads(root,district);this.createBlocks(root,cx,cz,district,rng,colliders);this.createLamps(root);}
    if(cx===0&&cz===-3)this.createBridge(root,colliders);
    this.createVegetation(root,cx,cz,district,rng);
    if(cx===2&&cz===-2)this.createLandmark(root,'MARINA',this.mats.surfaces.plaster);
    if(cx===-2&&cz===1)this.createLandmark(root,'SCENIC RIDGE',this.mats.surfaces.stone);
    return {root,colliders,district};
  }
  private createTerrain(root:TransformNode,cx:number,cz:number,district:District):Mesh {
    const N=20, pos:number[]=[],norm:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let z=0;z<=N;z++)for(let x=0;x<=N;x++) {
      const lx=(x/N-.5)*CHUNK_SIZE,lz=(z/N-.5)*CHUNK_SIZE;
      pos.push(lx,terrainHeight(cx*CHUNK_SIZE+lx,cz*CHUNK_SIZE+lz)-.035,lz);norm.push(0,1,0);uv.push(x/N*4,z/N*4);
    }
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){const a=z*(N+1)+x,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}
    VertexData.ComputeNormals(pos,indices,norm);
    const vd=new VertexData();vd.positions=pos;vd.indices=indices;vd.normals=norm;vd.uvs=uv;
    const mesh=new Mesh(`terrain-${cx}-${cz}`,this.scene);vd.applyToMesh(mesh);mesh.parent=root;
    mesh.material=this.mats.surfaces[district==='coast'?'sand':district==='industrial'?'dirt':'grass'];mesh.metadata={ground:true};mesh.receiveShadows=true;return mesh;
  }
  private createRoads(root:TransformNode,district:District) {
    const road=this.mats.surfaces.asphalt;
    const markings:Matrix[]=[];
    for(const axis of ['x','z'] as const){
      const vertical=axis==='z';const ground=MeshBuilder.CreateGround(`road-${axis}`,{width:vertical?18:CHUNK_SIZE,height:vertical?CHUNK_SIZE:18},this.scene);
      ground.parent=root;ground.position.y=.035;ground.material=road;ground.receiveShadows=true;ground.isPickable=false;
      const edge=vertical?9.1:9.1;
      for(const side of [-1,1]) {
        const walk=MeshBuilder.CreateGround('sidewalk',{width:vertical?3.5:CHUNK_SIZE,height:vertical?CHUNK_SIZE:3.5},this.scene);
        walk.parent=root;walk.position.set(vertical?side*(edge+1.75):0,.065,vertical?0:side*(edge+1.75));walk.material=this.mats.surfaces.concrete;walk.isPickable=false;
        const curb=MeshBuilder.CreateBox('curb',{width:vertical?.17:CHUNK_SIZE,height:.15,depth:vertical?CHUNK_SIZE:.17},this.scene);
        curb.parent=root;curb.position.set(vertical?side*(edge+.1):0,.14,vertical?0:side*(edge+.1));curb.material=this.mats.curb;curb.isPickable=false;
      }
      for(let p=-70;p<=70;p+=12){if(Math.abs(p)<12)continue;
        markings.push(matrix(vertical?0:p,.057,vertical?p:0,vertical?.14:4,.012,vertical?4:.14));
      }
    }
    if(district==='downtown')for(const axis of ['x','z'] as const)for(let n=-1;n<=1;n++) {
      markings.push(matrix(axis==='z'?n*3.3:21+n*3.3,.065,axis==='z'?21+n*3.3:n*3.3,axis==='z'?1.1:12,.012,axis==='z'?12:1.1));
    }
    const paint=MeshBuilder.CreateBox('batched-road-markings',{size:1},this.scene);
    paint.parent=root;paint.material=this.mats.roadLine;paint.isPickable=false;
    paint.thinInstanceSetBuffer('matrix',new Float32Array(markings.flatMap(m=>Array.from(m.toArray()))),16);
  }
  private createBlocks(root:TransformNode,cx:number,cz:number,district:District,rng:Random,colliders:PhysicsAggregate[]) {
    const windowMatrices:Matrix[]=[]; const frameMatrices:Matrix[]=[]; const roofMat=this.mats.surfaces.roof;
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const count=district==='downtown'?3:district==='industrial'?2:district==='coast'?1:2;
      for(let i=0;i<count;i++) {
        if(rng.next()<.13)continue;
        const lx=sx*(26+(i%2)*27+rng.range(-3,3)),lz=sz*(26+Math.floor(i/2)*30+rng.range(-3,3));
        const wx=cx*CHUNK_SIZE+lx,wz=cz*CHUNK_SIZE+lz;
        const width=district==='industrial'?rng.range(18,25):rng.range(12,20),depth=district==='industrial'?rng.range(17,25):rng.range(12,19);
        const height=district==='downtown'?rng.range(19,62):district==='industrial'?rng.range(8,15):district==='suburb'?rng.range(7,15):district==='coast'?rng.range(8,21):rng.range(6,12);
        const base=terrainHeight(wx,wz);
        const palette=district==='industrial'?['metal','brick','concrete'] as const:['plaster','brick','stone','concrete'] as const;
        const body=this.addBox(root,'building-facade',width,height,depth,new Vector3(lx,base+height/2,lz),this.mats.surfaces[rng.pick(palette)]);
        body.receiveShadows=true;
        if(Math.abs(cx)<=1&&Math.abs(cz)<=1&&this.atmosphere.shadows)this.atmosphere.shadows.addShadowCaster(body);
        colliders.push(new PhysicsAggregate(body,PhysicsShapeType.BOX,{mass:0,friction:.6},this.scene));
        this.addBox(root,'foundation',width+.45,.48,depth+.45,new Vector3(lx,base+.24,lz),this.mats.surfaces.concrete);
        this.addBox(root,'roof-parapet',width+.55,.58,depth+.55,new Vector3(lx,base+height+.2,lz),roofMat);
        if(height>15)this.addBox(root,'rooftop-unit',2.4,1.2,2.1,new Vector3(lx+width*.25,base+height+1,lz),this.mats.surfaces.metal);
        const rows=Math.min(10,Math.floor(height/4));const cols=Math.min(5,Math.floor(width/3.5));
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
          const px=lx+(col-(cols-1)/2)*(width/(cols+1));const py=base+2.7+row*(height-4)/Math.max(1,rows);
          for(const s of [-1,1]){
            windowMatrices.push(matrix(px,py,lz+s*(depth/2+.014),1.28,1.65,.08));
            if(row===0&&district==='downtown')frameMatrices.push(matrix(px,py,lz+s*(depth/2+.08),1.65,1.95,.11));
          }
        }
        if(district==='downtown'&&rng.next()<.5){
          const awning=this.addBox(root,'store-awning',width*.62,.27,2.2,new Vector3(lx,base+3.2,lz+depth/2+1),this.mats.surfaces.metal);
          awning.isPickable=false;
        }
        if(district==='suburb'||district==='hills')this.addBox(root,'porch',3,.18,2,new Vector3(lx,base+.24,lz+depth/2+1.1),this.mats.surfaces.concrete);
      }
    }
    if(windowMatrices.length) {
      const window=MeshBuilder.CreateBox('facade-windows',{size:1},this.scene);window.parent=root;window.material=this.mats.window;window.isPickable=false;
      window.thinInstanceSetBuffer('matrix',new Float32Array(windowMatrices.flatMap(m=>Array.from(m.toArray()))),16);
      if(frameMatrices.length){const frames=MeshBuilder.CreateBox('storefront-frames',{size:1},this.scene);frames.parent=root;frames.material=this.mats.surfaces.metal;frames.isPickable=false;frames.thinInstanceSetBuffer('matrix',new Float32Array(frameMatrices.flatMap(m=>Array.from(m.toArray()))),16);}
    }
  }
  private createVegetation(root:TransformNode,cx:number,cz:number,district:District,rng:Random){
    const trunks:Matrix[]=[],crowns:Matrix[]=[],bushes:Matrix[]=[],rocks:Matrix[]=[];
    const count=Math.floor((district==='downtown'?5:district==='industrial'?4:district==='coast'?12:29)*this.settings.vegetation);
    for(let i=0;i<count;i++){
      const x=rng.range(-78,78),z=rng.range(-78,78);
      if(Math.min(Math.abs(x),Math.abs(z))<16 || (district==='coast'&&cz===-3&&z< -35))continue;
      const y=terrainHeight(cx*CHUNK_SIZE+x,cz*CHUNK_SIZE+z);const s=rng.range(.7,1.4);
      if(rng.next()<.18){rocks.push(matrix(x,y+.55,z,s*1.7,s*.9,s*1.2));continue;}
      trunks.push(matrix(x,y+2.35*s,z,.28*s,4.7*s,.28*s));crowns.push(matrix(x,y+6*s,z,2.7*s,5.5*s,2.7*s));
      if(rng.next()<.4)bushes.push(matrix(x+2,y+.55,z-1,1.4,.95,1.4));
    }
    const instances=(name:string,shape:'cylinder'|'sphere'|'cone',mat:import('@babylonjs/core').Material,matrices:Matrix[])=>{
      if(!matrices.length)return;
      const mesh=shape==='sphere'?MeshBuilder.CreateSphere(name,{diameter:1,segments:5},this.scene):MeshBuilder.CreateCylinder(name,{height:1,diameterTop:shape==='cone'?0:1,diameterBottom:1,tessellation:5},this.scene);
      mesh.parent=root;mesh.material=mat;mesh.isPickable=false;mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices.flatMap(m=>Array.from(m.toArray()))),16);
    };
    instances('tree-trunks','cylinder',this.mats.surfaces.roof,trunks);
    instances('tree-crowns','cone',this.mats.surfaces.grass,crowns);
    instances('bushes','sphere',this.mats.surfaces.grass,bushes);
    instances('rocks','sphere',this.mats.surfaces.stone,rocks);
  }
  private createLamps(root:TransformNode){
    const poles:Matrix[]=[],caps:Matrix[]=[],arms:Matrix[]=[];
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const x=sx*13,z=sz*13;poles.push(matrix(x,3.3,z,.17,6.6,.17));arms.push(matrix(x-sx*.9,6.48,z,1.9,.13,.14));caps.push(matrix(x-sx*1.8,6.39,z,1.0,.13,.52));
    }
    const create=(name:string,mats:Matrix[],material:import('@babylonjs/core').Material)=>{
      const mesh=MeshBuilder.CreateBox(name,{size:1},this.scene);mesh.parent=root;mesh.material=material;mesh.isPickable=false;mesh.thinInstanceSetBuffer('matrix',new Float32Array(mats.flatMap(m=>Array.from(m.toArray()))),16);
    };
    create('lamp-poles',poles,this.mats.surfaces.metal);create('lamp-arms',arms,this.mats.surfaces.metal);create('lamp-bulbs',caps,this.lampMat);
  }
  private createLandmark(root:TransformNode,label:string,mat:import('@babylonjs/core').Material){
    const tower=this.addBox(root,`landmark-${label}`,23,75,23,new Vector3(53,37.5,53),mat);
    this.atmosphere.shadows?.addShadowCaster(tower);
    for(let i=0;i<4;i++)this.addBox(root,'tower-bands',24,.7,24,new Vector3(53,16+i*17,53),this.mats.surfaces.metal);
  }
  private createBridge(root:TransformNode,colliders:PhysicsAggregate[]){
    const positions:number[]=[],uv:number[]=[],normals:number[]=[],indices:number[]=[];
    const elevation=(x:number)=>2.65*Math.min(1,Math.max(0,(80-Math.abs(x))/29));
    for(let i=0;i<=32;i++){
      const x=-80+i*5,y=elevation(x)+.12;
      for(const z of [-9,9]){positions.push(x,y,z);normals.push(0,1,0);uv.push(i/4,z===-9?0:1);}
      if(i<32){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    VertexData.ComputeNormals(positions,indices,normals);
    const data=new VertexData();data.positions=positions;data.normals=normals;data.uvs=uv;data.indices=indices;
    const deck=new Mesh('coastal-overpass-deck',this.scene);data.applyToMesh(deck);deck.parent=root;
    deck.material=this.mats.surfaces.asphalt;deck.metadata={ground:true};deck.receiveShadows=true;
    colliders.push(new PhysicsAggregate(deck,PhysicsShapeType.MESH,{mass:0,friction:1},this.scene));
    for(const z of [-9.5,9.5]){
      const rail=this.addBox(root,'bridge-safety-rail',105,.82,.32,new Vector3(0,3.15,z),this.mats.surfaces.metal);
      colliders.push(new PhysicsAggregate(rail,PhysicsShapeType.BOX,{mass:0,friction:.6},this.scene));
      for(const x of [-52,52])this.addBox(root,'bridge-pylon',1.3,14,1.3,new Vector3(x,7,z),this.mats.surfaces.concrete);
      for(let x=-48;x<=48;x+=12)this.addBox(root,'bridge-lane-post',.16,.9,.16,new Vector3(x,3.55,z),this.mats.surfaces.metal);
    }
    for(let x=-60;x<=60;x+=12){
      if(Math.abs(x)<12)continue;
      const dash=MeshBuilder.CreateGround('bridge-marking',{width:3.3,height:.15},this.scene);
      dash.parent=root;dash.position.set(x,elevation(x)+.135,0);dash.material=this.mats.roadLine;dash.isPickable=false;
    }
  }
  dispose(){for(const c of this.chunks.values()){c.colliders.forEach(a=>a.dispose());c.root.dispose(false,false);}this.chunks.clear();this.lights.forEach(l=>l.dispose());this.lampMat.dispose();}
}
