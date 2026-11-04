'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createOpenTween, retargetOpenTween, sampleOpenTween } from './open-tween';

export function useOpenTween(open: boolean, duration: number, apply: (progress: number) => void, onComplete?: (open: boolean) => void) {
  const invalidate = useThree((state) => state.invalidate);
  const tween = useRef(createOpenTween());
  const applyRef = useRef(apply);
  const completeRef = useRef(onComplete);
  const reported = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => { applyRef.current = apply; completeRef.current = onComplete; });
  useLayoutEffect(() => {
    tween.current = retargetOpenTween(tween.current, open, performance.now(), duration, reducedMotion);
    reported.current = false;
    applyRef.current(sampleOpenTween(tween.current, performance.now()));
    invalidate();
  }, [open, duration, reducedMotion, invalidate]);

  useFrame(() => {
    const progress = sampleOpenTween(tween.current, performance.now());
    applyRef.current(progress);
    if (progress !== tween.current.to) invalidate();
    else if (!reported.current) {
      reported.current = true;
      completeRef.current?.(tween.current.to === 1);
    }
  }, -1);
}
