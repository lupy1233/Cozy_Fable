import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { HARDWARE_ASSET_NODES } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import { DRACO_DECODER_PATH, HARDWARE_ASSET_URL } from './hardware-assets';

// Fisierul GLB generat din Blender (tools/make-handles.py) trebuie sa
// contina exact nodurile pe care shared le ancoreaza, comprimate Draco, iar
// decoderul Draco trebuie servit local. vitest ruleaza din apps/frontend.
const PUBLIC = resolve(process.cwd(), 'public');

function readGlbJson(buffer: Buffer): { nodes?: { name?: string; mesh?: number }[]; meshes?: unknown[]; extensionsRequired?: string[] } {
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buffer.readUInt32LE(4)).toBe(2);
  const length = buffer.readUInt32LE(12);
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8'));
}

describe('hardware.glb', () => {
  const file = `${PUBLIC}${HARDWARE_ASSET_URL}`;

  it('ships every node shared anchors, as Draco-compressed meshes, in a small file', () => {
    expect(existsSync(file)).toBe(true);
    const buffer = readFileSync(file);
    expect(buffer.byteLength).toBeLessThan(64 * 1024);
    const doc = readGlbJson(buffer);
    const names = new Map((doc.nodes ?? []).map((node) => [node.name, node]));
    for (const node of HARDWARE_ASSET_NODES) {
      expect(names.has(node), node).toBe(true);
      expect(names.get(node)?.mesh, `${node} has a mesh`).toBeTypeOf('number');
    }
    expect(doc.extensionsRequired).toContain('KHR_draco_mesh_compression');
  });

  it('serves the Draco decoder from the same origin', () => {
    for (const name of ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js']) {
      const path = `${PUBLIC}${DRACO_DECODER_PATH}${name}`;
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });
});
