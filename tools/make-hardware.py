# Genereaza hardware.glb (feronerie de mobilier) din Blender in fundal:
#   blender -b --python tools/make-hardware.py -- apps/frontend/public/3d/hardware.glb
# Conventie noduri (coordonate three.js: X dreapta, Y sus, Z spre privitor, metri):
#   handle_bar_<cc>  bara rotunda cu doua posturi; origine = punctul de montaj pe
#                    fata frontului (z=0), geometria iese spre +Z; cc = distanta
#                    intre posturi (mm)
#   handle_knob      buton rotund cu gat si talpa, fix
#   handle_shell     maner scoica (cupa) 90mm, deschis in jos, fix
#   handle_profile   profil J pe muchia de sus, lungime 1m, se scaleaza pe X
#   leg_tapered      picior conic canonic 50x120x50mm; origine SUS, in centru,
#                    geometria coboara spre -Y; se scaleaza pe fiecare axa
#   hinge_cup_r/_l   balama cu cupa pe SPATELE usii; origine = centrul cupei pe
#                    spatele usii (z=0), geometria intra spre -Z; bratul si
#                    butucul spre muchia balamalei (+X pentru _r, -X pentru _l)
# Nodurile trebuie sa coincida cu HARDWARE_ASSET_NODES din
# packages/shared/src/questionnaire/piece3d/hardware-assets.ts.
import bpy, bmesh, json, math, os, struct, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'hardware.glb')

BAR_CC_MM = [96, 128, 160, 192, 256, 320]
BAR_OVERHANG = 0.012  # capatul barei dincolo de post, pe fiecare parte


def to_blender(p):
    # three.js (x, y, z) -> Blender (x, -z, y); exportul Y-up il inverseaza exact
    x, y, z = p
    return (x, -z, y)


def axis_point(axis, t, u, v):
    if axis == 'X':
        return (t, u, v)
    if axis == 'Y':
        return (u, t, v)
    return (u, v, t)


def revolve(profile, segments, axis, offset=(0.0, 0.0, 0.0)):
    # profile: lista de (t, r) de-a lungul axei; r = 0 la capete inchide solidul
    verts, faces, rings = [], [], []
    for t, r in profile:
        if r <= 1e-9:
            idx = len(verts)
            verts.append(axis_point(axis, t, 0.0, 0.0))
            rings.append([idx] * segments)
        else:
            ring = []
            for s in range(segments):
                a = 2 * math.pi * s / segments
                ring.append(len(verts))
                verts.append(axis_point(axis, t, r * math.cos(a), r * math.sin(a)))
            rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for s in range(segments):
            s2 = (s + 1) % segments
            face = []
            for q in (a[s], a[s2], b[s2], b[s]):
                if q not in face:
                    face.append(q)
            if len(face) >= 3:
                faces.append(face)
    ox, oy, oz = offset
    return [(x + ox, y + oy, z + oz) for x, y, z in verts], faces


def extrude_polygon(points_yz, length, x_offset=0.0):
    # poligon inchis in planul (y, z), extrudat pe X intre -length/2 si +length/2 (+ x_offset)
    n = len(points_yz)
    verts = [(x_offset - length / 2, y, z) for y, z in points_yz] + [(x_offset + length / 2, y, z) for y, z in points_yz]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return verts, faces


def mirror_x(parts):
    return [([(-x, y, z) for x, y, z in verts], faces, caps) for verts, faces, caps in parts]


def make_object(name, parts):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    cap_faces = []
    for verts, faces, caps in parts:
        bverts = [bm.verts.new(to_blender(v)) for v in verts]
        for fi, f in enumerate(faces):
            try:
                face = bm.faces.new([bverts[i] for i in f])
            except ValueError:
                continue
            if fi in caps:
                cap_faces.append(face)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    cap_faces = [f for f in cap_faces if f.is_valid]
    if cap_faces:
        bmesh.ops.triangulate(bm, faces=cap_faces, ngon_method='EAR_CLIP')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < math.radians(32)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def capsule_profile(length, radius, steps=6):
    prof = [(-length / 2, 0.0)]
    for k in range(1, steps + 1):
        phi = (k / steps) * (math.pi / 2)
        prof.append((-length / 2 + radius - radius * math.cos(phi), radius * math.sin(phi)))
    for k in range(steps - 1, -1, -1):
        phi = (k / steps) * (math.pi / 2)
        prof.append((length / 2 - radius + radius * math.cos(phi), radius * math.sin(phi)))
    return prof


def bar_handle(cc_mm):
    cc = cc_mm / 1000.0
    length = cc + 2 * BAR_OVERHANG
    bar = revolve(capsule_profile(length, 0.006), 20, 'X', offset=(0.0, 0.0, 0.014))
    post_profile = [(0.0, 0.0), (0.0, 0.0048), (0.002, 0.0045), (0.003, 0.004), (0.0125, 0.004), (0.0125, 0.0)]
    posts = [revolve(post_profile, 16, 'Z', offset=(sx * cc / 2, 0.0, 0.0)) for sx in (-1, 1)]
    return [(bar[0], bar[1], set()), (posts[0][0], posts[0][1], set()), (posts[1][0], posts[1][1], set())]


def knob_handle():
    profile = [(0.0, 0.0), (0.0, 0.009), (0.002, 0.009), (0.002, 0.0045), (0.012, 0.0045), (0.013, 0.010),
               (0.016, 0.0145), (0.020, 0.015), (0.025, 0.0135), (0.029, 0.009), (0.0315, 0.004), (0.032, 0.0)]
    verts, faces = revolve(profile, 28, 'Z')
    return [(verts, faces, set())]


def shell_handle():
    R, t, theta_max, n, width = 0.021, 0.0016, 0.78 * math.pi, 18, 0.09
    outer = [(R * math.cos(theta_max * i / n), R * math.sin(theta_max * i / n)) for i in range(n + 1)]
    inner = [((R - t) * math.cos(theta_max * i / n), (R - t) * math.sin(theta_max * i / n)) for i in range(n, -1, -1)]
    verts, faces = extrude_polygon(outer + inner, width)
    return [(verts, faces, {0, 1})]


def profile_handle():
    j = [(0.0, 0.0), (0.0, 0.016), (-0.010, 0.016), (-0.010, 0.0145), (-0.0015, 0.0145), (-0.0015, 0.0015),
         (-0.022, 0.0015), (-0.022, 0.0)]
    verts, faces = extrude_polygon(j, 1.0)
    return [(verts, faces, {0, 1})]


def tapered_leg():
    # 50 x 120 x 50 mm: guler scurt sus, corp conic, talpa cu tesitura (origine sus)
    profile = [(0.0, 0.0), (0.0, 0.025), (-0.006, 0.025), (-0.006, 0.0215), (-0.1, 0.013), (-0.11, 0.0122),
               (-0.118, 0.011), (-0.12, 0.009), (-0.12, 0.0)]
    verts, faces = revolve(profile, 24, 'Y')
    return [(verts, faces, set())]


def cup_hinge_right():
    # cupa Ø35 pe spatele usii (z 0..-4mm), brat spre muchia balamalei (+X), butuc Ø6.4 x 42mm
    cup = revolve([(0.0, 0.0), (0.0, 0.0175), (-0.0035, 0.0175), (-0.0035, 0.0155), (-0.004, 0.0155), (-0.004, 0.0)], 32, 'Z')
    arm = extrude_polygon([(-0.006, -0.004), (0.006, -0.004), (0.006, -0.0105), (-0.006, -0.0105)], 0.024, x_offset=0.012)
    barrel = revolve([(-0.021, 0.0), (-0.021, 0.0032), (0.021, 0.0032), (0.021, 0.0)], 16, 'Y', offset=(0.019, 0.0, -0.0072))
    return [(cup[0], cup[1], set()), (arm[0], arm[1], {0, 1}), (barrel[0], barrel[1], set())]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    for cc in BAR_CC_MM:
        make_object('handle_bar_%03d' % cc, bar_handle(cc))
    make_object('handle_knob', knob_handle())
    make_object('handle_shell', shell_handle())
    make_object('handle_profile', profile_handle())
    make_object('leg_tapered', tapered_leg())
    right = cup_hinge_right()
    make_object('hinge_cup_r', right)
    make_object('hinge_cup_l', mirror_x(right))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    kwargs = dict(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                  export_texcoords=False, export_normals=True, export_materials='NONE',
                  export_cameras=False, export_lights=False, export_animations=False,
                  export_skins=False, export_morph=False, use_selection=False,
                  export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                  export_draco_position_quantization=14, export_draco_normal_quantization=10)
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError as error:
        props = sorted(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
        print('GLTF_EXPORT_TYPEERROR', error)
        print('GLTF_EXPORT_PROPS', ' '.join(props))
        raise

    with open(OUT, 'rb') as fh:
        data = fh.read()
    chunk_len = struct.unpack('<I', data[12:16])[0]
    doc = json.loads(data[20:20 + chunk_len].decode('utf-8'))
    summary = {
        'bytes': len(data),
        'nodes': [n.get('name') for n in doc.get('nodes', [])],
        'extensionsRequired': doc.get('extensionsRequired', []),
        'meshes': len(doc.get('meshes', [])),
        'triangles': {n['name']: len(bpy.data.objects[n['name']].data.polygons) for n in doc.get('nodes', []) if n.get('name') in bpy.data.objects},
    }
    print('HARDWARE_GLB_SUMMARY ' + json.dumps(summary))


main()
