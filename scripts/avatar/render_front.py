# ---------------------------------------------------------------------------
# يرسم رأس الشخصية من الأمام بكاميرا متعامدة (orthographic) معروفة الإحداثيات،
# لاستخراج معالم وجهه (MediaPipe) ومحاذاتها بمعالم الصورة المرجعية في
# face_from_photo.py. يكتب front.png و front-cam.json (تحويل 3D ← بكسل).
#
#   blender -b --python scripts/avatar/render_front.py -- --glb public/sign/avatar/signer.glb --out <dir>
# ---------------------------------------------------------------------------
import argparse
import json
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--glb', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--size', type=int, default=1024)
ap.add_argument('--scale', type=float, default=0.34, help='عرض المشهد بالمتر')
A = ap.parse_args(argv)
os.makedirs(A.out, exist_ok=True)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(A.glb))
meta = json.load(open(os.path.join(os.path.dirname(os.path.abspath(A.glb)), 'signer.json'), encoding='utf8'))
hc = meta['head']['center']  # glTF: x, y(up), z(front)  → Blender: (x, -z, y)
cx, cy, cz = hc[0], -hc[2], hc[1] + 0.02
# الرأس والعينان والأسنان فقط
keep = ('Head', 'EyeL', 'EyeR', 'TeethUpper', 'TeethLower', 'Tongue')
for o in bpy.data.objects:
    if o.type == 'MESH' and not o.name.startswith(keep):
        o.hide_render = True
scene = bpy.context.scene
cam_data = bpy.data.cameras.new('FrontCam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = A.scale
cam = bpy.data.objects.new('FrontCam', cam_data)
scene.collection.objects.link(cam)
cam.location = (cx, cy - 2.0, cz)
cam.rotation_euler = (math.pi / 2, 0, 0)
scene.camera = cam
# إضاءة مسطّحة من الأمام (للكشف لا للجمال)
world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
scene.world = world
sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = 2.0
sun = bpy.data.objects.new('Sun', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(80), 0, 0)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.device = 'CPU'
scene.render.resolution_x = scene.render.resolution_y = A.size
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(A.out, 'front.png')
bpy.ops.render.render(write_still=True)
# تحويل نقطة Blender (x, y, z) → بكسل: px = (x-cx)/scale*size + size/2 ، py = size/2 - (z-cz)/scale*size
with open(os.path.join(A.out, 'front-cam.json'), 'w', encoding='utf8') as f:
    json.dump({'center': [cx, cy, cz], 'scale': A.scale, 'size': A.size}, f)
print('✅ front.png')
