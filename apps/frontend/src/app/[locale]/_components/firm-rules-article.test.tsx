import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirmRulesDto } from '@marketplace/shared';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { FirmRulesArticle } from './firm-rules-article';
import { FIRM_RULES_SECTIONS } from './legal-sections';

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

function renderArticle(locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
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
    expect(screen.getByText(/rămâne deschisă pentru preluare și după prima ofertă, până când se ocupă toate cele 2 locuri/)).toBeInTheDocument();
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

  it('design 2026-11: cardul „Pe scurt” foloseste aceleasi valori ca textul', () => {
    const { container } = renderArticle();
    const summary = container.querySelector<HTMLElement>('#summary');
    expect(summary).not.toBeNull();
    const card = within(summary as HTMLElement);
    expect(card.getByText('în primele 30 de minute')).toBeInTheDocument();
    expect(card.getByText('Termen de răspuns depășit cu peste 12 ore')).toBeInTheDocument();
    expect(card.getByText('3 puncte de penalizare · creditele se consumă')).toBeInTheDocument();
    expect(card.getByText('la 15 puncte active · 6 luni')).toBeInTheDocument();
    expect(card.getByText('după 3 luni')).toBeInTheDocument();
    expect(card.getByText(/nu înlocuiește textul complet/)).toBeInTheDocument();
  });

  it('design 2026-11: regula cu 0 puncte → rezumatul arata doar consumul creditelor', () => {
    const { container } = renderArticle();
    const card = within(container.querySelector<HTMLElement>('#summary') as HTMLElement);
    expect(card.getByText('Retragere voluntară după primele 30 de minute')).toBeInTheDocument();
    expect(card.getByText('creditele se consumă')).toBeInTheDocument();
    expect(card.queryByText(/0 puncte/)).not.toBeInTheDocument();
  });

  it('design 2026-11: cuprinsul trimite la rezumat si la fiecare sectiune', () => {
    renderArticle();
    const toc = screen.getByRole('navigation', { name: 'Cuprins' });
    expect(within(toc).getByRole('link', { name: 'Pe scurt' })).toHaveAttribute('href', '#summary');
    for (const id of FIRM_RULES_SECTIONS) {
      expect(toc.querySelector(`a[href="#${id}"]`)).not.toBeNull();
    }
  });

  it('eroare → mesaj + buton de reincercare (fara numere de rezerva)', () => {
    const refetch = vi.fn();
    state.rules = { data: null, isPending: false, refetch };
    const { container } = renderArticle();
    expect(screen.getByText('Nu am putut încărca valorile în vigoare. Încearcă din nou.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/puncte/)).not.toBeInTheDocument();
    // fara date: nici rezumat, nici cuprins spre sectiuni care nu exista
    expect(container.querySelector('#summary')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Cuprins' })).not.toBeInTheDocument();
  });
  // i3 (etapa 12): fara „0 puncte” in propozitii si fara termene repetate
  const withRules = (patch: { sla?: Partial<FirmRulesDto['sla']['workingDays']>; points?: Partial<FirmRulesDto['penalties']['points']> }) => {
    state.rules = {
      data: {
        ...FIXTURE,
        sla: { ...FIXTURE.sla, workingDays: { ...FIXTURE.sla.workingDays, ...patch.sla } },
        penalties: { ...FIXTURE.penalties, points: { ...FIXTURE.penalties.points, ...patch.points } },
      },
      isPending: false,
      refetch: vi.fn(),
    };
  };
  const text = (c: HTMLElement) => (c.textContent ?? '').replace(/\s+/g, ' ');

  it('i3: mic = mediu → o singura mentiune; retragerea cu 0 puncte nu pomeneste puncte', () => {
    const { container } = renderArticle();
    const all = text(container);
    expect(all).toContain('oferta: 3 zile lucrătoare pentru proiectele mici și medii, 5 zile lucrătoare pentru cele mari.');
    expect(all).not.toContain('pentru cele medii și');
    expect(all).toContain('Retragere voluntară după 30 de minute: creditele se consumă și locul se eliberează pentru alte firme.');
    expect(all).toContain('preluarea expiră, creditele rezervate se consumă și firma primește 3 puncte de penalizare.');
    expect(all).not.toMatch(/\b0 (de )?puncte/);
  });

  it('i3: toate termenele egale si 0 puncte peste tot → „pentru orice proiect”, fara „0 puncte”', () => {
    withRules({ sla: { SMALL: 3, MEDIUM: 3, LARGE: 3 }, points: { SLA_MISS: 0, VOLUNTARY_WITHDRAWAL: 0 } });
    const { container } = renderArticle();
    const all = text(container);
    expect(all).toContain('oferta: 3 zile lucrătoare pentru orice proiect.');
    expect(all).not.toContain('pentru proiectele mici');
    expect(all).toContain('preluarea expiră, creditele rezervate se consumă. Dacă cererea revine');
    expect(all).not.toMatch(/\b0 (de )?puncte/);
    expect(all).not.toContain('firma primește 0');
  });

  it.each([
    [{ SMALL: 2, MEDIUM: 4, LARGE: 4 }, '2 zile lucrătoare pentru proiectele mici, 4 zile lucrătoare pentru cele medii și mari'],
    [{ SMALL: 2, MEDIUM: 4, LARGE: 2 }, '2 zile lucrătoare pentru proiectele mici și mari, 4 zile lucrătoare pentru cele medii'],
    [{ SMALL: 1, MEDIUM: 3, LARGE: 5 }, '1 zi lucrătoare pentru proiectele mici, 3 zile lucrătoare pentru cele medii și 5 zile lucrătoare pentru cele mari'],
  ])('i3: termenele %o → „%s”', (sla, expected) => {
    withRules({ sla });
    const { container } = renderArticle();
    expect(text(container)).toContain(`oferta: ${expected}.`);
  });

  it('i3 (EN): termene egale + 0 puncte → fara „0 points” si fara repetitii', () => {
    withRules({ sla: { SMALL: 5, MEDIUM: 5, LARGE: 5 }, points: { SLA_MISS: 0, VOLUNTARY_WITHDRAWAL: 0 } });
    const { container } = renderArticle('en');
    const all = text(container);
    expect(all).toContain('deadline to send the offer: 5 working days for any project.');
    expect(all).toContain('the claim expires, the reserved credits are consumed. If the request');
    expect(all).toContain('Voluntary withdrawal after 30 minutes: the credits are consumed and the slot is freed for other firms.');
    expect(all).not.toMatch(/\b0 (penalty )?points?/);
  });

  it('i3 (EN): puncte > 0 → „penalty points” cu pluralul corect; mic = mediu', () => {
    withRules({ points: { SLA_MISS: 1, VOLUNTARY_WITHDRAWAL: 2 } });
    const { container } = renderArticle('en');
    const all = text(container);
    expect(all).toContain('3 working days for small and medium projects, 5 working days for large ones.');
    expect(all).toContain('the firm receives 1 penalty point.');
    expect(all).toContain('the slot is freed for other firms and the firm receives 2 penalty points.');
  });
});
