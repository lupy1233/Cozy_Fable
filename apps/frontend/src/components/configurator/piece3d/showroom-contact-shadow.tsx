'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color, Line, Mesh, MeshBasicMaterial, MeshDepthMaterial, OrthographicCamera,
  PlaneGeometry, Points, ShaderMaterial, Vector2, Vector4, WebGLRenderTarget, type Object3D,
} from 'three';

// Captura de adancime + blur separabil, inspirate de ContactShadows (Drei).
// Resursele off-tree sunt detinute aici; fiecare este eliberata explicit.
interface ShowroomContactShadowProps {
  dirtyKey: string;
  animationKey?: string;
  animationWindowMs?: number;
  scale: number;
  far: number;
  y?: number;
  opacity?: number;
  blur?: number;
  resolution?: number;
  color?: string;
}

export function createContactShadowResources(scale: number, far: number, y: number, resolution: number, color: string) {
  const target = new WebGLRenderTarget(resolution, resolution);
  const scratch = new WebGLRenderTarget(resolution, resolution);
  target.texture.generateMipmaps = scratch.texture.generateMipmaps = false;
  const floorGeometry = new PlaneGeometry(scale, scale).rotateX(-Math.PI / 2);
  const uv = floorGeometry.getAttribute('uv');
  // Camera priveste in sus, cu +Z in partea de sus a texturii.
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const floorMaterial = new MeshBasicMaterial({ map: target.texture, transparent: true, depthWrite: false });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.position.y = y;
  const camera = new OrthographicCamera(-scale / 2, scale / 2, scale / 2, -scale / 2, 0, far);
  camera.position.set(0, y, 0);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, y + 1, 0);
  camera.updateMatrixWorld();
  // Suprafata cea mai apropiata de podea determina contactul, indiferent de ordinea mesh-urilor.
  const depth = new MeshDepthMaterial({ depthTest: true, depthWrite: true });
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.shadowTint = { value: new Color(color) };
    shader.fragmentShader = `uniform vec3 shadowTint;\n${shader.fragmentShader}`.replace(
      'vec4( vec3( 1.0 - fragCoordZ ), opacity )',
      'vec4(shadowTint * fragCoordZ * 2.0, 1.0 - fragCoordZ)',
    );
  };
  const blurMaterial = new ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { source: { value: target.texture }, stepUv: { value: new Vector2() } },
    vertexShader: 'varying vec2 sampleUv; void main(){ sampleUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: `uniform sampler2D source; uniform vec2 stepUv; varying vec2 sampleUv;
      void main(){
        vec4 sum=texture2D(source,sampleUv)*0.227027;
        sum+=(texture2D(source,sampleUv+stepUv*1.384615)+texture2D(source,sampleUv-stepUv*1.384615))*0.316216;
        sum+=(texture2D(source,sampleUv+stepUv*3.230769)+texture2D(source,sampleUv-stepUv*3.230769))*0.070270;
        gl_FragColor=sum;
      }`,
  });
  const quadGeometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(quadGeometry, blurMaterial);
  const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  quadCamera.position.z = 1;
  return { target, scratch, floor, floorGeometry, floorMaterial, camera, depth, blurMaterial, quadGeometry, quad, quadCamera };
}

export function ShowroomContactShadow({
  dirtyKey, animationKey = '', animationWindowMs = 800, scale, far, y = -0.008,
  opacity = 0.32, blur = 2.5, resolution = 256, color = '#5c5043',
}: ShowroomContactShadowProps) {
  const { gl, scene, invalidate } = useThree();
  const resources = useMemo(() => createContactShadowResources(scale, far, y, resolution, color), [scale, far, y, resolution, color]);
  const dirty = useRef(true);
  const animateUntil = useRef(0);
  const previousAnimation = useRef(animationKey);
  useEffect(() => {
    dirty.current = true;
    invalidate();
  }, [resources, dirtyKey, blur, opacity, invalidate]);
  useEffect(() => {
    if (previousAnimation.current === animationKey) return;
    previousAnimation.current = animationKey;
    animateUntil.current = performance.now() + Math.min(1000, Math.max(0, animationWindowMs));
    dirty.current = true;
    invalidate();
  }, [animationKey, animationWindowMs, invalidate]);
  useEffect(() => () => {
    resources.target.dispose(); resources.scratch.dispose();
    resources.floorGeometry.dispose(); resources.floorMaterial.dispose();
    resources.depth.dispose(); resources.blurMaterial.dispose(); resources.quadGeometry.dispose();
  }, [resources]);

  useFrame(() => {
    const animationActive = performance.now() <= animateUntil.current;
    if (!dirty.current && !animationActive) return;
    const { target, scratch, floor, camera, depth, blurMaterial, quad, quadCamera } = resources;
    const hidden: Object3D[] = [];
    const oldBackground = scene.background;
    const oldOverride = scene.overrideMaterial;
    const oldTarget = gl.getRenderTarget();
    const oldFace = gl.getActiveCubeFace();
    const oldMip = gl.getActiveMipmapLevel();
    const oldViewport = gl.getViewport(new Vector4());
    const oldScissor = gl.getScissor(new Vector4());
    const oldScissorTest = gl.getScissorTest();
    const oldClear = gl.getClearColor(new Color());
    const oldAlpha = gl.getClearAlpha();
    const oldAutoClear = gl.autoClear;
    const oldShadowAuto = gl.shadowMap.autoUpdate;
    const oldShadowDirty = gl.shadowMap.needsUpdate;
    try {
      scene.traverse((object) => {
        if ((object instanceof Mesh || object instanceof Line || object instanceof Points) && object.visible && (!object.castShadow || object === floor)) {
          hidden.push(object); object.visible = false;
        }
      });
      scene.background = null;
      scene.overrideMaterial = depth;
      gl.autoClear = true;
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = false;
      gl.setClearColor(0x000000, 0);
      gl.setScissorTest(false);
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      for (const amount of [blur, blur * 0.4]) {
        blurMaterial.uniforms.source.value = target.texture;
        blurMaterial.uniforms.stepUv.value.set(amount / 256, 0);
        gl.setRenderTarget(scratch); gl.render(quad, quadCamera);
        blurMaterial.uniforms.source.value = scratch.texture;
        blurMaterial.uniforms.stepUv.value.set(0, amount / 256);
        gl.setRenderTarget(target); gl.render(quad, quadCamera);
      }
      // Pastreaza un ultim refresh dupa fereastra de animatie, inclusiv dupa un cadru intarziat.
      dirty.current = animationActive;
    } finally {
      hidden.forEach((object) => { object.visible = true; });
      scene.background = oldBackground;
      scene.overrideMaterial = oldOverride;
      gl.setRenderTarget(oldTarget, oldFace, oldMip);
      gl.setViewport(oldViewport); gl.setScissor(oldScissor); gl.setScissorTest(oldScissorTest);
      gl.setClearColor(oldClear, oldAlpha);
      gl.autoClear = oldAutoClear;
      gl.shadowMap.autoUpdate = oldShadowAuto;
      gl.shadowMap.needsUpdate = oldShadowDirty;
    }
    // Animatia existenta cere cadrele; umbrele nu pornesc o bucla proprie.
  });
  resources.floorMaterial.opacity = opacity;
  return <primitive object={resources.floor} dispose={null} />;
}
