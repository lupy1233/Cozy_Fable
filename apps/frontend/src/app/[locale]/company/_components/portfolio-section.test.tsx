import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CompanyDto, ErrorCode } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import ro from '../../../../messages/ro.json';
import { PortfolioSection } from './portfolio-section';

// h1 (etapa 11), pasul 4: poza din calculator (presign → PUT → confirm in hook), o singura poza
// pe lucrare, mesajul pentru poza respinsa pe camp, imaginea de rezerva.

const addMutate = vi.fn();
const uploadAsync = vi.fn();
const setImageMutate = vi.fn();
const addState: { error: unknown } = { error: null };
vi.mock('@/hooks/use-company', () => ({
  useAddPortfolioItem: () => ({ mutate: addMutate, reset: vi.fn(), isPending: false, error: addState.error }),
  useUploadPortfolioImage: () => ({ mutateAsync: uploadAsync, reset: vi.fn(), isPending: false }),
  useSetPortfolioImage: () => ({ mutate: setImageMutate, isPending: false }),
  useDeletePortfolioItem: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
}));

const company = {
  portfolio: [
    { id: 'p1', title: 'Bucătărie albă', description: null, imageUrl: 'https://storage/get/k1', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'p2', title: 'Dressing', description: null, imageUrl: null, createdAt: '2026-01-01T00:00:00Z' },
  ],
} as unknown as CompanyDto;

const c = ro.Company;
const reasons = ro.Configurator.uploads.rejectReason;

function renderSection() {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <PortfolioSection company={company} canManage />
    </NextIntlClientProvider>,
  );
}

const png = (name = 'lucrare.png', size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/png' });

function openDialogAndPick(file: File) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(c.addPortfolioHint) }));
  fireEvent.change(screen.getByLabelText(c.portfolioTitle), { target: { value: 'Living nuc' } });
  const input = document.querySelector('[role="dialog"] input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

describe('PortfolioSection (h1)', () => {
  beforeEach(() => {
    addMutate.mockReset();
    uploadAsync.mockReset();
    setImageMutate.mockReset();
    addState.error = null;
  });

  // h1 (revizuire m4): reincercarea dupa o atasare picata refoloseste incarcarea
  it('adaugarea picata dupa o incarcare reusita: reincercarea nu mai urca fisierul', async () => {
    uploadAsync.mockImplementation(async ({ resumeAttachmentId, onUploaded }) => {
      if (!resumeAttachmentId) onUploaded?.('att-1');
      return resumeAttachmentId ?? 'att-1';
    });
    addMutate.mockImplementationOnce((_input, opts) => opts?.onError?.(new ApiError('DATABASE_BUSY', 503, 'x')));
    renderSection();
    const file = png();
    openDialogAndPick(file);
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(2));
    expect(uploadAsync).toHaveBeenCalledTimes(2);
    expect(uploadAsync.mock.calls[1][0]).toMatchObject({ file, resumeAttachmentId: 'att-1' });
    expect(addMutate.mock.calls[1][0]).toMatchObject({ attachmentId: 'att-1' });
  });

  it('verificarea care dureaza prea mult are text propriu; reincercarea doar reconfirma', async () => {
    const { UploadStillPendingError } = await import('@/lib/upload-scan');
    uploadAsync.mockImplementationOnce(async ({ onUploaded }) => {
      onUploaded?.('att-9');
      throw new UploadStillPendingError();
    });
    uploadAsync.mockResolvedValueOnce('att-9');
    renderSection();
    const file = png();
    openDialogAndPick(file);
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    expect(await screen.findByText(c.portfolioImagePending)).toBeInTheDocument();
    expect(screen.queryByText(reasons.PENDING)).not.toBeInTheDocument();
    expect(addMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(uploadAsync.mock.calls[1][0]).toMatchObject({ resumeAttachmentId: 'att-9' });
  });

  it('o alta poza aleasa dupa o incarcare se urca din nou (nu refoloseste id-ul vechi)', async () => {
    uploadAsync.mockImplementation(async ({ resumeAttachmentId, onUploaded }) => {
      if (!resumeAttachmentId) onUploaded?.('att-new');
      return resumeAttachmentId ?? 'att-new';
    });
    addMutate.mockImplementationOnce((_input, opts) => opts?.onError?.(new ApiError('DATABASE_BUSY', 503, 'x')));
    renderSection();
    openDialogAndPick(png('a.png'));
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    const input = document.querySelector('[role="dialog"] input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [png('b.png')] } });
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(2));
    expect(uploadAsync.mock.calls[1][0].resumeAttachmentId).toBeUndefined();
  });

  it('plafonul de lucrari atins → mesajul cu limita, in limba omului', () => {
    addState.error = new ApiError('COMPANY_PORTFOLIO_LIMIT_REACHED' as ErrorCode, 409, 'x', { max: 30 });
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(c.addPortfolioHint) }));
    expect(screen.getByRole('alert')).toHaveTextContent(c.apiErrors.COMPANY_PORTFOLIO_LIMIT_REACHED.replace('{max}', '30'));
  });

  it('firma suspendata: refuzul de la incarcare se explica, nu apare ca problema de conexiune', async () => {
    uploadAsync.mockRejectedValue(new ApiError('COMPANY_SUSPENDED' as ErrorCode, 403, 'x'));
    renderSection();
    openDialogAndPick(png());
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    expect(await screen.findByText(c.apiErrors.COMPANY_SUSPENDED)).toBeInTheDocument();
    expect(screen.queryByText(reasons.NETWORK)).not.toBeInTheDocument();
  });

  it('„Schimbă poza”: atasarea picata se reincearca fara un nou PUT', async () => {
    uploadAsync.mockImplementation(async ({ resumeAttachmentId, onUploaded }) => {
      if (!resumeAttachmentId) onUploaded?.('att-r');
      return resumeAttachmentId ?? 'att-r';
    });
    setImageMutate.mockImplementationOnce((_input, opts) => opts?.onError?.(new ApiError('DATABASE_BUSY', 503, 'x')));
    renderSection();
    fireEvent.change(screen.getByTestId('portfolio-replace-p1'), { target: { files: [png('noua.png')] } });
    const retry = await screen.findByRole('button', { name: c.portfolioImageRetry });
    fireEvent.click(retry);
    await waitFor(() => expect(setImageMutate).toHaveBeenCalledTimes(2));
    expect(uploadAsync.mock.calls[1][0]).toMatchObject({ resumeAttachmentId: 'att-r' });
  });

  it('imaginea de rezerva: fara poza si cand poza nu se incarca', () => {
    const { container } = renderSection();
    const img = screen.getByRole('img', { name: 'Bucătărie albă' });
    expect(container.querySelectorAll('[data-portfolio-fallback]')).toHaveLength(1); // Dressing
    fireEvent.error(img);
    expect(screen.queryByRole('img', { name: 'Bucătărie albă' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-portfolio-fallback]')).toHaveLength(2);
  });

  it('nu mai exista campul de adresa a pozei', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(c.addPortfolioHint) }));
    expect(screen.queryByRole('textbox', { name: /URL/i })).not.toBeInTheDocument();
  });

  it('incarcarea reusita: poza se incarca intai, apoi lucrarea se creeaza cu id-ul ei', async () => {
    uploadAsync.mockResolvedValue('att-1');
    renderSection();
    const file = png();
    openDialogAndPick(file);
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(uploadAsync.mock.calls[0][0]).toMatchObject({ file, resumeAttachmentId: undefined });
    expect(addMutate.mock.calls[0][0]).toEqual({ title: 'Living nuc', description: undefined, attachmentId: 'att-1' });
  });

  it('un fisier care nu e imagine e respins local, pe camp, fara incarcare', async () => {
    renderSection();
    openDialogAndPick(new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }));
    expect(screen.getByText(c.portfolioImageRejectType)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(uploadAsync).not.toHaveBeenCalled();
    // poza respinsa nu ramane aleasa: lucrarea pleaca fara poza
    expect(addMutate.mock.calls[0][0].attachmentId).toBeUndefined();
  });

  it.each([
    ['FILE_TOO_LARGE', reasons.SIZE],
    ['FILE_TYPE_NOT_ALLOWED', c.portfolioImageRejectType],
    ['FILE_SCAN_BLOCKED', reasons.SCAN],
  ])('respinsa de server (%s) → mesajul pe camp, lucrarea nu se creeaza', async (code, text) => {
    uploadAsync.mockRejectedValue(new ApiError(code as ErrorCode, 400, 'x'));
    renderSection();
    openDialogAndPick(png());
    fireEvent.click(screen.getByRole('button', { name: c.addPortfolioItem }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(addMutate).not.toHaveBeenCalled();
  });

  it('„Schimbă poza” pe card: incarca si inlocuieste poza lucrarii', async () => {
    uploadAsync.mockResolvedValue('att-2');
    renderSection();
    expect(screen.getByRole('button', { name: c.replacePortfolioImageAria.replace('{title}', 'Bucătărie albă') })).toBeInTheDocument();
    const input = screen.getByTestId('portfolio-replace-p1');
    fireEvent.change(input, { target: { files: [png('noua.png')] } });
    await waitFor(() => expect(setImageMutate).toHaveBeenCalledTimes(1));
    expect(setImageMutate.mock.calls[0][0]).toEqual({ id: 'p1', attachmentId: 'att-2' });
  });
});
