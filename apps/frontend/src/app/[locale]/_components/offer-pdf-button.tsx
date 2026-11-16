'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiError, apiBlob } from '@/lib/api';
import { saveBlob } from '@/lib/download';

// g4 (etapa 7): „Descarcă PDF” descarca prin aplicatie (sesiunea, ca proforma), nu printr-un
// link direct — la eroare omul vede un mesaj, nu un fisier PDF stricat sau o pagina JSON.
// revizie m7: numele fisierului spune ce e — oferta-<firma>-v<versiunea>.pdf, fara diacritice si
// fara caractere nepermise in numele de fisier (ofertele mai multor firme nu mai ies oferta (1).pdf).
export function offerPdfFileName(companyName: string, version: number | null | undefined): string {
  const slug = companyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const v = typeof version === 'number' && version > 0 ? `-v${version}` : '';
  return `oferta${slug ? `-${slug}` : ''}${v}.pdf`;
}

export function OfferPdfButton({
  quoteId,
  mode,
  fileName = 'oferta.pdf',
}: {
  quoteId: string;
  mode: 'client' | 'company';
  fileName?: string;
}) {
  const t = useTranslations('Quotes');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const blob = await apiBlob(mode === 'client' ? `/client/quotes/${quoteId}/pdf` : `/quotes/${quoteId}/pdf`);
      saveBlob(blob, fileName);
    } catch (e) {
      // sesiunea pierduta o trateaza ascultatorul global (apiBlob semnaleaza 401)
      const code = e instanceof ApiError ? e.code : null;
      setError(code === 'DOCUMENT_RENDER_FAILED' || !code || !t.has(`apiErrors.${code}`) ? t('pdfFailed') : t(`apiErrors.${code}`));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-walnut hover:text-walnut-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 disabled:opacity-60"
      >
        <Download className="size-4 shrink-0" aria-hidden />
        {pending ? t('pdfPending') : t('downloadPdf')}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-crimson">
          {error}
        </p>
      )}
    </div>
  );
}
