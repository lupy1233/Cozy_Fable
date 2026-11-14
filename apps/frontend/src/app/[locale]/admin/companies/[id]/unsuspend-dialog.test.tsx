import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../../messages/ro.json';

// Etapa 12 (k2): dialogul de ridicare a suspendarii cere motiv (min 3 caractere) si spune ce se
// intampla cu punctele; motivul pleaca in corpul cererii.

const unsuspendMutate = vi.fn();
const company = {
  id: 'c1',
  name: 'Lemn & Stil',
  status: 'SUSPENDED',
  cui: 'RO123',
  regComNumber: 'J40/1/2020',
  addressText: 'Str. A 1',
  city: 'București',
  county: 'București',
  isVatPayer: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  suspendedUntil: '2027-04-01T10:00:00.000Z',
  members: [],
  locations: [],
  portfolio: [],
  riskFlags: [],
};

vi.mock('@/hooks/use-company', () => ({
  useAdminCompany: () => ({ isPending: false, isError: false, data: company }),
  useApproveCompany: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, isError: false }),
  useRejectCompany: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, isError: false }),
}));
vi.mock('./use-unsuspend-company', () => ({
  UNSUSPEND_REASON_MIN: 3,
  useUnsuspendCompanyWithReason: () => ({
    mutate: unsuspendMutate,
    reset: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'c1' }) }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/relative-time', () => ({ useRelativeTime: () => () => 'acum o lună' }));

const t = ro.AdminCompanies;

async function renderPage() {
  const { default: Page } = await import('./page');
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <Page />
    </NextIntlClientProvider>,
  );
}

describe('ridicarea suspendarii — dialogul cu motiv (k2)', () => {
  beforeAll(async () => {
    await import('./page');
  }, 60_000);
  beforeEach(() => unsuspendMutate.mockReset());

  it('butonul de confirmare e oprit sub 3 caractere si trimite motivul cand e valid', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: t.unsuspendOpen }));

    // dialogul spune ce se intampla cu punctele
    expect(screen.getByText(t.confirm.unsuspend.body)).toBeTruthy();
    const field = screen.getByLabelText(t.unsuspendReason);
    const cta = screen.getByRole('button', { name: t.confirm.unsuspend.cta }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);

    fireEvent.change(field, { target: { value: '  ab  ' } });
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(unsuspendMutate).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'Firma a explicat întârzierile.' } });
    expect(cta.disabled).toBe(false);
    fireEvent.click(cta);
    expect(unsuspendMutate).toHaveBeenCalledWith(
      { id: 'c1', reason: 'Firma a explicat întârzierile.' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
