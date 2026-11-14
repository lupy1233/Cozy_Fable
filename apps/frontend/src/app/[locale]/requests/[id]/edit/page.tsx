'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRef } from 'react';
import { ConfiguratorWizard } from '@/components/configurator/configurator-wizard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { useRequest } from '@/hooks/use-requests';
import { Link } from '@/i18n/routing';
import { requestEditability, type RequestEditability } from '../request-editability';

// Editarea unei cereri publicate: acelasi wizard, rehidratat din answers-ul
// salvat pe camere (configuratorState e null dupa publish). Limitele de edit
// (3 pre-claim / 1 post-claim) sunt aplicate de server la salvare.
// Garda: o cerere care nu mai poate fi editata (de ex. are oferte) arata acelasi mesaj ca
// pagina cererii si legatura inapoi, nu editorul — aceeasi regula ca butonul "Editeaza".
export default function EditRequestPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('Requests');
  const request = useRequest(params.id);
  // decizia se ia o singura data, la prima incarcare: salvarea editarii actualizeaza cererea
  // (ultima editare consumata) si nu are voie sa scoata formularul inainte de redirect
  const decided = useRef<RequestEditability | null>(null);
  if (!decided.current && request.data) decided.current = requestEditability(request.data);

  if (request.isPending) return <SkeletonPage variant="detail" />;
  // erorile (inexistenta, a altcuiva, sesiune expirata) raman tratate de formular, ca inainte
  const gate = decided.current;
  if (gate && !gate.canEdit) {
    return (
      <EmptyState
        variant="card"
        title={t(`edits.${gate.noteKey}`, { remaining: gate.remaining })}
        action={
          <Button asChild variant="outline">
            <Link href={`/requests/${params.id}`}>← {t('backToRequest')}</Link>
          </Button>
        }
      />
    );
  }
  return <ConfiguratorWizard editId={params.id} />;
}
