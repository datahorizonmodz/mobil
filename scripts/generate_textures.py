"""Generate original, tileable PBR texture sets for Coastline Drive."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
rng = np.random.default_rng(728391)
materials = {
 'asphalt': ((65,70,70), 17, .25), 'concrete': ((171,164,148), 15, .1),
 'grass': ((89,119,73), 34, .1), 'sand': ((185,166,122), 21, .08),
 'brick': ((142,91,77), 15, .18), 'plaster': ((194,186,165), 12, .06),
 'stone': ((116,125,117), 18, .12), 'metal': ((102,113,118), 12, .55),
 'roof': ((103,93,82), 18, .22), 'dirt': ((112,96,77), 30, .1),
}
for name, (base, contrast, metallic) in materials.items():
  low = rng.normal(0, 1, (64,64)).astype('float32')
  low = np.array(Image.fromarray(np.uint8(np.clip((low+3)*42,0,255))).resize((SIZE,SIZE), Image.Resampling.BICUBIC)).astype('float32') / 42 - 3
  fine = rng.normal(0, 1, (SIZE,SIZE)).astype('float32')
  h = low*.38 + fine*.62
  rgb = np.stack([np.clip(base[c]+h*contrast,0,255) for c in range(3)], axis=-1).astype('uint8')
  im = Image.fromarray(rgb,'RGB')
  if name in ('asphalt','concrete'):
    d = ImageDraw.Draw(im, 'RGBA')
    for i in range(180 if name=='asphalt' else 50):
      x,y = rng.integers(0,SIZE,2); r = int(rng.integers(1,4))
      d.ellipse((int(x-r),int(y-r),int(x+r),int(y+r)), fill=(205,202,180,int(rng.integers(30,110))))
  if name=='brick':
    d=ImageDraw.Draw(im,'RGBA')
    for row in range(16):
      y=row*32
      d.line((0,y,SIZE,y),fill=(43,43,41,125),width=3)
      for x in range((row%2)*-32, SIZE, 64): d.line((x,y,x,y+32),fill=(46,46,42,110),width=3)
  if name=='roof':
    d=ImageDraw.Draw(im,'RGBA')
    for y in range(0,SIZE,32): d.line((0,y,SIZE,y),fill=(38,36,32,100),width=2)
  im.save(OUT/f'{name}_albedo.webp',quality=88)
  gy,gx=np.gradient(h)
  normal=np.stack([np.clip(128-gx*12,0,255),np.clip(128-gy*12,0,255),np.full_like(h,235)],axis=-1).astype('uint8')
  Image.fromarray(normal,'RGB').save(OUT/f'{name}_normal.webp',quality=88)
  orm = np.stack([np.full_like(h,235),np.clip(204-h*8,75,245),np.full_like(h,metallic*255)],axis=-1).astype('uint8')
  Image.fromarray(orm,'RGB').save(OUT/f'{name}_orm.webp',quality=88)
print(f'Generated {len(materials)*3} local PBR maps')
