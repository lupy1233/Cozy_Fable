'use client';

import { useThree } from '@react-three/fiber';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PMREMGenerator, type Texture } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Reflexii de studio generate local: fara HDR extern, request-uri sau animatie continua.
// Fiecare canvas isi elibereaza textura si resursele GPU la inchidere.
const LightingContext = createContext<{ map: Texture | null; intensity: number; overview: boolean }>({ map: null, intensity: 0, overview: false });
export const useShowroomLighting = () => useContext(LightingContext);

export function ShowroomEnvironment({ intensity = 0.55, overview = false, children }: { intensity?: number; overview?: boolean; children?: ReactNode }) {
  const { gl, invalidate } = useThree();
  const [map, setMap] = useState<Texture | null>(null);
  useEffect(() => {
    if (overview) { setMap(null); return; }
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    setMap(target.texture);
    room.dispose();
    generator.dispose();
    invalidate();
    return () => {
      target.dispose();
    };
  }, [gl, invalidate, overview]);
  const value = useMemo(() => ({ map, intensity, overview }), [map, intensity, overview]);
  // Numai mobilierul consuma reflexiile; podelele/peretii mari nu platesc costul PBR al hartii.
  return <LightingContext.Provider value={value}>{children}</LightingContext.Provider>;
}
