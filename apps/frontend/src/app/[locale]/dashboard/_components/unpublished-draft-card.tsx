'use client';

import { ArrowRight, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// b4: „Ai o cerere gata de publicare — Continuă”, cand browserul are o ciorna nepublicata.
// Depinde DOAR de rezultatul hasUnpublishedLocalDraft (citit dupa montare: localStorage nu
// exista pe server). Ciornele de pe alte dispozitive raman pentru problema 32.
export function UnpublishedDraftCard() {
  const t = useTranslations('Dashboard.client.draftCard');
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => setHasDraft(hasUnpublishedLocalDraft()), []);
  if (!hasDraft) return null;

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="dash-draft-title"
      className="flex flex-wrap items-center justify-between gap-4 border-walnut/40 bg-walnut-soft px-5 py-4 sm:px-6"
    >
      <div className="flex min-w-0 items-start gap-3">
        <FileText aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-walnut" />
        <div className="min-w-0">
          <h2 id="dash-draft-title" className="heading-section">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('body')}</p>
        </div>
      </div>
      <Button asChild variant="walnut" size="lg">
        <Link href="/requests/new">
          {t('continue')}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}
