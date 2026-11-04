import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirmRulesDto } from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import { FirmRulesArticle } from './firm-rules-article';

// E-company-9: pagina afiseaza DOAR valorile primite din GET /legal/firm-rules.
const state = vi.hoisted(() => ({
  rules: { data: undefined as unknown, isPending: false, refetch: vi.fn() },
}));

vi.mock('@/hooks/use-legal', () => ({
  useFirmRules: () => state.rules,
  useLegalOperator: () => ({ data: { published: false } }),
  isFirmRules: (d: unknown) => !!d && typeof d === 'object' && 'penalties' in (d as object),
  isPublishedOperator: () => false,
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const FIXTURE: FirmRulesDto = {
  verification: { reapplyBlockMonths: 3 },
  trial: { enabled: false, plan: 'GOLD', durationDays: 30, bonusCredits: 10 },
  claims: {
    maxClaimsPerRequest: 3,
    assignDeadlineMinutes: 60,
    openAfterFirstOffer: false,
    contactRevealPolicy: 'ON_CLAIM',
    completedContactRetentionDays: 0,
    claimCost: { min: 1, max: null },
  },
  sla: { workingDays: { SMALL: 3, MEDIUM: 3, LARGE: 5 }, graceHours: 12, clarificationExtensionWorkingDays: 1 },
  withdrawals: { voluntaryGraceMinutes: 30, clientUnresponsiveHours: 48 },
  penalties: {
    windowDays: 180,
    companyThreshold: 15,
    suspensionMonths: 6,
    points: { SLA_MISS: 3, VOLUNTARY_WITHDRAWAL: 0 },
  },
  delivery: { autoCompleteDays: 14 },
};

function renderArticle() {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <FirmRulesArticle />
    </NextIntlClientProvider>,
  );
}

describe('FirmRulesArticle', () => {
  beforeEach(() => {
    state.rules = { data: FIXTURE, isPending: false, refetch: vi.fn() };
  });

  it('afiseaza valorile primite (prag 15 puncte, nu 12 hardcodat)', () => {
    renderArticle();
    expect(screen.getByText(/ajunge la 15 puncte active/)).toBeInTheDocument();
    expect(screen.queryByText(/12 puncte/)).not.toBeInTheDocument();
  });

  it('perioada de proba dezactivata → textul alternativ', () => {
    renderArticle();
    expect(screen.getByText('În prezent nu se acordă perioadă de probă la aprobarea firmei.')).toBeInTheDocument();
    expect(screen.queryByText(/primești gratuit abonamentul/)).not.toBeInTheDocument();
  });

  it('regula cu 0 puncte nu apare in lista de penalizari', () => {
    renderArticle();
    expect(screen.getByText(/ofertă netrimisă în termenul de răspuns: 3 puncte/)).toBeInTheDocument();
    expect(screen.queryByText(/retragere voluntară după perioada de grație/)).not.toBeInTheDocument();
  });

  it('E-admin-platform-10: flag oprit → prima oferta inchide preluarea', () => {
    renderArticle();
    expect(screen.getByText(/nu mai poate fi preluată de alte firme, chiar dacă nu s-au ocupat toate cele 3 locuri/)).toBeInTheDocument();
    expect(screen.queryByText(/rămâne disponibilă pentru preluare și după prima ofertă/)).not.toBeInTheDocument();
  });

  it('E-admin-platform-10: flag pornit → cererea ramane deschisa pana la max firme', () => {
    state.rules = {
      data: { ...FIXTURE, claims: { ...FIXTURE.claims, maxClaimsPerRequest: 2, openAfterFirstOffer: true } },
      isPending: false,
      refetch: vi.fn(),
    };
    renderArticle();
    expect(screen.getByText(/rămâne disponibilă pentru preluare și după prima ofertă, până când o preiau 2 firme/)).toBeInTheDocument();
    expect(screen.queryByText(/nu mai poate fi preluată de alte firme/)).not.toBeInTheDocument();
  });

  it('E-company-3: ON_CLAIM → contactele imediat dupa preluare, fara paragraf de retentie', () => {
    renderArticle();
    expect(screen.getByText(/sunt vizibile firmei imediat după preluare/)).toBeInTheDocument();
    expect(screen.queryByText(/devin vizibile după primele/)).not.toBeInTheDocument();
    expect(screen.queryByText(/după livrare, datele de contact/)).not.toBeInTheDocument();
    expect(screen.getByText(/I-ai scris clientului în aplicație/)).toBeInTheDocument();
  });

  it('E-company-3: AFTER_GRACE + retentie 90 → contactele dupa gratie si pragul dupa livrare', () => {
    state.rules = {
      data: {
        ...FIXTURE,
        claims: { ...FIXTURE.claims, contactRevealPolicy: 'AFTER_GRACE', completedContactRetentionDays: 90 },
      },
      isPending: false,
      refetch: vi.fn(),
    };
    renderArticle();
    expect(screen.getByText(/devin vizibile după primele 30 de minute de la preluare/)).toBeInTheDocument();
    expect(screen.queryByText(/sunt vizibile firmei imediat după preluare/)).not.toBeInTheDocument();
    expect(screen.getByText(/La 90 de zile după livrare/)).toBeInTheDocument();
  });

  it('E-company-21: implicitele (min 1, fara plafon) → fara propozitie despre intervalul costului', () => {
    renderArticle();
    expect(screen.queryByText(/Costul unei preluări este de cel puțin/)).not.toBeInTheDocument();
  });

  it('E-company-21: plafon setat → intervalul costului', () => {
    state.rules = {
      data: { ...FIXTURE, claims: { ...FIXTURE.claims, claimCost: { min: 3, max: 25 } } },
      isPending: false,
      refetch: vi.fn(),
    };
    renderArticle();
    expect(screen.getByText('Costul unei preluări este de cel puțin 3 credite și de cel mult 25 de credite.')).toBeInTheDocument();
  });

  it('E-company-21: doar minim > 1 → doar minimul', () => {
    state.rules = {
      data: { ...FIXTURE, claims: { ...FIXTURE.claims, claimCost: { min: 2, max: null } } },
      isPending: false,
      refetch: vi.fn(),
    };
    renderArticle();
    expect(screen.getByText('Costul unei preluări este de cel puțin 2 credite.')).toBeInTheDocument();
  });

  it('sectiunile au ancore pentru linkurile din aplicatie', () => {
    const { container } = renderArticle();
    for (const id of ['verification', 'settlement', 'sla', 'withdrawals', 'penalties', 'suspension']) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('eroare → mesaj + buton de reincercare (fara numere de rezerva)', () => {
    const refetch = vi.fn();
    state.rules = { data: null, isPending: false, refetch };
    renderArticle();
    expect(screen.getByText('Nu am putut încărca valorile în vigoare. Încearcă din nou.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/puncte/)).not.toBeInTheDocument();
  });
});
