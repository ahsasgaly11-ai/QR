# ---------------------------------------------------------------------------
# يبني شخصية المترجم ثلاثية الأبعاد (signer.glb) داخل Blender من بيانات MakeHuman
# (CC0) دون تشغيل أي إضافة خارجية:
#   • الجسم من base.obj بأهداف الماكرو (رجل عربي خليجي) + أهداف تفصيلية
#   • هيكل «game engine» (أذرع، كفّان بأصابع كاملة، عمود فقري، رقبة، رأس) + عظمتا عينين
#   • 23 مفتاح شكل لتعابير الوجه من وحدات تعبير MakeHuman (الحاجبان، الجفون، الفكّ، الفم)
#   • ثوب قطري (جذع وأكمام من الجسم المنعَّم، تنّورة أنبوبية، ياقة، شقّ أزرار، جيب، أساور)
#   • غترة (قبّعة وطيّة أمامية وسدل) وعقال، عينان بقزحية، أسنان ولسان
#   • تصدير GLB (مفاتيح الشكل والجلد) + signer.json بمواضع المفاصل المرجعية للمحرّك
#
#   blender -b --python scripts/avatar/build_signer.py -- --mhdata <mpfb>/data --out public/sign/avatar
#   (يحتاج skin.jpg و iris.png من skin_texture.py في مجلّد الإخراج)
# ---------------------------------------------------------------------------
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh_common import (BODY_VERTS, FACE_ORDER, FACE_UNITS, apply_targets, expression_unit_delta,  # noqa: E402
                       group_indices, joint_center, load_obj, load_vgroups, macro_targets, side_mask,
                       to_blender)
from character import CHARACTER  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--mhdata', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--blend', default='')
ap.add_argument('--sim', action='store_true', help='محاكاة قماش الغترة (تجريبي)')
A = ap.parse_args(argv)
C = CHARACTER
OUT = os.path.abspath(A.out)
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# 1) الشبكة الأساسية + الأهداف
# ---------------------------------------------------------------------------
obj = load_obj(os.path.join(A.mhdata, '3dobjs', 'base.obj'))
vg = load_vgroups(os.path.join(A.mhdata, 'mesh_metadata', 'basemesh_vertex_groups.json'))
V_obj = apply_targets(obj['V'], macro_targets(A.mhdata, **C['macro']) + [
    (os.path.join(A.mhdata, 'targets', p + '.target.gz'), w) for p, w in C['details']])
VT, FACES = obj['VT'], obj['faces']
N = len(V_obj)
VB = to_blender(V_obj)
ground_z = joint_center(VB, vg, 'joint-ground')[2]
VB[:, 2] -= ground_z  # القدمان على الأرض


def J(name):
    return joint_center(VB, vg, name)


# ---------------------------------------------------------------------------
# 2) الهيكل والأوزان
# ---------------------------------------------------------------------------
rig = json.load(open(os.path.join(A.mhdata, 'rigs', 'standard', 'rig.game_engine.json'), encoding='utf8'))
weights = json.load(open(os.path.join(A.mhdata, 'rigs', 'standard', 'weights.game_engine.json'), encoding='utf8'))['weights']


def bone_point(spec):
    if spec['strategy'] == 'CUBE':
        return J(spec['cube_name'])
    if spec['strategy'] == 'MEAN':
        return VB[spec['vertex_indices']].mean(axis=0)
    if spec['strategy'] == 'VERTEX':
        return VB[spec['vertex_index']]
    return np.array(spec['default_position'])


# الوزن الأعظم لكل رأس (لتصنيف المناطق)
dom = np.full(N, '', dtype=object)
dom_w = np.zeros(N)
vert_weights = {}  # vertex -> list of (bone, w)
for bone, lst in weights.items():
    for vi, w in lst:
        vert_weights.setdefault(vi, []).append((bone, w))
        if w > dom_w[vi]:
            dom_w[vi] = w
            dom[vi] = bone

# ---------------------------------------------------------------------------
# 3) أدوات هندسية
# ---------------------------------------------------------------------------
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def vertex_normals(P, faces):
    nrm = np.zeros_like(P)
    for f in faces:
        for i in range(1, len(f) - 1):
            a, b, c = P[f[0]], P[f[i]], P[f[i + 1]]
            n = np.cross(b - a, c - a)
            for k in (f[0], f[i], f[i + 1]):
                nrm[k] += n
    l = np.linalg.norm(nrm, axis=1)
    l[l == 0] = 1
    return nrm / l[:, None]


def laplacian_smooth(P, faces, iters=10, lam=0.5, mu=-0.53):
    """تنعيم Taubin (بلا انكماش): خطوة λ ثم خطوة μ سالبة، بمصفوفة جوار متّجهة."""
    e0, e1 = [], []
    for f in faces:
        for i in range(len(f)):
            e0.append(f[i])
            e1.append(f[(i + 1) % len(f)])
    e0, e1 = np.array(e0), np.array(e1)
    deg = np.zeros(len(P))
    np.add.at(deg, e0, 1)
    np.add.at(deg, e1, 1)
    deg[deg == 0] = 1
    Q = P.copy()
    for _ in range(iters):
        for k in (lam, mu):
            acc = np.zeros_like(Q)
            np.add.at(acc, e0, Q[e1])
            np.add.at(acc, e1, Q[e0])
            Q = Q + k * (acc / deg[:, None] - Q)
    return Q


MATS = {}


def material(name, color, rough=0.8, metal=0.0, tex=None, double=False, spec=0.5):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*[c / 255 for c in color], 1.0) if max(color) > 1 else (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = spec
    if tex:
        img = bpy.data.images.load(tex)
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = img
        m.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    m.use_backface_culling = not double
    MATS[name] = m
    return m


def make_object(name, P, faces, uvs=None, mat=None, groups=None, smooth=True):
    """ينشئ كائن شبكة. P: (n,3)، faces: قوائم فهارس محلية، uvs: لكل وجه قائمة (u,v)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in P], [], [list(f) for f in faces])
    me.update()
    if uvs is not None:
        uv = me.uv_layers.new(name='UVMap')
        li = 0
        for f, fuv in zip(faces, uvs):
            for k in range(len(f)):
                uv.data[li].uv = fuv[k]
                li += 1
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    if groups:
        for bone, lst in groups.items():
            if not lst:
                continue
            g = ob.vertex_groups.new(name=bone)
            for vi, w in lst:
                g.add([int(vi)], float(w), 'REPLACE')
    return ob


def body_subset(selector, name, mat, offset_fn=None, smooth_iters=0, keep_uv=True, pre_offset=None):
    """ينسخ وجوه الجسم التي تحقّق selector(face_vertex_indices) إلى كائن جديد بأوزانه."""
    sel_faces = [(vi, ti) for g, vi, ti in FACES if g == 'body' and selector(vi)]
    used = sorted({v for vi, _ in sel_faces for v in vi})
    loc = {v: i for i, v in enumerate(used)}
    P = VB[used].copy()
    lf = [[loc[v] for v in vi] for vi, _ in sel_faces]
    if smooth_iters:
        P = laplacian_smooth(P, lf, smooth_iters)
    if pre_offset:
        P = pre_offset(np.array(used), P)
        P = laplacian_smooth(P, lf, 45, lam=0.5, mu=0.0)  # تنعيم منكمش يسوّي ما بقي من نتوءات
    if offset_fn:
        nrm = vertex_normals(P, lf)
        P = P + nrm * offset_fn(np.array(used), P)[:, None]
    uvs = [[tuple(VT[t]) if t >= 0 else (0, 0) for t in ti] for _, ti in sel_faces] if keep_uv else None
    groups = {}
    for v in used:
        for bone, w in vert_weights.get(v, []):
            groups.setdefault(bone, []).append((loc[v], w))
    ob = make_object(name, P, lf, uvs, mat, groups)
    return ob, used, P, lf


def grid_object(name, P2, nu, nv, mat, groups_fn, close_u=False, flip=False):
    """سطح شبكي nu×nv من مصفوفة نقاط (nu*nv,3)؛ groups_fn(i,j) → {bone: w}."""
    faces = []
    for i in range(nu - (0 if close_u else 1)):
        i2 = (i + 1) % nu
        for j in range(nv - 1):
            a, b, c, d = i * nv + j, i2 * nv + j, i2 * nv + j + 1, i * nv + j + 1
            faces.append([a, d, c, b] if flip else [a, b, c, d])
    groups = {}
    for i in range(nu):
        for j in range(nv):
            for bone, w in groups_fn(i, j).items():
                groups.setdefault(bone, []).append((i * nv + j, w))
    return make_object(name, P2, faces, None, mat, groups)


# ---------------------------------------------------------------------------
# 4) معالم ومناطق
# ---------------------------------------------------------------------------
head_c = J('joint-head')
neck_c = J('joint-neck')
eyeL, eyeR = J('joint-l-eye'), J('joint-r-eye')
mouth_c = J('joint-mouth')
pelvis_c = J('joint-pelvis')
wristL, wristR = J('joint-l-hand'), J('joint-r-hand')
shoulderL, shoulderR = J('joint-l-shoulder'), J('joint-r-shoulder')
body_idx = np.arange(BODY_VERTS)
x, y, z = VB[:, 0], VB[:, 1], VB[:, 2]
clav_z = (J('joint-l-clavicle')[2] + J('joint-r-clavicle')[2]) / 2
collar_z = clav_z + 0.012  # قاعدة الرقبة (مفصل الترقوة): الياقة — لا مفصل «الرقبة» فهو أعلاها
hip_z = pelvis_c[2] - 0.02
brow_z = eyeL[2] + 0.028
# كتلة الرأس: نصف قطر تقريبي
head_pts = VB[[i for i in body_idx if dom[i] == 'head']]
head_axis = np.array([head_c[0], head_c[1]])
head_r = np.percentile(np.hypot(head_pts[:, 0] - head_axis[0], head_pts[:, 1] - head_axis[1]), 97)

HAND_BONES = {b for b in weights if b.startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_'))}
ARM_BONES = {'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'}
TORSO_BONES = {'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'pelvis', 'neck_01'} | ARM_BONES

d_wrist = np.minimum(np.linalg.norm(VB - wristL, axis=1), np.linalg.norm(VB - wristR, axis=1))
visible = np.zeros(N, bool)
for i in body_idx:
    b = dom[i]
    if b in HAND_BONES or d_wrist[i] < 0.04:
        visible[i] = True
    elif (b in ('head', 'neck_01') or math.hypot(x[i], y[i] - neck_c[1]) < 0.1) and z[i] > collar_z - 0.012:
        visible[i] = True  # الرأس والرقبة (عمود الرقبة كلّه فوق الياقة، أيًّا كانت عظمته)
thobe_v = np.zeros(N, bool)
for i in body_idx:
    b = dom[i]
    if b in TORSO_BONES and z[i] > hip_z - 0.01 and d_wrist[i] > 0.015:
        if b == 'neck_01' and z[i] > collar_z + 0.012:
            continue
        thobe_v[i] = True

# ---------------------------------------------------------------------------
# 5) الجسم المرئي (رأس ورقبة وكفّان) + مفاتيح الشكل
# ---------------------------------------------------------------------------
skin = material('skin', C['skin'], rough=0.52, tex=os.path.join(OUT, 'skin.jpg'), spec=0.35)
head_v = np.zeros(N, bool)
yb0 = head_c[1]
for i in body_idx:
    head_v[i] = visible[i] and dom[i] in ('head', 'neck_01', 'spine_03')
    # ما تغطّيه الغترة (قمّة الرأس ومؤخّرته) يُحذف — أخفّ للتحميل
    if head_v[i] and dom[i] == 'head':
        hidden_top = z[i] > brow_z + 0.03 - 0.15 * (y[i] - yb0) + 0.012
        hidden_back = y[i] > yb0 + 0.02 and z[i] > J('joint-jaw')[2] - 0.03
        if hidden_top or hidden_back:
            head_v[i] = False
body_ob, body_used, body_P, body_faces = body_subset(
    lambda vi: all(head_v[v] for v in vi), 'Head', skin)
hands_ob, _, _, _ = body_subset(
    lambda vi: sum(visible[v] for v in vi) >= 2 and not any(dom[v] in ('head', 'neck_01') for v in vi), 'Hands', skin)
loc_body = {v: i for i, v in enumerate(body_used)}

# مفاتيح الشكل
body_ob.shape_key_add(name='Basis', from_mix=False)
body_ob.data.shape_keys.use_relative = True
basis = body_P.copy()
nrm_body = vertex_normals(body_P, body_faces)
ethnic = C['macro']['ethnic']


def add_key(name, delta_b):
    sk = body_ob.shape_key_add(name=name, from_mix=False)
    co = (basis + delta_b[body_used]).astype(np.float32).ravel()
    sk.data.foreach_set('co', co)
    sk.value = 0.0


unit_cache = {}


def unit_delta_blender(unit):
    if unit not in unit_cache:
        d = expression_unit_delta(A.mhdata, unit, ethnic, N)
        db = np.zeros_like(d)
        db[:, 0] = d[:, 0] * 0.1
        db[:, 1] = -d[:, 2] * 0.1
        db[:, 2] = d[:, 1] * 0.1
        unit_cache[unit] = db
    return unit_cache[unit]


for name in FACE_ORDER:
    units = FACE_UNITS[name]
    delta = np.zeros((N, 3))
    for unit, side in units:
        d = unit_delta_blender(unit)
        if side:
            d = d * side_mask(V_obj, side)[:, None]
        delta += d
    if name == 'cheekPuff':
        full = np.zeros((N, 3))
        for ex in (eyeL, eyeR):
            cx = ex[0] * 1.35
            cz = ex[2] - 0.055
            w = np.exp(-(((x - cx) / 0.028) ** 2 + ((z - cz) / 0.03) ** 2)) * smoothstep(head_c[1] - 0.02, head_c[1] - 0.09, y)
            full[body_used] += nrm_body * (w[body_used] * 0.013)[:, None]
        delta = full
    add_key(name, delta)

def subdivide_with_keys(ob, levels=1):
    """تقسيم فرعي (Catmull-Clark) لشبكة تحمل مفاتيح شكل: نقيّم الشبكة المقسّمة لكل
    مفتاح على حدة ونعيد بناء الكائن بالطوبولوجيا الجديدة ومفاتيحه وأوزانه وخريطة UV."""
    mod = ob.modifiers.new('Subd', 'SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    kb = ob.data.shape_keys.key_blocks if ob.data.shape_keys else None
    names = [k.name for k in kb][1:] if kb else []
    if kb:
        for k in kb:
            k.value = 0.0
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    key_co = {}
    for name in names:
        kb[name].value = 1.0
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        arr = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get('co', arr)
        key_co[name] = arr.copy()
        ev.to_mesh_clear()
        kb[name].value = 0.0
    name0 = ob.name
    ob.name = name0 + '_lo'
    ob.data.name = name0 + '_lo'
    new_me.name = name0
    new_ob = bpy.data.objects.new(name0, new_me)
    scene.collection.objects.link(new_ob)
    for g in ob.vertex_groups:
        new_ob.vertex_groups.new(name=g.name)
    new_me.polygons.foreach_set('use_smooth', [True] * len(new_me.polygons))
    if names:
        new_ob.shape_key_add(name='Basis', from_mix=False)
        new_me.shape_keys.use_relative = True
        for name in names:
            sk = new_ob.shape_key_add(name=name, from_mix=False)
            sk.data.foreach_set('co', key_co[name])
            sk.value = 0.0
    bpy.data.objects.remove(ob, do_unlink=True)
    return new_ob


body_ob = subdivide_with_keys(body_ob, 1)

# ---------------------------------------------------------------------------
# 6) العينان والأسنان واللسان
# ---------------------------------------------------------------------------
eye_mat = material('eye', (255, 255, 255), rough=0.12, tex=os.path.join(OUT, 'iris.png'), spec=0.8)


def make_eye(name, center, helper):
    hp = VB[group_indices(vg, helper)]
    R = np.max(np.linalg.norm(hp - center, axis=1)) * 0.93
    center = center + np.array([0, 0.0015, 0])  # إلى الخلف قليلًا تحت الجفون
    seg, rings = 40, 28
    P = []
    uvs = []
    for i in range(rings + 1):
        phi = math.pi * i / rings  # 0 = القطب الأمامي
        for j in range(seg + 1):
            th = 2 * math.pi * j / seg
            # القطب نحو الأمام (-Y)
            px = math.sin(phi) * math.cos(th)
            pz = math.sin(phi) * math.sin(th)
            py = -math.cos(phi)
            P.append(center + R * np.array([px, py, pz]))
    faces, fuv = [], []
    for i in range(rings):
        for j in range(seg):
            a = i * (seg + 1) + j
            b = a + seg + 1
            faces.append([a, b, b + 1, a + 1])
            fuv.append([(j / seg, 1 - i / rings), (j / seg, 1 - (i + 1) / rings), ((j + 1) / seg, 1 - (i + 1) / rings), ((j + 1) / seg, 1 - i / rings)])
    bone = 'eye_l' if 'l-' in helper else 'eye_r'
    return make_object(name, np.array(P), faces, fuv, eye_mat, {bone: [(k, 1.0) for k in range(len(P))]})


make_eye('EyeL', eyeL, 'helper-l-eye')
make_eye('EyeR', eyeR, 'helper-r-eye')

teeth_mat = material('teeth', (236, 232, 222), rough=0.3)
tongue_mat = material('tongue', (170, 72, 78), rough=0.55)
jaw_delta = unit_delta_blender('mouth-open')
mag = np.linalg.norm(jaw_delta, axis=1)
chin_move = jaw_delta[mag > np.percentile(mag[mag > 0], 90)].mean(axis=0)


def helper_object(name, group, mat, bone='head', jaw=0.0):
    idx = set(group_indices(vg, group))
    sel = [(vi, ti) for g, vi, ti in FACES if g == group]
    used = sorted({v for vi, _ in sel for v in vi})
    loc = {v: i for i, v in enumerate(used)}
    P = VB[used]
    lf = [[loc[v] for v in vi] for vi, _ in sel]
    ob = make_object(name, P, lf, None, mat, {bone: [(i, 1.0) for i in range(len(used))]})
    if jaw:
        ob.shape_key_add(name='Basis', from_mix=False)
        ob.data.shape_keys.use_relative = True
        sk = ob.shape_key_add(name='jawOpen', from_mix=False)
        sk.data.foreach_set('co', (P + chin_move * jaw).astype(np.float32).ravel())
        sk.value = 0.0
    return ob


helper_object('TeethUpper', 'helper-upper-teeth', teeth_mat)
helper_object('TeethLower', 'helper-lower-teeth', teeth_mat, jaw=0.95)
helper_object('Tongue', 'helper-tongue', tongue_mat, jaw=0.9)

# ---------------------------------------------------------------------------
# 7) الثوب
# ---------------------------------------------------------------------------
cloth = material('thobe', C['thobe'], rough=0.93, double=True, spec=0.25)


def tube(path_pts, radii, nseg, groups_at):
    """أنبوب حول مسار نقاط (حلقة لكل نقطة) بنصف قطر لكل حلقة؛ groups_at(k) → أوزان الحلقة k."""
    P = []
    prev_u = None
    for k, c in enumerate(path_pts):
        if k < len(path_pts) - 1:
            d = path_pts[k + 1] - c
        else:
            d = c - path_pts[k - 1]
        d = d / (np.linalg.norm(d) + 1e-9)
        if prev_u is None:
            tmp = np.array([0, 0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0, 0])
            u = np.cross(d, tmp)
        else:
            u = prev_u - d * np.dot(prev_u, d)
        u /= np.linalg.norm(u)
        w = np.cross(d, u)
        prev_u = u
        for i in range(nseg):
            th = 2 * math.pi * i / nseg
            P.append(c + radii[k] * (math.cos(th) * u + math.sin(th) * w))
    # grid_object يتوقّع (nu=nseg, nv=rings) بترتيب i*nv+j → نعيد الترتيب
    rings = len(path_pts)
    Q = np.zeros((nseg * rings, 3))
    for k in range(rings):
        for i in range(nseg):
            Q[i * rings + k] = P[k * nseg + i]
    return Q, rings


# الجذع: من الجسم المنعَّم بقوّة (يُخفي التشريح) مع إزاحة قماش
arm_w = np.zeros(N)
for i in body_idx:
    for bone, w in vert_weights.get(i, []):
        if bone in ARM_BONES:
            arm_w[i] += w
arm_w = np.clip(arm_w, 0, 1)
# مقطع الرقبة عند جزئها الضيّق: الياقة تلتفّ حوله وفتحة الثوب تُقصّ بحجمه
neck_pts = VB[[i for i in body_idx if abs(z[i] - (collar_z + 0.035)) < 0.012 and abs(x[i]) < 0.09 and z[i] < J('joint-jaw')[2] - 0.02]]
ncx, ncy = neck_pts[:, 0].mean(), neck_pts[:, 1].mean()
# الياقة خارج سطح الثوب المُزاح (0.017) بقليل، وحافّة فتحة الثوب تنتهي داخلها
nrx = (neck_pts[:, 0].max() - neck_pts[:, 0].min()) / 2 + 0.023
nry = (neck_pts[:, 1].max() - neck_pts[:, 1].min()) / 2 + 0.023
torso_v = np.zeros(N, bool)
for i in body_idx:
    b = dom[i]
    if b in TORSO_BONES and z[i] > hip_z + 0.02 and d_wrist[i] > 0.012:
        # فتحة العنق: أصغر من الياقة بقدر إزاحة القماش (0.017) حتى تقع حافّتها داخل الياقة
        if z[i] > collar_z + 0.014 and ((x[i] - ncx) / (nrx - 0.027)) ** 2 + ((y[i] - ncy) / (nry - 0.027)) ** 2 < 1:
            continue
        torso_v[i] = True


def thobe_offset(gidx, P):
    # قماش فضفاض: على الصدر والبطن، وأكثر قليلًا على الأكمام، أقل قرب الياقة
    base = 0.017 + 0.004 * smoothstep(collar_z - 0.3, collar_z - 0.08, P[:, 2]) * (1 - smoothstep(collar_z - 0.06, collar_z, P[:, 2]))
    return base + 0.006 * smoothstep(0.3, 0.7, arm_w[gidx])


elbowL, elbowR = J('joint-l-elbow'), J('joint-r-elbow')


def sleeve_wrap(gidx, P):
    """الكمّ أنبوب قماش حول محور الذراع (كتف→مرفق→رسغ): نصف قطر كل حلقة = أعلى نصف
    قطر للذراع في نافذة ±4.5سم على طوله، فيختفي تشريح العضلات ويبقى الكمّ مستديرًا."""
    out = P.copy()
    aw = arm_w[gidx]
    armdom = np.array([dom[g] in ARM_BONES for g in gidx])
    for sgn, S_, E_, W_ in ((1, shoulderL, elbowL, wristL), (-1, shoulderR, elbowR, wristR)):
        idx = np.where(armdom & (aw > 0.5) & (np.sign(P[:, 0]) == sgn))[0]
        if not len(idx):
            continue
        Q = P[idx]
        d1 = E_ - S_
        L1 = np.linalg.norm(d1)
        d1 = d1 / L1
        d2 = W_ - E_
        L2 = np.linalg.norm(d2)
        d2 = d2 / L2
        t1 = np.clip(((Q - S_) @ d1) / L1, 0, 1)
        c1 = S_ + np.outer(t1 * L1, d1)
        dist1 = np.linalg.norm(Q - c1, axis=1)
        t2 = np.clip(((Q - E_) @ d2) / L2, 0, 1)
        c2 = E_ + np.outer(t2 * L2, d2)
        dist2 = np.linalg.norm(Q - c2, axis=1)
        use1 = dist1 <= dist2
        c = np.where(use1[:, None], c1, c2)
        u = np.where(use1, t1 * L1, L1 + t2 * L2)
        r = np.where(use1, dist1, dist2)
        radial = Q - c
        rn = np.linalg.norm(radial, axis=1) + 1e-9
        newr = r.copy()
        for k in range(len(idx)):
            w = np.abs(u - u[k]) < 0.045
            newr[k] = np.percentile(r[w], 90)
        b = smoothstep(0.5, 0.8, aw[idx])
        r2 = r + (newr - r) * b
        out[idx] = c + radial / rn[:, None] * r2[:, None]
    return out


def cloth_wrap(gidx, P):
    """القماش «يتدلّى» من أبرز نقطة فوقه في العمود نفسه بميل محدود (كما يسقط قماش
    فضفاض): يزيل الصدر والسرّة والتجاويف دون أن ينفخ الجذع إلى عرض الكتفين.
    المصادر: رؤوس العمود الفقري فقط (لا الكتفان)."""
    cz = P[:, 2]
    # المصادر: رؤوس الجذع تحت منطقة الكتفين (لا شبه المنحرف ولا الترقوتان)
    src = np.array([dom[g] in ('spine_01', 'spine_02', 'spine_03', 'pelvis') for g in gidx]) & (cz < collar_z - 0.06)
    # محور الجذع لكل شريحة من رؤوس الجذع فقط (لا الذراعين المتدلّيتين أمامه)
    centers = {}
    for v in P[src]:
        centers.setdefault(round(v[2] / 0.02), []).append(v[:2])
    cen = {k: np.mean(vs, axis=0) for k, vs in centers.items()}
    keys_sorted = sorted(cen)

    def center_of(zz):
        k = round(zz / 0.02)
        if k in cen:
            return cen[k]
        k2 = min(keys_sorted, key=lambda q: abs(q - k))
        return cen[k2]
    C_ = np.array([center_of(v[2]) for v in P])
    rel = P[:, :2] - C_
    ang = np.arctan2(rel[:, 0], rel[:, 1])
    rad = np.hypot(rel[:, 0], rel[:, 1])
    tgt = src.copy()
    newr = rad.copy()
    for i in np.where(tgt)[0]:
        dth = np.abs((ang - ang[i] + math.pi) % (2 * math.pi) - math.pi)
        m = src & (dth < math.radians(12)) & (cz > cz[i] - 0.12) & (cz < min(cz[i] + 0.1, collar_z - 0.07))
        if m.any():
            # القماش مشدود فوق النتوءات من الجهتين (خيمة بميل محدود)
            val = rad[m] - 0.3 * np.abs(cz[m] - cz[i])
            newr[i] = max(rad[i], float(val.max()))
    keep = smoothstep(collar_z - 0.03, collar_z - 0.09, cz)
    r2 = rad + (newr - rad) * keep
    print('cloth_wrap: sources', int(src.sum()), 'moved>2mm', int((np.abs(r2 - rad) > 0.002).sum()), 'max', round(float(np.abs(r2 - rad).max()), 4))
    out = P.copy()
    out[:, 0] = C_[:, 0] + rel[:, 0] / (rad + 1e-9) * r2
    out[:, 1] = C_[:, 1] + rel[:, 1] / (rad + 1e-9) * r2
    return out


thobe_ob, thobe_used, thobe_P, thobe_faces = body_subset(
    lambda vi: all(torso_v[v] for v in vi), 'Thobe', cloth, offset_fn=thobe_offset, smooth_iters=60, keep_uv=False,
    pre_offset=lambda g, P: sleeve_wrap(g, cloth_wrap(g, P)))

# التنّورة: أنبوب يبدأ مخفيًّا داخل الجذع، لا يضيق عنه في أي ارتفاع، ويتّسع إلى الكاحل
seg, rings = 56, 60
z_top, z_bot = hip_z + 0.11, 0.06
band = thobe_P[np.abs(thobe_P[:, 2] - z_top) < 0.012]
cx, cy = band[:, 0].mean(), band[:, 1].mean()


torso_low = thobe_P[(thobe_P[:, 2] < z_top + 0.03) & (np.abs(thobe_P[:, 0]) < 0.3)]
tl_ang = np.arctan2(torso_low[:, 0] - cx, torso_low[:, 1] - cy)
tl_rad = np.hypot(torso_low[:, 0] - cx, torso_low[:, 1] - cy)


def torso_radius_at(theta, zz):
    dth = np.abs((tl_ang - theta + math.pi) % (2 * math.pi) - math.pi)
    m = (dth < math.radians(8)) & (np.abs(torso_low[:, 2] - zz) < 0.012)
    return float(tl_rad[m].max()) if m.any() else None


def torso_ext(zz):
    b = torso_low[np.abs(torso_low[:, 2] - zz) < 0.012]
    if len(b) < 8:
        return None
    return (b[:, 0].max() - b[:, 0].min()) / 2, (b[:, 1].max() - b[:, 1].min()) / 2


rx_prev = ry_prev = 0.0
ring_r = []
for jr in range(rings):
    t = jr / (rings - 1)
    zz = z_top - t * (z_top - z_bot)
    ext = torso_ext(zz)
    if jr == 0:
        rx, ry = ext[0] - 0.003, ext[1] - 0.003
    else:
        t2 = max(0.0, (z_top - 0.06 - zz) / (z_top - 0.06 - z_bot)) ** 1.15
        rx = rx_prev + (0.30 - rx_prev) * t2 * 0.12
        ry = ry_prev + (0.23 - ry_prev) * t2 * 0.12
        if ext:
            rx, ry = max(rx, ext[0] + 0.004), max(ry, ext[1] + 0.004)
        rx, ry = max(rx, rx_prev), max(ry, ry_prev)
    rx_prev, ry_prev = rx, ry
    ring_r.append((rx, ry, zz))
P = []
prev = {}
for i in range(seg):
    th = 2 * math.pi * i / seg
    px, py = math.cos(th), math.sin(th)
    k = 1.0 / (abs(px) ** 2.4 + abs(py) ** 2.4) ** (1 / 2.4)
    r_last = 0.0
    for jr, (rx, ry, zz) in enumerate(ring_r):
        # نصف القطر الأساسي (بيضوي مربّع) ثم لا يقلّ عن سطح الجذع المكسوّ في منطقة التداخل
        ex, ey = rx * px * k, ry * py * k
        r_el = math.hypot(ex, ey)
        tr = torso_radius_at(math.atan2(ex, ey), zz)
        if tr is not None:
            r_el = max(r_el, tr + (-0.004 if jr == 0 else 0.004))
        r_el = max(r_el, r_last)
        r_last = r_el
        sc = r_el / (math.hypot(ex, ey) + 1e-9)
        P.append([cx + ex * sc, cy + ey * sc, zz])
grid_object('Skirt', np.array(P), seg, rings, cloth, lambda i, j: {'pelvis': 1.0}, close_u=True, flip=True)

# الياقة: شريط قائم حول قاعدة الرقبة
cseg = 48
P = []
for i in range(cseg):
    th = 2 * math.pi * i / cseg
    px, py = math.cos(th), math.sin(th)
    # ياقة قائمة رقيقة (قماش 3 مم): جدار خارجي يتّسع قليلًا من الأسفل ليغطّي حافّة الثوب، وجدار داخلي ملاصق
    for (rr, zz) in ((1.1, collar_z - 0.022), (1.0, collar_z + 0.028), (0.95, collar_z + 0.029), (0.95, collar_z - 0.009)):
        P.append([ncx + nrx * rr * px, ncy + nry * rr * py, zz])
grid_object('Collar', np.array(P), cseg, 4, cloth,
            lambda i, j: {'neck_01': 0.55, 'spine_03': 0.45}, close_u=True, flip=True)

# شقّ الأزرار على منتصف الصدر، والأزرار، والجيب
front_y = {}
for v in thobe_P:
    if abs(v[0]) < 0.02:
        zi = round(v[2], 2)
        front_y[zi] = min(front_y.get(zi, 9), v[1])


def front_at(zz):
    ks = sorted(front_y)
    k = min(ks, key=lambda q: abs(q - zz))
    return front_y[k]


plk_mat = material('placket', tuple(min(255, c + 3) for c in C['thobe']), rough=0.9, double=True)
P = []
nz = 12
for i in range(2):
    for jz in range(nz):
        zz = collar_z - 0.002 - jz * 0.19 / (nz - 1)
        P.append([(-0.016 if i == 0 else 0.016), front_at(zz) - 0.0035, zz])
grid_object('Placket', np.array(P), 2, nz, plk_mat,
            lambda i, j: {'spine_03': 1 - j / (nz - 1), 'spine_02': j / (nz - 1)})
btn_mat = material('button', (215, 196, 150), rough=0.35, metal=0.5)
for n_, zz in enumerate([collar_z - 0.03 - k * 0.033 for k in range(5)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0055, depth=0.003, location=(0.0, front_at(zz) - 0.0055, zz), rotation=(math.pi / 2, 0, 0))
    b = bpy.context.active_object
    b.name = f'Button{n_}'
    b.data.materials.append(btn_mat)
    g = b.vertex_groups.new(name='spine_03')
    g.add(list(range(len(b.data.vertices))), 1.0, 'REPLACE')

# جيب الصدر (على يسار الشخصية كما في الصورة المرجعية)، يتبع انحناء الصدر
def surface_y(xx, zz):
    m = (np.abs(thobe_P[:, 0] - xx) < 0.02) & (np.abs(thobe_P[:, 2] - zz) < 0.02)
    return float(thobe_P[m][:, 1].min()) if m.any() else front_at(zz)


pocket = []
nx_, nz_ = 6, 6
for ix in range(nx_):
    xx = 0.075 + 0.085 * ix / (nx_ - 1)
    for iz in range(nz_):
        zz = collar_z - 0.085 - 0.11 * iz / (nz_ - 1)
        pocket.append([xx, surface_y(xx, zz) - 0.0035, zz])
grid_object('Pocket', np.array(pocket), nx_, nz_, cloth, lambda i, j: {'spine_03': 0.6, 'spine_02': 0.4}, flip=True)
# الأساور عند المعصمين
for side_, wrist, elbow_name, bone in (('L', wristL, 'joint-l-elbow', 'lowerarm_l'), ('R', wristR, 'joint-r-elbow', 'lowerarm_r')):
    elbow = J(elbow_name)
    axis = (wrist - elbow) / np.linalg.norm(wrist - elbow)
    tmp = np.array([0, 0, 1.0]) if abs(axis[2]) < 0.9 else np.array([1.0, 0, 0])
    u_ = np.cross(axis, tmp)
    u_ /= np.linalg.norm(u_)
    w_ = np.cross(axis, u_)
    P = []
    for i in range(28):
        th = 2 * math.pi * i / 28
        d = math.cos(th) * u_ + math.sin(th) * w_
        for (rr, t_) in ((0.047, -0.05), (0.047, 0.004), (0.035, 0.006), (0.035, -0.045)):
            P.append(wrist + axis * t_ + d * rr)
    grid_object(f'Cuff{side_}', np.array(P), 28, 4, cloth, lambda i, j: {bone: 1.0}, close_u=True, flip=True)

# ---------------------------------------------------------------------------
# 8) الغترة والعقال (مقاسة على شكل الرأس الفعلي)
# ---------------------------------------------------------------------------
ghutra = material('ghutra', C['ghutra'], rough=0.88, double=True, spec=0.3)
egal_mat = material('egal', C['egal'], rough=0.55)
hx, hy = head_axis
yb = head_c[1]  # +y = خلف
head_verts = np.array([i for i in body_idx if dom[i] == 'head'])
HP = VB[head_verts]
h_ang = np.arctan2(HP[:, 0] - hx, HP[:, 1] - hy)  # 0 = الخلف (+y)
h_rad = np.hypot(HP[:, 0] - hx, HP[:, 1] - hy)


def head_radius_at(theta, zz, band=0.02, sector=math.radians(9)):
    """أكبر نصف قطر للرأس في قطاع زاوي عند ارتفاع zz (ينزلق للأعلى إن خلا القطاع)."""
    dth = np.abs((h_ang - theta + math.pi) % (2 * math.pi) - math.pi)
    for extra in (0.0, 0.015, 0.03, 0.05):
        m = (dth < sector) & (np.abs(HP[:, 2] - zz + extra) < band)
        if m.any():
            return float(h_rad[m].max())
    return float(head_r)


def cap_line(yy):
    # خطّ العقال: عند منبت الشعر من الأمام، يميل للأسفل قليلًا نحو الخلف
    return brow_z + 0.046 - 0.15 * (yy - yb)


z0 = cap_line(yb)
cap_sel = np.zeros(N, bool)
for i in body_idx:
    if dom[i] == 'head' and z[i] > cap_line(y[i]) - 0.02:
        cap_sel[i] = True
cap_ob, cap_used, cap_P, cap_faces = body_subset(lambda vi: all(cap_sel[v] for v in vi), 'GhutraCap', ghutra,
                                                 offset_fn=lambda g, P: np.full(len(P), 0.012), smooth_iters=4, keep_uv=False)

# السدل: من خطّ العقال إلى الكتفين والصدر، يلامس الجسم ولا ينفرج عنه
nth, nt = 64, 22
shoulder_z = (shoulderL[2] + shoulderR[2]) / 2
th_max = math.radians(136)
torso_pts = np.vstack([thobe_P, VB[[i for i in body_idx if dom[i] in ('clavicle_l', 'clavicle_r', 'spine_03', 'neck_01')]]])
t_ang = np.arctan2(torso_pts[:, 0] - hx, torso_pts[:, 1] - hy)
t_rad = np.hypot(torso_pts[:, 0] - hx, torso_pts[:, 1] - hy)


def body_radius_at(theta, zz, band=0.02, sector=math.radians(10)):
    dth = np.abs((t_ang - theta + math.pi) % (2 * math.pi) - math.pi)
    m = (dth < sector) & (np.abs(torso_pts[:, 2] - zz) < band)
    return float(t_rad[m].max()) if m.any() else 0.0


def smooth1d(a, w=5):
    k = np.ones(w) / w
    pad = np.pad(a, (w // 2, w // 2), mode='edge')
    return np.convolve(pad, k, mode='valid')


shoulder_tip = max(abs(shoulderL[0]), abs(shoulderR[0])) + 0.055
thetas = []
for i in range(nth):
    u = i / (nth - 1)
    # الحافّة الأمامية تميل نحو منتصف الصدر كلّما نزلت (طرفا الغترة على الصدر)
    thetas.append(-th_max + 2 * th_max * u)
R_top = np.array([head_radius_at(th, z0 - 0.01) + 0.013 for th in thetas])
# نقطة القاع لكل زاوية: الظهر (ينسدل خلف الكتفين)، الجانبان (على الكتفين)، الأمام (على الصدر)
R_bot, Z_bot = [], []
for th in thetas:
    a_ = abs(th)
    w_side = math.exp(-((a_ - math.radians(88)) / math.radians(30)) ** 2)
    w_front = smoothstep(math.radians(112), math.radians(136), a_)
    w_back = max(0.0, 1 - w_side - w_front)
    rb_back = body_radius_at(0.0, shoulder_z - 0.1) + 0.014
    rb_front = body_radius_at(th, shoulder_z - 0.12) + 0.014
    rb_side = body_radius_at(th, shoulder_z - 0.08) + 0.016
    R_bot.append(w_back * rb_back + w_side * rb_side + w_front * rb_front)
    Z_bot.append(w_back * (shoulder_z - 0.1) + w_side * (shoulder_z - 0.09) + w_front * (shoulder_z - 0.17))
R_bot, Z_bot = smooth1d(np.array(R_bot), 15), smooth1d(np.array(Z_bot), 15)
Z_bot = Z_bot + 0.004 * np.sin(np.array(thetas) * 9.0)
grid = np.zeros((nth, nt, 3))
for i, th in enumerate(thetas):
    dx, dy = math.sin(th), math.cos(th)
    for jt in range(nt):
        t = jt / (nt - 1)
        zz = z0 - t * (z0 - Z_bot[i])
        rr = R_top[i] + (R_bot[i] - R_top[i]) * smoothstep(0.3, 1.0, t)
        # طيّات عمودية خفيفة تزداد نحو الحاشية، وتموّج ناعم في الحاشية
        rr += (0.0025 * math.sin(th * 7.0 + 0.8) + 0.0015 * math.sin(th * 11.0)) * smoothstep(0.25, 0.9, t)
        rr = max(rr, head_radius_at(th, zz) + 0.012)
        rb = body_radius_at(th, zz)
        if rb > 0 and t > 0.3:
            rr = max(rr, rb + 0.012)
        grid[i, jt] = [rr, 0, zz]
# تنعيم نصف القطر على طول الزاوية لكل حلقة (يزيل تعرّج أخذ العيّنات)
for jt in range(nt):
    grid[:, jt, 0] = smooth1d(grid[:, jt, 0], 5)
P = []
for i, th in enumerate(thetas):
    dx, dy = math.sin(th), math.cos(th)
    for jt in range(nt):
        rr, _, zz = grid[i, jt]
        P.append([hx + rr * dx, hy + rr * dy, zz])


def drape_groups(i, j):
    t = j / (nt - 1)
    h = 1 - smoothstep(0.45, 0.95, t)
    return {'head': float(h), 'spine_03': float(1 - h)}


# الغترة كقماش فعلي: نبدأ من الشكل المفصَّل أعلاه (قريب من الجسم) ونحاكي سقوطه
# بالجاذبية مع تصادم الرأس والكتفين والثوب، فتتكوّن الطيّات الطبيعية.
drape_ob = grid_object('GhutraDrape', np.array(P), nth, nt, ghutra, drape_groups)
if not A.sim:
    drape_ob.data.polygons.foreach_set('use_smooth', [True] * len(drape_ob.data.polygons))
if A.sim:
  pin = drape_ob.vertex_groups.new(name='Pin')
  for i in range(nth):
      for jt in range(nt):
          t = jt / (nt - 1)
          w = 1.0 if t < 0.12 else (0.0 if t > 0.3 else 1 - (t - 0.12) / 0.18)
          if w > 0:
              pin.add([i * nt + jt], float(w), 'REPLACE')
  for ob in (body_ob, thobe_ob, cap_ob) + tuple(o for o in bpy.data.objects if o.name.startswith('Collar')):
      ob.modifiers.new('Collision', 'COLLISION')
      ob.collision.thickness_outer = 0.003
      ob.collision.thickness_inner = 0.003
      ob.collision.cloth_friction = 12.0
  cm = drape_ob.modifiers.new('Cloth', 'CLOTH')
  st = cm.settings
  st.quality = 8
  st.mass = 0.2
  st.tension_stiffness = 10.0
  st.compression_stiffness = 10.0
  st.shear_stiffness = 3.0
  st.bending_stiffness = 0.9
  st.tension_damping = 6.0
  st.compression_damping = 6.0
  st.shear_damping = 6.0
  st.bending_damping = 0.5
  st.air_damping = 1.0
  st.vertex_group_mass = 'Pin'
  st.pin_stiffness = 1.0
  cs = cm.collision_settings
  cs.use_collision = True
  cs.distance_min = 0.006
  cs.collision_quality = 3
  cs.use_self_collision = False
  cs.self_distance_min = 0.005
  cs.friction = 10.0
  scene.frame_start = 1
  scene.frame_end = 110
  for f in range(1, 111):
      scene.frame_set(f)
  dg = bpy.context.evaluated_depsgraph_get()
  sim_mesh = bpy.data.meshes.new_from_object(drape_ob.evaluated_get(dg))
  sim_mesh.polygons.foreach_set('use_smooth', [True] * len(sim_mesh.polygons))
  sim_ob = bpy.data.objects.new('GhutraDrape', sim_mesh)
  scene.collection.objects.link(sim_ob)
  sim_mesh.materials.append(ghutra)
  for i in range(nth):
      for jt in range(nt):
          for bone, w in drape_groups(i, jt).items():
              if w > 0:
                  g = sim_ob.vertex_groups.get(bone) or sim_ob.vertex_groups.new(name=bone)
                  g.add([i * nt + jt], float(w), 'REPLACE')
  for ob in (body_ob, thobe_ob, cap_ob) + tuple(o for o in bpy.data.objects if o.name.startswith('Collar')):
      ob.modifiers.remove(ob.modifiers['Collision'])
  bpy.data.objects.remove(drape_ob, do_unlink=True)
  scene.frame_set(1)

# الطيّة الأمامية السميكة فوق الجبهة (الطيّة القطرية)
P = []
nf = 40
for i in range(nf):
    th = th_max + (2 * math.pi - 2 * th_max) * i / (nf - 1)
    dx, dy = math.sin(th), math.cos(th)
    zc = cap_line(hy + 0.09 * dy)
    r0 = head_radius_at(th, zc)
    for (dr, dz) in ((0.012, -0.012), (0.016, -0.006), (0.016, 0.012), (0.012, 0.02)):
        rr = r0 + dr
        P.append([hx + rr * dx, hy + rr * dy, zc + dz])
grid_object('GhutraFold', np.array(P), nf, 4, ghutra, lambda i, j: {'head': 1.0})

# العقال: حلقتان تتبعان محيط الرأس المغطّى
for k, dz in enumerate((0.03, 0.052)):
    nth_e, nc = 64, 12
    P = []
    for i in range(nth_e):
        th = 2 * math.pi * i / nth_e
        dx, dy = math.sin(th), math.cos(th)
        zc = cap_line(hy + 0.09 * dy) + dz
        rr = head_radius_at(th, zc) + 0.012 + 0.011
        c = np.array([hx + rr * dx, hy + rr * dy, zc])
        radial = np.array([dx, dy, 0.0])
        for jc in range(nc):
            ph = 2 * math.pi * jc / nc
            P.append(c + 0.0115 * (math.cos(ph) * radial + math.sin(ph) * np.array([0, 0, 1.0])))
    grid_object(f'Egal{k}', np.array(P), nth_e, nc, egal_mat, lambda i, j: {'head': 1.0}, close_u=True)
# ذيلا العقال من الخلف
for sx in (-1, 1):
    rb = head_radius_at(0.0, z0) + 0.024
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=0.22, location=(hx + sx * 0.02, hy + rb, z0 - 0.09), rotation=(0, 0, 0))
    c_ = bpy.context.active_object
    c_.name = f'EgalTail{sx}'
    c_.data.materials.append(egal_mat)
    g = c_.vertex_groups.new(name='head')
    g.add(list(range(len(c_.data.vertices))), 1.0, 'REPLACE')

# ---------------------------------------------------------------------------
# 9) الهيكل
# ---------------------------------------------------------------------------
arm_data = bpy.data.armatures.new('SignerRig')
arm_ob = bpy.data.objects.new('SignerRig', arm_data)
scene.collection.objects.link(arm_ob)
bpy.context.view_layer.objects.active = arm_ob
bpy.ops.object.mode_set(mode='EDIT')
pending = dict(rig)
pending['eye_l'] = {'head': eyeL, 'tail': eyeL + np.array([0, -0.025, 0]), 'parent': 'head', 'roll': 0.0}
pending['eye_r'] = {'head': eyeR, 'tail': eyeR + np.array([0, -0.025, 0]), 'parent': 'head', 'roll': 0.0}
bone_pos = {}
done = set()
while pending:
    progressed = False
    for name in list(pending):
        spec = pending[name]
        parent = spec.get('parent', '')
        if parent and parent not in done:
            continue
        eb = arm_data.edit_bones.new(name)
        h = bone_point(spec['head']) if isinstance(spec['head'], dict) else spec['head']
        t = bone_point(spec['tail']) if isinstance(spec['tail'], dict) else spec['tail']
        if np.linalg.norm(t - h) < 0.005:
            t = h + np.array([0, 0, 0.01])
        eb.head, eb.tail = Vector(h), Vector(t)
        eb.roll = float(spec.get('roll', 0.0))
        if parent:
            eb.parent = arm_data.edit_bones[parent]
        bone_pos[name] = (h.tolist(), t.tolist())
        done.add(name)
        del pending[name]
        progressed = True
    if not progressed:
        raise RuntimeError('rig parents unresolved: ' + ', '.join(pending))
bpy.ops.object.mode_set(mode='OBJECT')

for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.parent = arm_ob
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm_ob

# ---------------------------------------------------------------------------
# 10) التصدير + بيانات المرجع
# ---------------------------------------------------------------------------
if A.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(A.blend))

glb = os.path.join(OUT, 'signer.glb')
kw = dict(filepath=glb, export_format='GLB', export_apply=False, export_morph=True, export_morph_normal=False,
          export_skins=True, export_animations=False, export_yup=True, export_image_format='AUTO',
          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_def_bones=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_rest_position_armature=True, export_try_sparse_sk=True)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)


def gl(p):
    """Blender (x,y,z) → glTF (x, z, -y)."""
    p = np.asarray(p, dtype=float)
    return [round(float(p[0]), 4), round(float(p[2]), 4), round(float(-p[1]), 4)]


def hand_landmarks(side):
    s = 'l' if side == 'L' else 'r'
    out = [gl(J(f'joint-{s}-hand'))]
    for f in range(1, 6):
        for k in range(1, 5):
            out.append(gl(J(f'joint-{s}-finger-{f}-{k}')))
    return out


chest_pts = VB[[i for i in body_idx if abs(z[i] - (shoulderL[2] - 0.12)) < 0.02 and dom[i] in ('spine_02', 'spine_03')]]
meta = {
    'version': 1,
    'units': 'm',
    'front': '+z',
    'pose': {  # معالم MediaPipe Pose المقابلة (الجزء العلوي)
        '11': gl(shoulderL), '12': gl(shoulderR),
        '13': gl(J('joint-l-elbow')), '14': gl(J('joint-r-elbow')),
        '15': gl(wristL), '16': gl(wristR),
    },
    'hands': {'L': hand_landmarks('L'), 'R': hand_landmarks('R')},
    'head': {'center': gl(head_c), 'top': gl(J('joint-head-2')), 'neck': gl(neck_c), 'mouth': gl(mouth_c),
             'eyeL': gl(eyeL), 'eyeR': gl(eyeR), 'radius': round(float(head_r), 4)},
    'torso': {'halfWidth': round(float(chest_pts[:, 0].max()) + 0.013, 4) if len(chest_pts) else 0.2,
              'halfDepth': round(float((chest_pts[:, 1].max() - chest_pts[:, 1].min()) / 2) + 0.013, 4) if len(chest_pts) else 0.13,
              'hipZ': round(float(hip_z), 4)},
    'bones': {
        'spine': ['spine_01', 'spine_02', 'spine_03'], 'neck': 'neck_01', 'head': 'head',
        'eyes': ['eye_l', 'eye_r'],
        'L': {'clavicle': 'clavicle_l', 'upper': 'upperarm_l', 'fore': 'lowerarm_l', 'hand': 'hand_l',
              'fingers': [[f'{n}_0{k}_l' for k in (1, 2, 3)] for n in ('thumb', 'index', 'middle', 'ring', 'pinky')]},
        'R': {'clavicle': 'clavicle_r', 'upper': 'upperarm_r', 'fore': 'lowerarm_r', 'hand': 'hand_r',
              'fingers': [[f'{n}_0{k}_r' for k in (1, 2, 3)] for n in ('thumb', 'index', 'middle', 'ring', 'pinky')]},
    },
    'boneRest': {k: {'head': gl(v[0]), 'tail': gl(v[1])} for k, v in bone_pos.items()},
    'face': FACE_ORDER,
}
with open(os.path.join(OUT, 'signer.json'), 'w', encoding='utf8') as f:
    json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
print('✅ signer.glb', round(os.path.getsize(glb) / 1e6, 2), 'MB;', len(bpy.data.objects), 'objects')
