"""Deterministic orthographic rounded-box bake. Requires numpy and Pillow.

Each frame has the same camera, scale and pivot. The accompanying face matrix
uses that camera too, so symbols cannot drift relative to the baked bevel.
Run from any directory: python tools/bake-tiles.py
"""
from pathlib import Path
import json
import os
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'tile-poses'
OUT.mkdir(parents=True, exist_ok=True)
W, H, COLS = 180, 252, 6
ANGLES = list(range(-70, 71, 5))
atlas = Image.new('RGBA', (W * COLS, H * 5))
frames = []
radius = .065
half = np.array([.5, .7, .205])

def sdf(p):
    q = np.abs(p) - (half - radius)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(np.max(q, axis=-1), 0) - radius

for index, angle in enumerate(ANGLES):
    # Reference tiles pitch toward the viewer: a broad lower side is visible.
    # The former Y-only rotation squeezed the face into a thin upright strip.
    a, b = np.deg2rad([angle*.16, 10+abs(angle)*.70])
    ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    rotation = rx @ ry
    # Supersampling preserves the narrow red seam at phone sizes.
    ss = 2
    x, y = np.meshgrid((np.arange(W*ss)+.5)/(W*ss)*1.35-.675,
                       (np.arange(H*ss)+.5)/(H*ss)*1.89-.945)
    origin = np.stack([x, y, np.full_like(x, 3)], -1) @ rotation
    direction = np.array([0, 0, -1]) @ rotation
    shape=x.shape
    origin=origin.reshape(-1,3)
    distance = np.zeros(origin.shape[0])
    active=np.arange(len(distance))
    for step in range(65):
        p = origin[active] + distance[active,None] * direction
        d = sdf(p)
        distance[active] += np.maximum(d,0)
        active=active[(d>.00002)&(distance[active]<5)]
        if not len(active):break
    p = (origin + distance[..., None] * direction).reshape(*shape,3)
    distance=distance.reshape(shape)
    hit = (sdf(p) < .001) & (distance < 5)
    normal = np.stack([sdf(p + np.eye(3)[k]*.0005) - sdf(p - np.eye(3)[k]*.0005) for k in range(3)], -1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-8)
    n = normal @ rotation.T
    light = np.array([-.45, .6, 1.3]); light /= np.linalg.norm(light)
    diffuse = np.maximum(n @ light, 0)
    spec = np.maximum(n @ ((light + [0,0,1])/np.linalg.norm(light + [0,0,1])), 0)**32
    intensity = .78 + .20*diffuse + .045*spec
    base = np.broadcast_to(np.array([248.,248.,246.]), p.shape).copy()
    base[p[...,2] < -.13] = [197, 38, 40]
    rgb = np.clip(base * intensity[...,None], 0, 255)
    rgba = np.concatenate([rgb, hit[...,None]*255], -1).astype('uint8')
    frame = Image.fromarray(rgba).resize((W,H), Image.Resampling.LANCZOS)
    atlas.paste(frame, ((index%COLS)*W, (index//COLS)*H))
    print(f'Pose {index+1}/{len(ANGLES)}', flush=True)
    # Project the inset front plane into coordinates relative to tile width.
    center = rotation @ np.array([0,0,.206])
    ux, uy = rotation[:,0]*.88, rotation[:,1]*1.28
    top_left = center - ux/2 - uy/2
    frames.append({'angle':angle, 'matrix':[float(ux[0]),float(ux[1]),float(uy[0]/1.4),float(uy[1]/1.4),float(top_left[0]+.5),float(top_left[1]+.7)]})
atlas.save(OUT / 'shells.png', optimize=True)
(OUT / 'poses.js').write_text('const TILE_POSES = '+json.dumps(frames, separators=(',',':'))+';\n', encoding='utf-8')
preview = Image.new('RGBA', (W*3,H*3), '#398f77')
for i, frame_id in enumerate([0,4,8,11,14,17,20,24,28]):
    frame = atlas.crop(((frame_id%COLS)*W,(frame_id//COLS)*H,(frame_id%COLS+1)*W,(frame_id//COLS+1)*H))
    preview.alpha_composite(frame, ((i%3)*W,(i//3)*H))
preview.convert('RGB').save(OUT / 'preview.jpg', quality=94)
print(f'Baked {len(frames)} poses: {OUT}')
