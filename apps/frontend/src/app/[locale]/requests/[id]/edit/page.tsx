'use client';

import { useParams } from 'next/navigation';
import { ConfiguratorWizard } from '@/components/configurator/configurator-wizard';

// Editarea unei cereri publicate: acelasi wizard, rehidratat din answers-ul
// salvat pe camere (configuratorState e null dupa publish). Limitele de edit
// (3 pre-claim / 1 post-claim) sunt aplicate de server la salvare.
export default function EditRequestPage() {
  const params = useParams<{ id: string }>();
  return <ConfiguratorWizard editId={params.id} />;
}
