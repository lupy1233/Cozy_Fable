import { render, screen } from '@testing-library/react';
import type { CompanyDto } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import ro from '../../../../messages/ro.json';
import { TeamSection } from './team-section';

// h1-1 (etapa 11): formularul explica pasii; e-mailul fara cont de firma → mesaj pe camp.

const addState: { error: unknown } = { error: null };
const reset = vi.fn();
vi.mock('@/hooks/use-company', () => ({
  useAddMember: () => ({ mutate: vi.fn(), reset, isPending: false, error: addState.error }),
  useRemoveMember: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
  useChangeMemberRole: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const company = {
  members: [{ id: 'm1', userId: 'u1', name: 'Ana', email: 'ana@firma.ro', role: 'OWNER', createdAt: '2026-01-01T00:00:00Z' }],
} as unknown as CompanyDto;

function renderSection() {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <TeamSection company={company} canManage />
    </NextIntlClientProvider>,
  );
}

describe('TeamSection (h1-1)', () => {
  beforeEach(() => {
    addState.error = null;
    reset.mockReset();
  });

  it('pasii apar inainte de orice eroare si descriu campul de e-mail', () => {
    renderSection();
    expect(screen.getByText(ro.Company.addMemberHelp.step1)).toBeInTheDocument();
    expect(screen.getByText(ro.Company.addMemberHelp.step2)).toBeInTheDocument();
    const email = screen.getByLabelText(ro.Company.memberEmail);
    expect(email).not.toHaveAttribute('aria-invalid');
    expect(email.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('MEMBER_NO_COMPANY_ACCOUNT → mesajul nou pe campul de e-mail, nu in alerta generala', () => {
    addState.error = new ApiError('MEMBER_NO_COMPANY_ACCOUNT', 404, 'No company user with this email');
    renderSection();
    const email = screen.getByLabelText(ro.Company.memberEmail);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(ro.Company.apiErrors.MEMBER_NO_COMPANY_ACCOUNT);
    expect(email).toHaveAccessibleDescription(expect.stringContaining(ro.Company.apiErrors.MEMBER_NO_COMPANY_ACCOUNT));
  });

  it('alte erori raman in alerta de sub formular', () => {
    addState.error = new ApiError('MEMBER_ALREADY_EXISTS', 409, 'x');
    renderSection();
    expect(screen.getByLabelText(ro.Company.memberEmail)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Company.apiErrors.MEMBER_ALREADY_EXISTS);
  });
});
