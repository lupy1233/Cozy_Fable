'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useDeleteRequest, useRepostRequest, useRequest } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';

export default function RequestDetailPage() {
  const t = useTranslations('Requests');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useRequest(id);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(`mm_req_token_${id}`));
  }, [id]);

  if (detail.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (detail.isError || !detail.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('empty')}</p>;
  }

  const r = detail.data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/requests" className="text-sm text-walnut hover:underline">
        ← {t('myRequests')}
      </Link>

      {['CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'ACCEPTED'].includes(
        r.status,
      ) && (
        <Button asChild variant="walnut" className="self-start">
          <Link href={`/requests/${id}/offers`}>{t('viewOffers')}</Link>
        </Button>
      )}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="page-title">{r.title}</h1>
          <StatusBadge status={r.status} label={t(`statusValue.${r.status}`)} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {r.sizing && (
            <span>
              {t('size')}: <strong>{t(`sizeValue.${r.sizing.size}`)}</strong> ({r.sizing.score} ·{' '}
              {r.sizing.creditCost} {t('credits')})
            </span>
          )}
          <span>
            {t('field.budgetRange')}: {t(`budget.${r.budgetRange}`)}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {r.addressText}, {r.city}, {r.county}
          {r.lat !== null && r.lng !== null ? ` (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})` : ''}
        </p>
        {r.expiresAt && (
          <p className="text-sm text-muted-foreground">
            {t('expiresAt')}: {new Date(r.expiresAt).toLocaleString()}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-muted-2">
          {t('editsUsed')}: {r.preClaimEditsUsed}/3 · {r.postClaimEditsUsed}/1
        </p>
      </div>

      {/* Camere */}
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">{t('sectionRooms')}</h2>
        {r.rooms.map((room) => (
          <div key={room.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm font-medium">
              {t(`roomType.${room.roomType}`)} · {room.lengthM}×{room.widthM}×{room.heightM} m
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {room.items.map((it) => (
                <li key={it.id}>
                  {it.quantity}× {it.name} — {t(`material.${it.material}`)}
                  {it.systems.length > 0 &&
                    ` · ${it.systems.map((s) => t(`system.${s}`)).join(', ')}`}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Atasamente */}
      {r.attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">{t('sectionAttachments')}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {r.attachments.map((a) => (
              <li key={a.id}>
                {a.downloadUrl ? (
                  <a href={a.downloadUrl} className="text-walnut hover:underline" target="_blank" rel="noreferrer">
                    {a.filename}
                  </a>
                ) : (
                  a.filename
                )}{' '}
                · {a.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.status === 'EXPIRED' && token && <RepostButton id={id} token={token} />}

      {['DRAFT', 'IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'EXPIRED'].includes(
        r.status,
      ) && <DeleteRequestButton id={id} />}
    </div>
  );
}

function DeleteRequestButton({ id }: { id: string }) {
  const t = useTranslations('Requests');
  const router = useRouter();
  const del = useDeleteRequest();
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <button
        onClick={() => {
          if (confirm(t('deleteConfirm'))) {
            del.mutate(id, { onSuccess: () => router.replace('/requests') });
          }
        }}
        disabled={del.isPending}
        className="self-start text-sm text-crimson hover:underline disabled:opacity-50"
      >
        {t('deleteRequest')}
      </button>
    </div>
  );
}

function RepostButton({ id, token }: { id: string; token: string }) {
  const t = useTranslations('Requests');
  const repost = useRepostRequest(token);
  const apiErr = repost.error instanceof ApiError ? repost.error.code : null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="walnut"
        className="self-start"
        onClick={() => repost.mutate()}
        disabled={repost.isPending}
      >
        {t('repost')}
      </Button>
      {apiErr && (
        <p className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}
      {repost.isSuccess && <p className="text-sm text-sage">{t('reposted')}</p>}
    </div>
  );
}
