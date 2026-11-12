'use client';

import { useSessionRole } from '@/hooks/use-auth';
import { AppHeader } from './app-header';
import { PublicHeader } from './public-header';

// Antetul paginii Studio 3D: clientul logat vede antetul contului (acelasi meniu ca in
// restul contului, cu „Studio 3D" activ); vizitatorii, firmele si adminul vad antetul public.
// Rolul vine din indiciul de sesiune randat pe server, deci nu sare la hidratare.
export function StudioHeader() {
  const { role } = useSessionRole();
  return role === 'CLIENT' ? <AppHeader /> : <PublicHeader />;
}
