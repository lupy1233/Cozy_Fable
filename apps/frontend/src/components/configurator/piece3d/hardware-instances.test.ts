import type { Panel3d } from '@marketplace/shared';
import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { splitHardwarePanels, syncHardwareInstances } from './hardware-instances';

function scene() {
  const root = new Group();
  const piece = new Group();
  piece.position.set(1, 2, 3);
  piece.rotation.y = 0.4;
  root.add(piece);
  const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 8);
  piece.add(mesh);
  const door = new Group();
  door.position.set(0.5, 0, 0.2);
  door.rotation.y = 1.2;
  piece.add(door);
  const proxy = new Object3D();
  proxy.position.set(-0.2, 0.1, 0.009);
  proxy.rotation.z = Math.PI / 2;
  proxy.scale.set(0.58, 1, 1);
  door.add(proxy);
  return { root, piece, mesh, door, proxy };
}

// instanceMatrix e Float32: comparam la 6 zecimale
const round = (m: Matrix4) => m.elements.map((v) => +v.toFixed(6));

describe('syncHardwareInstances', () => {
  it('writes each proxy world transform relative to the mesh parent, without waiting for a render', () => {
    const { root, piece, mesh, proxy } = scene();
    const version = mesh.instanceMatrix.version;
    expect(syncHardwareInstances(mesh, [proxy], 8)).toBe(1);
    expect(mesh.count).toBe(1);
    // needsUpdate nu are getter in three: setarea lui incrementeaza version
    expect(mesh.instanceMatrix.version).toBe(version + 1);
    const written = new Matrix4();
    mesh.getMatrixAt(0, written);
    root.updateMatrixWorld(true);
    const expected = new Matrix4().copy(piece.matrixWorld).invert().multiply(proxy.matrixWorld);
    expect(round(written)).toEqual(round(expected));
    const world = new Vector3().setFromMatrixPosition(new Matrix4().multiplyMatrices(piece.matrixWorld, written));
    expect(world.distanceTo(proxy.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
  });

  it('follows the door after it rotates', () => {
    const { mesh, door, proxy } = scene();
    syncHardwareInstances(mesh, [proxy], 8);
    const before = new Matrix4();
    mesh.getMatrixAt(0, before);
    door.rotation.y = -1.0;
    syncHardwareInstances(mesh, [proxy], 8);
    const after = new Matrix4();
    mesh.getMatrixAt(0, after);
    expect(round(after)).not.toEqual(round(before));
    const world = new Vector3().setFromMatrixPosition(new Matrix4().multiplyMatrices(mesh.parent!.matrixWorld, after));
    expect(world.distanceTo(proxy.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
  });

  it('caps the instance count at the mesh capacity', () => {
    const { mesh, door } = scene();
    const proxies = Array.from({ length: 12 }, (_, i) => {
      const p = new Object3D();
      p.position.x = i;
      door.add(p);
      return p;
    });
    expect(syncHardwareInstances(mesh, proxies, 8)).toBe(8);
    expect(mesh.count).toBe(8);
  });
});

describe('splitHardwarePanels', () => {
  const asset = { id: 'HANDLE_BAR' as const, node: 'handle_bar_160', mount: [0, 0, 0.0095] as [number, number, number] };
  const panels: Panel3d[] = [
    { role: 'FURNITURE', x: 0, y: 0, z: 0, w: 0.1, h: 0.01, d: 0.01 },
    { role: 'FURNITURE', x: 0, y: 0, z: 0.014, w: 0.18, h: 0.012, d: 0.012, asset, assetFallback: asset.node },
    { role: 'FURNITURE', x: -0.08, y: 0, z: 0.007, w: 0.008, h: 0.008, d: 0.014, assetFallback: asset.node },
    { role: 'FURNITURE', x: 0.08, y: 0, z: 0.007, w: 0.008, h: 0.008, d: 0.014, assetFallback: asset.node },
  ];

  it('draws every primitive while the node is not loaded', () => {
    const { primitives, anchors } = splitHardwarePanels(panels, () => false);
    expect(primitives).toHaveLength(4);
    expect(anchors).toEqual([]);
  });

  it('swaps the fallback primitives for the anchor once the node is loaded', () => {
    const { primitives, anchors } = splitHardwarePanels(panels, (node) => node === asset.node);
    expect(primitives).toHaveLength(1);
    expect(anchors).toEqual([asset]);
  });
});
