import { Color3, PBRMaterial, Scene, Texture } from '@babylonjs/core';
export type Surface='asphalt'|'concrete'|'grass'|'sand'|'brick'|'plaster'|'stone'|'metal'|'roof'|'dirt';
export class MaterialLibrary {
  readonly surfaces={} as Record<Surface,PBRMaterial>;
  readonly glass:PBRMaterial; readonly darkGlass:PBRMaterial; readonly rubber:PBRMaterial;
  readonly window:PBRMaterial; readonly roadLine:PBRMaterial; readonly curb:PBRMaterial;
  constructor(private scene:Scene) {
    for(const id of ['asphalt','concrete','grass','sand','brick','plaster','stone','metal','roof','dirt'] as Surface[]) {
      const mat=new PBRMaterial(id,scene);
      mat.albedoTexture=new Texture(`/textures/${id}_albedo.webp`,scene);
      mat.bumpTexture=new Texture(`/textures/${id}_normal.webp`,scene);
      mat.metallicTexture=new Texture(`/textures/${id}_orm.webp`,scene);
      mat.useRoughnessFromMetallicTextureGreen=true;
      mat.useMetallnessFromMetallicTextureBlue=true;
      mat.useAmbientOcclusionFromMetallicTextureRed=true;
      mat.metallic=id==='metal'?.6:0;
      mat.roughness=.82;
      mat.bumpTexture.level=.52;
      for(const tex of [mat.albedoTexture,mat.bumpTexture,mat.metallicTexture]) { if(tex instanceof Texture) { tex.uScale=4; tex.vScale=4; } }
      this.surfaces[id]=mat;
    }
    this.glass=this.solid('windshield','#172c38',.45,.18);
    this.darkGlass=this.solid('dark-glass','#243743',.5,.1);
    this.window=this.solid('window','#476b78',.39,.12);
    this.window.emissiveColor=Color3.FromHexString('#141d24');
    this.rubber=this.solid('rubber','#161a1c',.92,0);
    this.roadLine=this.solid('road-marking','#e4d9b8',.78,0);
    this.curb=this.solid('curb','#c5bcb0',.9,0);
  }
  solid(name:string,hex:string,roughness=.65,metallic=0):PBRMaterial {
    const m=new PBRMaterial(name,this.scene); m.albedoColor=Color3.FromHexString(hex); m.roughness=roughness; m.metallic=metallic; return m;
  }
  paint(hex:string):PBRMaterial {
    const m=this.solid(`paint-${hex}`,hex,.22,.62);
    m.clearCoat.isEnabled=true; m.clearCoat.intensity=.78; m.clearCoat.roughness=.16;
    return m;
  }
  dispose() { Object.values(this.surfaces).forEach(x=>x.dispose()); [this.glass,this.darkGlass,this.window,this.rubber,this.roadLine,this.curb].forEach(x=>x.dispose()); }
}
