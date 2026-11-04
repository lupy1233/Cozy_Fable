import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { PerspectiveCamera, Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseCameraRig, PieceCameraRig, RoomCameraRig } from './stable-orbit-camera';

const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@react-three/fiber', () => ({ useThree: (selector: (state: Record<string, unknown>) => unknown) => selector(store.current) }));

function makeControls() {
  return { target: new Vector3(), minDistance: 0, maxDistance: Infinity, update: vi.fn() };
}

let camera: PerspectiveCamera;
let controls: ReturnType<typeof makeControls>;

function orbit() {
  camera.position.set(-7, 4, 2);
  controls.target.set(0.7, 0.8, -0.4);
  camera.lookAt(controls.target);
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: controls.target.toArray() };
}

function expectPose(pose: ReturnType<typeof orbit>) {
  expect(camera.position.toArray()).toEqual(pose.position);
  expect(camera.quaternion.toArray()).toEqual(pose.quaternion);
  expect(controls.target.toArray()).toEqual(pose.target);
}

beforeEach(() => {
  camera = new PerspectiveCamera(32, 1.5, 0.05, 200);
  controls = makeControls();
  store.current = { camera, controls, size: { width: 900, height: 600 }, invalidate: vi.fn() };
});

describe('camera ownership after initial framing', () => {
  it('frames once in StrictMode and keeps the pose through dimension, layout and content rerenders', () => {
    const view = render(<StrictMode><PieceCameraRig width={1} height={2} depth={0.6} /></StrictMode>);
    expect(controls.update).toHaveBeenCalledTimes(1);
    const pose = orbit();
    store.current.size = { width: 320, height: 600 };
    view.rerender(<StrictMode><PieceCameraRig width={3} height={1} depth={1.5} /></StrictMode>);
    expectPose(pose);
    view.rerender(<StrictMode><PieceCameraRig width={3} height={1} depth={1.5} /></StrictMode>);
    expectPose(pose);
    expect(controls.update).toHaveBeenCalledTimes(1);
  });

  it('waits for usable viewport and orbit controls before framing', () => {
    store.current.controls = null;
    store.current.size = { width: 0, height: 0 };
    const view = render(<PieceCameraRig width={1} height={2} depth={0.6} />);
    expect(camera.position.toArray()).toEqual([0, 0, 0]);
    store.current.controls = controls;
    view.rerender(<PieceCameraRig width={1} height={2} depth={0.6} />);
    expect(controls.update).not.toHaveBeenCalled();
    store.current.size = { width: 900, height: 600 };
    view.rerender(<PieceCameraRig width={1} height={2} depth={0.6} />);
    expect(controls.update).toHaveBeenCalledTimes(1);
    expect(controls.target.toArray()).toEqual([0, 1, 0]);
  });

  it('preserves zoom when the edited dimensions suggest tighter limits', () => {
    const view = render(<PieceCameraRig width={6} height={2.8} depth={1} />);
    const farthest = controls.maxDistance;
    camera.position.set(0, 1, farthest - 1);
    const position = camera.position.toArray();
    view.rerender(<PieceCameraRig width={0.5} height={0.5} depth={0.5} />);
    expect(camera.position.toArray()).toEqual(position);
    expect(controls.maxDistance).toBeGreaterThanOrEqual(farthest);
    const nearest = controls.minDistance;
    camera.position.copy(controls.target).add(new Vector3(0, 0, nearest));
    view.rerender(<PieceCameraRig width={6} height={2.8} depth={1} />);
    expect(controls.minDistance).toBeLessThanOrEqual(nearest);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(nearest);
  });

  it('keeps room orbit through edits and initializes a different room', () => {
    const view = render(<RoomCameraRig w={4} d={3} sceneId="one" />);
    const pose = orbit();
    view.rerender(<RoomCameraRig w={6} d={5} sceneId="one" />);
    expectPose(pose);
    view.rerender(<RoomCameraRig w={6} d={5} sceneId="two" />);
    expect(controls.target.toArray()).toEqual([0, 0.5, 0]);
    expect(camera.position.toArray()).not.toEqual(pose.position);
  });

  it('keeps the house orbit and pan when the house bounds or center changes', () => {
    const view = render(<HouseCameraRig size={5} cx={0} cz={0} />);
    const pose = orbit();
    view.rerender(<HouseCameraRig size={9} cx={4} cz={-2} height={4.2} />);
    expectPose(pose);
  });

  it.each([{ width: 1440, height: 900 }, { width: 390, height: 700 }])('fits every full-height house corner with padding in $width by $height', (viewport) => {
    store.current.size = viewport;
    camera.fov = 42;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    const view = render(<HouseCameraRig size={12} cx={3} cz={-2} width={12.18} depth={4.18} height={4.2} />);
    camera.updateMatrixWorld();
    for (const x of [3 - 6.09, 3 + 6.09]) for (const y of [-0.12, 4.2]) for (const z of [-2 - 2.09, -2 + 2.09]) {
      const projected = new Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.801);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.801);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
    const pose = orbit();
    view.rerender(<HouseCameraRig size={16} cx={-3} cz={1} width={16} depth={8} height={5} />);
    expectPose(pose);
  });

  it('starts farther out in portrait rooms while preserving the user pose on later viewport changes', () => {
    const desktop = render(<RoomCameraRig w={4} d={3} sceneId="one" />);
    const desktopDistance = camera.position.distanceTo(controls.target);
    desktop.unmount();
    store.current.size = { width: 390, height: 700 };
    const mobile = render(<RoomCameraRig w={4} d={3} sceneId="one" />);
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThan(desktopDistance * 1.5);
    expect(controls.maxDistance).toBeGreaterThan(camera.position.distanceTo(controls.target));
    const pose = orbit();
    store.current.size = { width: 900, height: 600 };
    mobile.rerender(<RoomCameraRig w={4} d={3} sceneId="one" />);
    expectPose(pose);
  });

  it('preserves the target if orbit controls are replaced on the same camera', () => {
    const view = render(<RoomCameraRig w={4} d={3} sceneId="one" />);
    const pose = orbit();
    controls = makeControls();
    store.current.controls = controls;
    view.rerender(<RoomCameraRig w={4} d={3} sceneId="one" />);
    expectPose(pose);
    expect(controls.update).not.toHaveBeenCalled();
  });
});
