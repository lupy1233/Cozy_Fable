'use client';

import type { RequestStudioSceneDto } from '@marketplace/shared';
import { Sofa } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RoomViewer3dDialog } from './dynamic';

// Butonul "Vezi camera 3D" (feedback PO r3): apare doar cand cererea are
// camere din Studio atasate; deschide viewerul read-only. Acelasi buton pe
// detaliul din marketplace, in fisa de lucru si la client.
export function StudioScenesButton({ scenes }: { scenes?: RequestStudioSceneDto[] }) {
  const t = useTranslations('Studio');
  const [open, setOpen] = useState(false);
  if (!scenes || scenes.length === 0) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Sofa className="h-4 w-4" />
        {t('roomViewer.open')}
        {scenes.length > 1 && (
          <span className="text-xs text-muted-foreground">({scenes.length})</span>
        )}
      </Button>
      {open && <RoomViewer3dDialog scenes={scenes} onClose={() => setOpen(false)} />}
    </>
  );
}
