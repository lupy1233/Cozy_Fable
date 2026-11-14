'use client';

import { QueryClientContext } from '@tanstack/react-query';
import type { RequestDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// e3 (etapa 9): statusurile in care o salvare e „editare dupa preluare” (aceleasi ca pe server,
// POST_CLAIM_STATUSES din requests.service.ts)
const POST_CLAIM_STATUSES: ReadonlyArray<RequestDto['status']> = ['CLAIMED_PARTIAL', 'CLAIMED_FULL'];

// Salvarea editarii unei cereri deja preluate cere confirmare intr-un dialog al aplicatiei (nu
// fereastra browserului): firmele care lucreaza la cerere sunt anuntate si vad ce s-a schimbat.
// Starea cererii se citeste din cache-ul cererii incarcate de formular (['request', id]) la clic;
// fara ea (sau in afara editarii) salvarea pleaca direct, ca inainte — serverul ramane arbitrul.
export function PostClaimEditConfirm({
  editId,
  onConfirm,
  children,
}: {
  editId?: string;
  onConfirm: () => void;
  // butonul de salvare; primeste functia de apasat in locul salvarii directe
  children: (onClick: () => void) => ReactNode;
}) {
  const t = useTranslations('Configurator');
  // fara QueryClientProvider (unele teste) contextul lipseste → salvare directa
  const queryClient = useContext(QueryClientContext);
  const [open, setOpen] = useState(false);
  // m2 (revizuire): „Da, salvează” porneste salvarea o singura data — al doilea clic (dublu clic,
  // clic in timpul animatiei de inchidere) e ignorat pana la urmatoarea deschidere a dialogului.
  // Butonul de salvare din formular e blocat cat salvarea e in curs, deci nu se poate redeschide.
  const confirmedRef = useRef(false);
  const [confirmed, setConfirmed] = useState(false);

  const trigger = () => {
    const status = editId ? queryClient?.getQueryData<RequestDto>(['request', editId])?.status : undefined;
    if (status && POST_CLAIM_STATUSES.includes(status)) {
      confirmedRef.current = false;
      setConfirmed(false);
      setOpen(true);
      return;
    }
    onConfirm();
  };

  const confirm = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    setConfirmed(true);
    setOpen(false);
    onConfirm();
  };

  return (
    <>
      {children(trigger)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('postClaimEditConfirm.title')}</DialogTitle>
            <DialogDescription>{t('postClaimEditConfirm.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
              {t('postClaimEditConfirm.cancel')}
            </Button>
            <Button
              type="button"
              variant="walnut"
              size="lg"
              disabled={confirmed}
              onClick={confirm}
            >
              {t('postClaimEditConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
