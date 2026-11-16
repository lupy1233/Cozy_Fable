'use client';

import type { RequestDraftListItemDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { DRAFT_TOKEN_KEY, hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import { markDraftContinue } from '@/components/configurator/draft-continue';
import { useRelativeTime } from '@/lib/relative-time';
import { useContinueDraft, useDeleteRequest } from '@/hooks/use-requests';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toaster';
import { ActionConfirmDialog } from '../_components/action-confirm-dialog';

const MAX_ROOM_CHIPS = 4;

// d5 (PO d5-1): fila "Ciorne" din "Cererile mele" — doar ciornele legate de cont, cu
// "Continua" (de pe orice dispozitiv: serverul da un token nou, formularul se deschide pe
// ciorna asta) si "Sterge" (definitiv, cu confirmare).
export function MyDraftsList({ drafts }: { drafts: RequestDraftListItemDto[] }) {
  const t = useTranslations('Requests');
  const tc = useTranslations('Configurator');
  const relTime = useRelativeTime();
  const router = useRouter();
  const cont = useContinueDraft();
  const del = useDeleteRequest();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const errText = (e: unknown) => {
    if (!e) return null;
    const code = e instanceof ApiError ? e.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };

  // revizie m4: o cerere inceputa in acest browser (poate cu schimbari netrimise) nu se
  // inlocuieste fara intrebare; intrebarea se pune aici, o singura data (formularul nu mai
  // intreaba "Continui sau incepi din nou?" cand vine din "Continua")
  const [toContinue, setToContinue] = useState<string | null>(null);
  const continueDraft = (id: string) =>
    cont.mutate(id, {
      onSuccess: ({ draftToken }) => {
        setToContinue(null);
        // formularul reia ciorna din token: starea locala se goleste ca sa se incarce ciorna aleasa
        try {
          localStorage.setItem(DRAFT_TOKEN_KEY, draftToken);
        } catch {
          // fara localStorage formularul porneste o ciorna noua; ciorna ramane in lista
        }
        markDraftContinue();
        useConfiguratorStore.getState().reset();
        router.push('/requests/new');
      },
    });
  const askContinue = (id: string) => {
    if (hasUnpublishedLocalDraft()) {
      cont.reset();
      setToContinue(id);
      return;
    }
    continueDraft(id);
  };
  // revizie m9: numele accesibil al butoanelor spune la ce ciorna se refera
  const describe = (d: RequestDraftListItemDto) => {
    const rooms = d.roomTypes.map((rt) => tc(`rooms.type.${rt}`)).join(', ');
    return [d.title, rooms, t('drafts.savedAgo', { time: relTime(d.updatedAt) })].filter(Boolean).join(' · ');
  };

  if (drafts.length === 0) {
    return <EmptyState variant="dashed" size="sm" title={t('drafts.empty')} />;
  }

  return (
    <>
      {cont.error && toContinue === null && (
        <p role="alert" className="text-sm text-crimson">
          {errText(cont.error)}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {drafts.map((d) => {
          const extraRooms = d.roomTypes.length - MAX_ROOM_CHIPS;
          return (
            <Card as="article" key={d.id} padding="none" className="flex flex-col gap-3 px-5 py-5 sm:px-6">
              <h2 className="heading-section min-w-0 break-words">{d.title || t('drafts.untitled')}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {d.roomTypes.slice(0, MAX_ROOM_CHIPS).map((rt, i) => (
                  <span key={`${rt}-${i}`} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-ui">
                    {tc(`rooms.type.${rt}`)}
                  </span>
                ))}
                {extraRooms > 0 && (
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-ui text-muted-foreground">
                    +{extraRooms}
                  </span>
                )}
                <span className="text-muted-foreground">
                  · {d.city && `${d.city} · `}
                  <span className="font-mono text-xs">{t('drafts.savedAgo', { time: relTime(d.updatedAt) })}</span>
                </span>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-dashed border-border-2 pt-3">
                <Button
                  type="button"
                  variant="walnut"
                  size="lg"
                  className="h-11"
                  disabled={cont.isPending}
                  aria-label={t('drafts.continueLabel', { draft: describe(d) })}
                  onClick={() => askContinue(d.id)}
                >
                  {t('drafts.continue')}
                </Button>
                <button
                  type="button"
                  aria-label={t('drafts.deleteLabel', { draft: describe(d) })}
                  onClick={() => {
                    del.reset();
                    setToDelete(d.id);
                  }}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-crimson hover:underline"
                >
                  {t('drafts.delete')}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <ActionConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title={t('drafts.deleteTitle')}
        tone="danger"
        confirmLabel={t('deleteDialog.confirm')}
        cancelLabel={t('deleteDialog.cancel')}
        pendingLabel={t('deleteDialog.pending')}
        pending={del.isPending}
        error={errText(del.error)}
        onConfirm={() => {
          if (!toDelete) return;
          del.mutate(toDelete, {
            onSuccess: () => {
              setToDelete(null);
              toast.success(t('drafts.deleted'));
            },
          });
        }}
      >
        <p>{t('drafts.deleteBody')}</p>
      </ActionConfirmDialog>
      <ActionConfirmDialog
        open={toContinue !== null}
        onOpenChange={(o) => {
          if (!o) setToContinue(null);
        }}
        title={tc('resume.title')}
        confirmLabel={t('drafts.continueConfirm')}
        cancelLabel={t('deleteDialog.cancel')}
        pendingLabel={t('drafts.continuePending')}
        pending={cont.isPending}
        error={errText(cont.error)}
        onConfirm={() => {
          if (toContinue) continueDraft(toContinue);
        }}
      >
        <p>{t('drafts.replaceLocalBody')}</p>
      </ActionConfirmDialog>
    </>
  );
}
