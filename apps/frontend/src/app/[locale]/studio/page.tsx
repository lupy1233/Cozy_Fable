import { PublicShell } from '../_components/public-shell';
import { StudioPage } from '@/components/studio/studio-page';

// Studio 3D (stil Sims building) — pagina publica, separata de formular:
// creezi corpuri in configuratorul 3D, le salvezi in biblioteca locala si le
// aranjezi intr-o camera 3D; de acolo pot pleca direct in cerere.
export default function StudioRoutePage() {
  return (
    <PublicShell>
      <StudioPage />
    </PublicShell>
  );
}
