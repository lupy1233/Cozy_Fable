import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { ApiError } from '@/lib/api';
import { OfferPdfButton, offerPdfFileName } from './offer-pdf-button';

// g4 (etapa 7): „Descarcă PDF” prin aplicatie; la eroare, mesaj limpede (nu fisier stricat).
const m = vi.hoisted(() => ({ apiBlob: vi.fn(), saveBlob: vi.fn() }));
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiBlob: m.apiBlob }));
vi.mock('@/lib/download', () => ({ saveBlob: m.saveBlob }));

function renderButton(mode: 'client' | 'company', locale: 'en' | 'ro' = 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ro}>
      <OfferPdfButton quoteId="q1" mode={mode} fileName={offerPdfFileName('Mobilă Ștefan & Fiii SRL', 2)} />
    </NextIntlClientProvider>,
  );
}

describe('offerPdfFileName (revizie m7)', () => {
  it('firma fara diacritice si caractere nepermise + versiunea', () => {
    expect(offerPdfFileName('Mobilă Ștefan & Fiii SRL', 2)).toBe('oferta-mobila-stefan-fiii-srl-v2.pdf');
    expect(offerPdfFileName('A/B:C*?"<>| Mobila', 1)).toBe('oferta-a-b-c-mobila-v1.pdf');
    expect(offerPdfFileName('!!!', null)).toBe('oferta.pdf');
    expect(offerPdfFileName('x'.repeat(80), 3)).toBe(`oferta-${'x'.repeat(40)}-v3.pdf`);
  });
});

describe('OfferPdfButton (g4)', () => {
  beforeEach(() => {
    m.apiBlob.mockReset();
    m.saveBlob.mockReset();
  });

  it('client: descarca prin sesiune ruta clientului si salveaza fisierul', async () => {
    const blob = new Blob(['%PDF']);
    m.apiBlob.mockResolvedValue(blob);
    renderButton('client');
    fireEvent.click(screen.getByRole('button', { name: en.Quotes.downloadPdf }));
    await waitFor(() => expect(m.saveBlob).toHaveBeenCalledWith(blob, 'oferta-mobila-stefan-fiii-srl-v2.pdf'));
    expect(m.apiBlob).toHaveBeenCalledWith('/client/quotes/q1/pdf');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('firma: ruta firmei; documentul nu se poate genera → mesaj clar, fara fisier', async () => {
    m.apiBlob.mockRejectedValue(new ApiError('DOCUMENT_RENDER_FAILED', 503, 'x'));
    renderButton('company', 'ro');
    fireEvent.click(screen.getByRole('button', { name: ro.Quotes.downloadPdf }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ro.Quotes.pdfFailed);
    expect(m.apiBlob).toHaveBeenCalledWith('/quotes/q1/pdf');
    expect(m.saveBlob).not.toHaveBeenCalled();
  });

  it('eroare de retea (fara cod) → acelasi mesaj clar', async () => {
    m.apiBlob.mockRejectedValue(new TypeError('Failed to fetch'));
    renderButton('client');
    fireEvent.click(screen.getByRole('button', { name: en.Quotes.downloadPdf }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.Quotes.pdfFailed);
  });
});
