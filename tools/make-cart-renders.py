# Redari pentru cosul cererii: canapea, fotoliu, taburet tapitat.
#
# Folosire (Blender 5.x, fara interfata):
#   blender -b --factory-startup -P tools/make-cart-renders.py -- apps/frontend/public/illustrations/pieces [sofa armchair ottoman]
#
# Stilul urmeaza atlasele "showroom" (apps/frontend/public/illustrations/showroom-*.png):
# piesa vazuta din fata-dreapta, usor de sus, pe fundal alb curat, cu umbra moale spre
# dreapta; tapiterie crem + baza de stejar. Fundalul e alb exact (255), ca imaginea sa
# se topeasca in cartonas prin mix-blend-multiply.
#
# Redarea merge pe placa video (Cycles, CUDA / OptiX). Daca nu gaseste niciuna, scriptul
# spune asta in consola si reda pe procesor.

import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_DIR = os.path.abspath(argv[0]) if argv else os.path.abspath('cart-renders')
ONLY = set(argv[1:])
SAMPLES = int(os.environ.get('CART_RENDER_SAMPLES', '384'))
os.makedirs(OUT_DIR, exist_ok=True)


def srgb(hex_color):
    """#rrggbb (sRGB) -> RGBA liniar, cum cere Blender."""
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels] + [1.0]


# ---------------------------------------------------------------- materiale

def new_material(name):
    material = bpy.data.materials.new(name)
    if material.node_tree is None:
        material.use_nodes = True
    return material, material.node_tree.nodes, material.node_tree.links


def fabric_material():
    material, nodes, links = new_material('Tapiterie crem')
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.92
    bsdf.inputs['Sheen Weight'].default_value = 0.35
    bsdf.inputs['Sheen Roughness'].default_value = 0.45

    coords = nodes.new('ShaderNodeTexCoord')
    # tesatura: zgomot fin (firul) + unul lat (cute abia vizibile)
    weave = nodes.new('ShaderNodeTexNoise')
    weave.inputs['Scale'].default_value = 260
    weave.inputs['Detail'].default_value = 3
    soft = nodes.new('ShaderNodeTexNoise')
    soft.inputs['Scale'].default_value = 5
    soft.inputs['Detail'].default_value = 1
    links.new(coords.outputs['Object'], weave.inputs['Vector'])
    links.new(coords.outputs['Object'], soft.inputs['Vector'])

    tone = nodes.new('ShaderNodeMix')
    tone.data_type = 'RGBA'
    tone.inputs['A'].default_value = srgb('#f0ebe2')
    tone.inputs['B'].default_value = srgb('#e4ddd0')
    links.new(weave.outputs['Fac'], tone.inputs['Factor'])
    links.new(tone.outputs['Result'], bsdf.inputs['Base Color'])

    bump_soft = nodes.new('ShaderNodeBump')
    bump_soft.inputs['Strength'].default_value = 0.05
    bump_soft.inputs['Distance'].default_value = 0.02
    links.new(soft.outputs['Fac'], bump_soft.inputs['Height'])
    bump_weave = nodes.new('ShaderNodeBump')
    bump_weave.inputs['Strength'].default_value = 0.45
    bump_weave.inputs['Distance'].default_value = 0.004
    links.new(weave.outputs['Fac'], bump_weave.inputs['Height'])
    links.new(bump_soft.outputs['Normal'], bump_weave.inputs['Normal'])
    links.new(bump_weave.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def oak_material():
    material, nodes, links = new_material('Stejar')
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.5

    coords = nodes.new('ShaderNodeTexCoord')
    stretch = nodes.new('ShaderNodeMapping')
    # fibra merge pe lungimea piesei (X)
    stretch.inputs['Scale'].default_value = (1.2, 22, 22)
    grain = nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 3.5
    grain.inputs['Detail'].default_value = 6
    links.new(coords.outputs['Object'], stretch.inputs['Vector'])
    links.new(stretch.outputs['Vector'], grain.inputs['Vector'])

    tone = nodes.new('ShaderNodeMix')
    tone.data_type = 'RGBA'
    tone.inputs['A'].default_value = srgb('#e9c28d')
    tone.inputs['B'].default_value = srgb('#d6a96f')
    links.new(grain.outputs['Fac'], tone.inputs['Factor'])
    links.new(tone.outputs['Result'], bsdf.inputs['Base Color'])
    return material


# ---------------------------------------------------------------- geometrie

GRID = 22        # taieturi pe muchie
ROUND_ROWS = 6   # randuri de varfuri pastrate pentru rotunjire, la fiecare capat


def soft_box(name, size, center, radius, material, puff=(0.0, 0.0, 0.0), tilt=(0.0, 0.0, 0.0)):
    """Cutie cu muchii rotunjite si fete usor bombate (perna, brat, corp tapitat).

    size / center in metri; `puff` = cat iese mijlocul fiecarei perechi de fete.
    Varfurile se ingramadesc spre muchii, ca rotunjirea sa fie neteda in silueta.
    """
    half = [s / 2 for s in size]
    radius = min(radius, *half)
    last = GRID + 1

    def spread(value, h):
        # value in [-0.5, 0.5] pe grila uniforma -> pozitie cu randuri dese la capete
        index = round((value + 0.5) * last)
        if index <= ROUND_ROWS:
            return -h + radius * index / ROUND_ROWS
        if index >= last - ROUND_ROWS:
            return h - radius * (last - index) / ROUND_ROWS
        flat = (index - ROUND_ROWS) / (last - 2 * ROUND_ROWS)
        return -(h - radius) + 2 * (h - radius) * flat

    mesh_data = bmesh.new()
    bmesh.ops.create_cube(mesh_data, size=1.0)
    bmesh.ops.subdivide_edges(mesh_data, edges=mesh_data.edges[:], cuts=GRID, use_grid_fill=True)
    for vertex in mesh_data.verts:
        point = Vector([spread(vertex.co[axis], half[axis]) for axis in range(3)])
        core = Vector([max(-(half[axis] - radius), min(half[axis] - radius, point[axis])) for axis in range(3)])
        offset = point - core
        if offset.length > 1e-9:
            point = core + offset.normalized() * radius
        u, v, w = (point[axis] / half[axis] for axis in range(3))
        point.x += puff[0] * u * (1 - v * v) * (1 - w * w)
        point.y += puff[1] * v * (1 - u * u) * (1 - w * w)
        point.z += puff[2] * w * (1 - u * u) * (1 - v * v)
        vertex.co = point

    mesh = bpy.data.meshes.new(name)
    mesh_data.to_mesh(mesh)
    mesh_data.free()
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.materials.append(material)
    piece = bpy.data.objects.new(name, mesh)
    piece.location = center
    piece.rotation_euler = Euler(tilt)
    bpy.context.scene.collection.objects.link(piece)
    return piece


def seating(width, depth, seats, fabric, oak):
    """Canapea / fotoliu: baza de stejar, corp, brate, spatar, perne. Fata = -Y."""
    plinth_h, body_top, seat_top = 0.08, 0.28, 0.45
    arm_w, arm_top = 0.19, 0.62
    back_t, back_top = 0.19, 0.78
    inner = width - 2 * arm_w
    # spatarul tine toata latimea; bratele stau in fata lui (silueta curata din lateral)
    arm_d = depth - back_t + 0.05

    soft_box('Baza', (width - 0.07, depth - 0.07, plinth_h + 0.02), (0, 0, (plinth_h + 0.02) / 2), 0.006, oak)
    soft_box('Corp', (inner + 0.06, depth - 0.02, body_top - plinth_h), (0, -0.005, (body_top + plinth_h) / 2), 0.03, fabric)
    for side in (-1, 1):
        soft_box('Brat', (arm_w, arm_d, arm_top - plinth_h), (side * (width - arm_w) / 2, -depth / 2 + arm_d / 2, (arm_top + plinth_h) / 2),
                 0.055, fabric, puff=(0.012, 0.006, 0.014))
    soft_box('Spatar', (width, back_t, back_top - plinth_h), (0, (depth - back_t) / 2, (back_top + plinth_h) / 2),
             0.055, fabric, puff=(0, 0.01, 0.012))

    gap = 0.008
    cushion_w = (inner - gap * (seats - 1)) / seats
    seat_depth = depth - back_t + 0.012
    back_cushion_t, back_cushion_h = 0.17, 0.40
    for index in range(seats):
        x = -inner / 2 + cushion_w / 2 + index * (cushion_w + gap)
        soft_box('Perna sezut', (cushion_w, seat_depth, seat_top - body_top + 0.01),
                 (x, -depth / 2 + seat_depth / 2 - 0.012, (seat_top + body_top) / 2), 0.05, fabric, puff=(0, 0.006, 0.022))
        soft_box('Perna spatar', (cushion_w - 0.004, back_cushion_t, back_cushion_h),
                 (x, depth / 2 - back_t - back_cushion_t / 2 + 0.028, seat_top + back_cushion_h / 2 - 0.012),
                 0.06, fabric, puff=(0.004, 0.03, 0.012), tilt=(math.radians(-9), 0, 0))


def build_sofa(fabric, oak):
    seating(2.24, 0.95, 3, fabric, oak)


def build_armchair(fabric, oak):
    seating(0.98, 0.9, 1, fabric, oak)


def build_ottoman(fabric, oak):
    side, plinth_h, body_top, top = 0.66, 0.06, 0.3, 0.43
    soft_box('Baza', (side - 0.07, side - 0.07, plinth_h + 0.02), (0, 0, (plinth_h + 0.02) / 2), 0.006, oak)
    soft_box('Corp', (side, side, body_top - plinth_h), (0, 0, (body_top + plinth_h) / 2), 0.04, fabric, puff=(0.006, 0.006, 0))
    soft_box('Perna', (side + 0.012, side + 0.012, top - body_top + 0.01), (0, 0, (top + body_top) / 2),
             0.055, fabric, puff=(0.004, 0.004, 0.026))


PIECES = {
    # nume fisier: (constructor, latime px, inaltime px)
    'sofa': (build_sofa, 1200, 800),
    'armchair': (build_armchair, 960, 960),
    'ottoman': (build_ottoman, 1080, 900),
}


# ---------------------------------------------------------------- scena

def use_gpu(scene):
    """Porneste Cycles pe placa video. Intoarce numele dispozitivelor folosite."""
    preferences = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('CUDA', 'OPTIX'):
        try:
            preferences.compute_device_type = backend
        except TypeError:
            continue
        preferences.refresh_devices()
        graphics = [device for device in preferences.devices if device.type == backend]
        if not graphics:
            continue
        for device in preferences.devices:
            device.use = device.type == backend
        scene.cycles.device = 'GPU'
        return backend, [device.name for device in graphics]
    scene.cycles.device = 'CPU'
    return 'CPU', []


def setup_scene(width, height):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    backend, devices = use_gpu(scene)
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'

    world = bpy.data.worlds.new('Lumina ambientala')
    if world.node_tree is None:
        world.use_nodes = True
    scene.world = world
    background = next(node for node in world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (1, 1, 1, 1)
    background.inputs['Strength'].default_value = 0.55
    return scene, backend, devices


def aim(thing, target):
    thing.rotation_euler = (target - thing.location).to_track_quat('-Z', 'Y').to_euler()


def add_light(name, location, target, size, power):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape = 'SQUARE'
    data.size = size
    data.energy = power
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)
    aim(light, target)
    return light


def stage(scene):
    """Podea care prinde doar umbra, lumini si camera incadrata pe piesa."""
    pieces = [thing for thing in scene.collection.objects if thing.type == 'MESH']
    bpy.context.view_layer.update()
    corners = [piece.matrix_world @ Vector(corner) for piece in pieces for corner in piece.bound_box]
    low = Vector([min(corner[axis] for corner in corners) for axis in range(3)])
    high = Vector([max(corner[axis] for corner in corners) for axis in range(3)])
    center = (low + high) / 2
    reach = (high - low).length

    floor_mesh = bpy.data.meshes.new('Podea')
    floor_data = bmesh.new()
    bmesh.ops.create_grid(floor_data, x_segments=1, y_segments=1, size=30)
    floor_data.to_mesh(floor_mesh)
    floor_data.free()
    floor = bpy.data.objects.new('Podea', floor_mesh)
    floor.is_shadow_catcher = True
    scene.collection.objects.link(floor)

    # cheia vine din stanga-fata-sus: umbra cade spre dreapta-spate, ca in atlase
    # si destul de sus cat umbra sa ramana scurta, langa piesa
    add_light('Cheie', center + Vector((-0.6, -0.8, 1.7)) * reach, center, reach * 1.1, 18 * reach * reach)
    add_light('Umplere', center + Vector((1.3, -1.0, 0.55)) * reach, center, reach * 1.4, 5 * reach * reach)

    camera_data = bpy.data.cameras.new('Camera')
    camera_data.lens = 95
    camera = bpy.data.objects.new('Camera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    azimuth, elevation = math.radians(34), math.radians(19)
    direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    camera.location = center + direction * reach * 6
    aim(camera, center)
    bpy.context.view_layer.update()

    flat = [value for corner in corners for value in corner]
    location, _scale = camera.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), flat)
    camera.location = location
    bpy.context.view_layer.update()
    # margine in jurul piesei, cu loc pentru umbra din dreapta
    backwards = camera.matrix_world.to_quaternion() @ Vector((0, 0, 1))
    camera.location = location + backwards * (location - center).length * 0.27
    camera_data.shift_x = 0.02


def flatten_on_white(source, target):
    """PNG cu transparenta -> PNG opac pe alb exact.

    Spre marginile cadrului imaginea se stinge in alb, ca o umbra lunga sa nu se
    termine niciodata intr-o muchie dreapta in cartonas (piesa sta in afara benzii).
    """
    image = bpy.data.images.load(source)
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(height, width, 4)
    band = 0.07 * min(width, height)
    columns = np.arange(width, dtype=np.float32)[None, :]
    rows = np.arange(height, dtype=np.float32)[:, None]
    to_border = np.minimum(np.minimum(columns, width - 1 - columns), np.minimum(rows, height - 1 - rows))
    fade = np.clip(to_border / band, 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    alpha = pixels[:, :, 3:4] * fade[:, :, None]
    flat = np.concatenate([pixels[:, :, :3] * alpha + (1 - alpha), np.ones_like(alpha)], axis=2)
    result = bpy.data.images.new('pe-alb', width, height, alpha=False)
    result.pixels.foreach_set(flat.ravel())
    result.filepath_raw = target
    result.file_format = 'PNG'
    result.save()
    bpy.data.images.remove(image)
    bpy.data.images.remove(result)


for name, (build, width, height) in PIECES.items():
    if ONLY and name not in ONLY:
        continue
    scene, backend, devices = setup_scene(width, height)
    build(fabric_material(), oak_material())
    stage(scene)
    raw = os.path.join(OUT_DIR, f'.{name}-raw.png')
    scene.render.filepath = raw
    started = time.time()
    bpy.ops.render.render(write_still=True)
    final = os.path.join(OUT_DIR, f'{name}.png')
    flatten_on_white(raw, final)
    os.remove(raw)
    print(f'[cart-renders] {name}: {width}x{height}, {SAMPLES} esantioane, {time.time() - started:.1f} s, '
          f'{backend} {devices if devices else "(fara placa video - redat pe procesor)"} -> {final}')
