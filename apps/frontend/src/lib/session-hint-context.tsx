'use client';
import { createContext, useContext, useState } from 'react';
import type { SessionRole } from './session-hint';

// Valoare de randare venita de pe server (nu date API): folosita DOAR cat useMe e pending,
// ca headerul sa porneasca direct cu navigatia rolului. TanStack Query ramane sursa de adevar.
type Ctx = { role: SessionRole | null; setRole: (r: SessionRole | null) => void };

const HintContext = createContext<Ctx | null>(null);

export function SessionHintProvider({
  initialRole,
  children,
}: {
  initialRole: SessionRole | null;
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<SessionRole | null>(initialRole);
  return <HintContext.Provider value={{ role, setRole }}>{children}</HintContext.Provider>;
}

// Fara provider (teste) → null
export function useSessionHint(): SessionRole | null {
  return useContext(HintContext)?.role ?? null;
}

// Fara provider → no-op
export function useSetSessionHint(): (r: SessionRole | null) => void {
  return useContext(HintContext)?.setRole ?? noop;
}

function noop() {}
