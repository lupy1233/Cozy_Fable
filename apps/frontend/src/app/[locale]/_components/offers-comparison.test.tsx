import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatThreadDto,
  QuoteDeliveryTermUnit,
  QuoteDto,
  QuoteVatMode,
  QuoteVersionDto,
} from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import { LandingCompareDemo } from './landing-compare-demo';
import { OffersComparison, RequestJourney, UnreadBanner } from './offers-comparison';

// Laws of UX (2026-11-08) + canvas 2026-11: tabelul de comparatie (de la prima oferta, cu firma
// deschisa evidentiata), drumul cererii, firmele cu mesaje noi.
// a3 (etapa 4): total in lei cu TVA, termen in zile lucratoare, rubricile noi, ofertele vechi.

const RATE = 4.97;
const round2 = (n: number) => Math.round(n * 100) / 100;

function thread(id: string, claim: string, name: string, unread = 0): ChatThreadDto {
  return {
    id,
    claimSlotId: claim,
    requestId: 'r1',
    companyName: name,
    unreadCount: unread,
    claimStatus: 'OFFER_SENT',
    readOnly: false,
    lastMessage: null,
    createdAt: new Date().toISOString(),
  } as unknown as ChatThreadDto;
}

// varianta veche (inainte de etapa 4): doar text liber, rubricile structurate null
function quote(
  claim: string,
  total: number,
  extra: Partial<QuoteDto> = {},
  version: Partial<QuoteVersionDto> = {},
): QuoteDto {
  const currency = version.currency ?? 'RON';
  const price = version.price ?? total;
  const v: QuoteVersionDto = {
    id: `v-${claim}`,
    version: 1,
    isExtra: false,
    price,
    designFee: null,
    currency,
    priceRon: currency === 'EUR' ? round2(price * RATE) : price,
    priceEur: currency === 'EUR' ? price : round2(price / RATE),
    designFeeRon: null,
    designFeeEur: null,
    total,
    totalRon: currency === 'EUR' ? round2(total * RATE) : total,
    totalEur: currency === 'EUR' ? total : round2(total / RATE),
    deliveryTerm: '6 săptămâni',
    deliveryDate: null,
    warranty: '24 luni',
    description: 'Mobilier',
    vatMode: null,
    deliveryTermValue: null,
    deliveryTermUnit: null,
    warrantyMonths: null,
    includesTransport: null,
    includesAssembly: null,
    designIncludes: null,
    vatRatePercent: 21,
    priceWithVat: null,
    totalWithVat: null,
    deliveryWorkingDays: null,
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    isExpired: false,
    validityExtensionsUsed: 0,
    extensionRequestedAt: null,
    createdByUserId: 'u1',
    sentAt: new Date().toISOString(),
    changeRequest: null,
    attachments: [],
    roomPrices: [],
    ...version,
  };
  return {
    id: `q-${claim}`,
    claimSlotId: claim,
    requestId: 'r1',
    companyId: `c-${claim}`,
    companyName: claim,
    currency,
    status: 'SENT',
    extraVersionsCount: 0,
    versionsUsed: 1,
    versionLimitReached: false,
    eurRonRate: RATE,
    versions: [v],
    consultationInvites: [],
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    acceptedVersionId: null,
    declinedAt: null,
    declineReason: null,
    declineNote: null,
    changeRequests: [],
    ...extra,
  };
}

// varianta noua (contract etapa 4): rubricile structurate + cifrele calculate de server
// (priceWithVat pe pret, totalWithVat pe pret + proiectare, deliveryWorkingDays)
function structured(
  claim: string,
  price: number,
  opts: {
    currency?: 'RON' | 'EUR';
    vatMode?: QuoteVatMode;
    weeks?: number;
    workingDays?: number;
    designFee?: number;
    designIncludes?: string;
    status?: QuoteDto['status'];
    version?: Partial<QuoteVersionDto>;
  } = {},
): QuoteDto {
  const vatMode = opts.vatMode ?? 'VAT_INCLUDED';
  const unit: QuoteDeliveryTermUnit = opts.workingDays != null ? 'WORKING_DAYS' : 'WEEKS';
  const value = opts.workingDays ?? opts.weeks ?? 6;
  const designFee = opts.designFee ?? null;
  const total = price + (designFee ?? 0);
  const factor = vatMode === 'VAT_EXCLUDED' ? 1.21 : 1;
  const status = opts.status ?? 'SENT';
  return quote(
    claim,
    total,
    {
      status,
      ...(status === 'DECLINED'
        ? { declinedAt: new Date().toISOString(), declineReason: 'PRICE' as const, declineNote: null }
        : {}),
    },
    {
      currency: opts.currency ?? 'RON',
      price,
      designFee,
      designIncludes: opts.designIncludes ?? null,
      vatMode,
      vatRatePercent: 21,
      priceWithVat: round2(price * factor),
      totalWithVat: round2(total * factor),
      deliveryTermValue: value,
      deliveryTermUnit: unit,
      deliveryWorkingDays: unit === 'WEEKS' ? value * 5 : value,
      warrantyMonths: 24,
      includesTransport: true,
      includesAssembly: false,
      deliveryTerm: unit === 'WEEKS' ? `${value} săptămâni` : `${value} de zile lucrătoare`,
      warranty: '24 de luni',
      ...opts.version,
    },
  );
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );

// celula unei rubrici pentru coloana a n-a (0 = prima firma)
const cellOf = (rubric: string, n: number) => {
  const row = screen.getByText(rubric, { selector: 'th' }).closest('tr')!;
  return within(row).getAllByRole('cell')[n];
};
const rowHeads = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('tbody th[scope="row"]'))
    .map((th) => th.textContent ?? '')
    .filter((s) => s && s !== 'Detalii');

describe('OffersComparison', () => {
  it('nu apare cat timp nicio firma nu a trimis oferta', () => {
    const { container } = wrap(
      <OffersComparison threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]} quoteByClaim={new Map()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('apare de la prima oferta, pe aceleasi rubrici, fara eticheta de cel mai mic', () => {
    const { container } = wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([['s1', structured('s1', 1000)]])}
      />,
    );
    expect(screen.getByText('Ofertele, una lângă alta')).toBeTruthy();
    expect(rowHeads(container)).toEqual([
      'Preț',
      'TVA',
      'Total în lei, cu TVA',
      'Termen',
      'Garanție',
      'Transport',
      'Montaj',
      'Valabilitate',
    ]);
    expect(screen.getByText('ofertă în lucru')).toBeTruthy();
    // o singura oferta: nu are cu ce se compara
    expect(screen.queryByText('cel mai mic')).toBeNull();
    // rubricile noi
    expect(cellOf('TVA', 0).textContent).toBe('include TVA');
    expect(cellOf('Garanție', 0).textContent).toBe('24 de luni');
    expect(cellOf('Transport', 0).textContent).toBe('inclus în preț');
    expect(cellOf('Montaj', 0).textContent).toBe('nu e inclus');
    // fara euro nu e nevoie de curs
    expect(screen.queryByText(/Curs folosit/)).toBeNull();
  });

  it('3.900 EUR fara TVA langa 18.500 lei cu TVA: totalul in lei cu TVA si cel mai mic corecte', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 3900, { currency: 'EUR', vatMode: 'VAT_EXCLUDED' })],
          ['s2', structured('s2', 18500, { vatMode: 'VAT_INCLUDED' })],
        ])}
      />,
    );
    // pretul in moneda ofertei, cu echivalentul in lei sub suma in euro (3.900 × 4,97)
    expect(cellOf('Preț', 0).textContent).toContain('3.900 EUR');
    expect(cellOf('Preț', 0).textContent).toContain('≈ 19.383 lei');
    expect(cellOf('Preț', 1).textContent).toBe('18.500 lei');
    expect(cellOf('TVA', 0).textContent).toContain('nu include TVA');
    expect(cellOf('TVA', 0).textContent).toContain('se adaugă 21%');
    // 3.900 × 1,21 = 4.719 EUR × 4,97 = 23.453,43 lei
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toBe('23.453 lei');
    expect(cellOf('Total în lei, cu TVA', 1).textContent).toContain('18.500 lei');
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 1));
    // cursul folosit e afisat
    expect(screen.getByText(/1 EUR = 4,97 lei/)).toBeTruthy();
  });

  it('cursul de sub tabel nu promite o data (setare fixa eur_ron_rate)', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A')]}
        quoteByClaim={new Map([['s1', quote('s1', 3900, {}, { currency: 'EUR' })]])}
      />,
    );
    expect(screen.getByText('Curs folosit: 1 EUR = 4,97 lei.')).toBeTruthy();
  });

  it('totalul in lei cu TVA e totalWithVat de la server (aceeasi suma ca pe card)', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          // serverul rotunjeste pe Decimal; tabelul nu recalculeaza din priceWithVat + designFee
          ['s1', structured('s1', 1000, { currency: 'EUR', vatMode: 'VAT_EXCLUDED', designFee: 200, designIncludes: 'Plan', version: { totalWithVat: 1452.01 } })],
          ['s2', structured('s2', 9000, { designFee: 300, designIncludes: 'Randări' })],
        ])}
      />,
    );
    // 1.452,01 EUR × 4,97 = 7.216,49 lei
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toContain('7.216 lei');
    expect(cellOf('Total în lei, cu TVA', 1).textContent).toBe('9.300 lei');
    expect(cellOf('Proiectare', 0).textContent).toContain('200 EUR');
    expect(cellOf('Proiectare', 0).textContent).toContain('≈ 994 lei');
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 0));
  });

  it('6 saptamani si 30 de zile lucratoare ies egale: fara cel mai rapid', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 13900, { weeks: 6 })],
          ['s2', structured('s2', 11450, { workingDays: 30 })],
        ])}
      />,
    );
    expect(cellOf('Termen', 0).textContent).toContain('6 săptămâni');
    expect(cellOf('Termen', 0).textContent).toContain('adică 30 de zile lucrătoare');
    expect(cellOf('Termen', 1).textContent).toContain('30 de zile lucrătoare');
    expect(screen.queryByText('cel mai rapid')).toBeNull();
  });

  it('cel mai rapid se calculeaza pe zilele lucratoare', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 13900, { weeks: 6 })],
          ['s2', structured('s2', 11450, { workingDays: 35 })],
        ])}
      />,
    );
    expect(screen.getByText('cel mai rapid').closest('td')).toBe(cellOf('Termen', 0));
  });

  it('oferta veche langa una noua: textul liber, „—” la calcul, insigna doar daca e sigura', () => {
    const { unmount } = wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Veche'), thread('t2', 's2', 'Noua')]}
        quoteByClaim={new Map([
          ['s1', quote('s1', 15000)],
          ['s2', structured('s2', 18500, { workingDays: 20 })],
        ])}
      />,
    );
    expect(cellOf('Preț', 0).textContent).toBe('15.000 lei');
    expect(cellOf('TVA', 0).textContent).toBe('—');
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toContain('—');
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toContain('oferta nu spune dacă are TVA');
    expect(cellOf('Termen', 0).textContent).toBe('6 săptămâni');
    expect(cellOf('Garanție', 0).textContent).toBe('24 luni');
    expect(cellOf('Transport', 0).textContent).toBe('—');
    // 18.500 cu TVA nu e sigur mai ieftin decat 15.000 (TVA necunoscut) → fara insigna;
    // termenul vechi nu se poate compara → fara cel mai rapid
    expect(screen.queryByText('cel mai mic')).toBeNull();
    expect(screen.queryByText('cel mai rapid')).toBeNull();
    unmount();

    // oferta veche de 20.000 (cu TVA ar fi cel putin 20.000) → noua e sigur mai ieftina
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Veche'), thread('t2', 's2', 'Noua')]}
        quoteByClaim={new Map([
          ['s1', quote('s1', 20000)],
          ['s2', structured('s2', 18500)],
        ])}
      />,
    );
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 1));
  });

  it('oferta refuzata ramane in tabel cu starea ei, dar nu intra in insigne', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B'), thread('t3', 's3', 'C')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 9000, { status: 'DECLINED', workingDays: 10 })],
          ['s2', structured('s2', 12000, { workingDays: 30 })],
          ['s3', structured('s3', 11000, { workingDays: 40 })],
        ])}
      />,
    );
    expect(cellOf('Valabilitate', 0).textContent).toBe('Refuzată');
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 2));
    expect(screen.getByText('cel mai rapid').closest('td')).toBe(cellOf('Termen', 1));
  });

  it('la proiectarea cu plata: rubrica de proiectare, iar totalul cu TVA o include', () => {
    const { container } = wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 10000, { vatMode: 'VAT_EXCLUDED', designFee: 1000, designIncludes: 'Randări 3D' })],
          ['s2', structured('s2', 13000, { designFee: 500, designIncludes: 'Plan tehnic' })],
        ])}
      />,
    );
    expect(rowHeads(container)).toContain('Proiectare');
    expect(cellOf('Proiectare', 0).textContent).toContain('1.000 lei');
    expect(cellOf('Proiectare', 0).textContent).toContain('Randări 3D');
    // (10.000 + 1.000) × 1,21 = 13.310 lei; 13.000 + 500 = 13.500 lei
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toContain('13.310 lei');
    expect(cellOf('Total în lei, cu TVA', 1).textContent).toBe('13.500 lei');
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 0));
  });

  it('cu onSelect actiunile sunt butoane, iar coloana firmei deschise e marcata', () => {
    const onSelect = vi.fn();
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 13900)],
          ['s2', structured('s2', 11450)],
        ])}
        selectedClaimSlotId="s1"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deschisă mai jos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vezi și alege' }));
    expect(onSelect).toHaveBeenCalledWith('s2');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('firma fara oferta apare ca „in lucru”, cu link spre conversatie', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B'), thread('t3', 's3', 'Firma C')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 13900)],
          ['s2', structured('s2', 11450)],
        ])}
      />,
    );
    expect(screen.getByText('ofertă în lucru')).toBeTruthy();
    expect(screen.getByText('Vezi conversația').getAttribute('href')).toBe('#firm-s3');
    expect(screen.getAllByText('Vezi și alege')).toHaveLength(2);
    expect(screen.getByText('cel mai mic').closest('td')?.textContent).toContain('11.450');
  });

  it('arata mesajele noi in capul coloanei firmei', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B', 2)]}
        quoteByClaim={new Map([['s1', quote('s1', 13900)]])}
      />,
    );
    expect(screen.getByText('2 mesaje noi').closest('th')?.textContent).toContain('Firma B');
  });

  it('fara eticheta cand totalurile minime sunt egale', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 5000)],
          ['s2', structured('s2', 5000)],
        ])}
      />,
    );
    expect(screen.queryByText('cel mai mic')).toBeNull();
  });

  it('m5: 18.500,40 si 18.500,10 lei arata la fel, deci fara cel mai mic', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 18500.4)],
          ['s2', structured('s2', 18500.1)],
        ])}
      />,
    );
    expect(cellOf('Total în lei, cu TVA', 0).textContent).toBe('18.500 lei');
    expect(cellOf('Total în lei, cu TVA', 1).textContent).toBe('18.500 lei');
    expect(screen.queryByText('cel mai mic')).toBeNull();
  });

  it('m6: oferta trimisa cu valabilitatea trecuta nu primeste insigne', () => {
    const expired = (q: QuoteDto): QuoteDto => ({
      ...q,
      versions: q.versions.map((v) => ({ ...v, isExpired: true, validUntil: new Date(Date.now() - 86400000).toISOString() })),
    });
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B'), thread('t3', 's3', 'C')]}
        quoteByClaim={new Map([
          // cea mai ieftina si cea mai rapida, dar expirata
          ['s1', expired(structured('s1', 9000, { workingDays: 10 }))],
          ['s2', structured('s2', 12000, { workingDays: 30 })],
          ['s3', structured('s3', 11000, { workingDays: 40 })],
        ])}
      />,
    );
    expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 2));
    expect(screen.getByText('cel mai rapid').closest('td')).toBe(cellOf('Termen', 1));
  });

  it('m7: fara curs pozitiv, oferta in euro are „—” la total, fara insigna si fara nota cu cursul', () => {
    for (const eurRonRate of [0, -2, undefined as unknown as number]) {
      const eur = structured('s1', 3000, { currency: 'EUR' });
      const { unmount } = wrap(
        <OffersComparison
          threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B'), thread('t3', 's3', 'C')]}
          quoteByClaim={new Map([
            ['s1', { ...eur, eurRonRate }],
            ['s2', structured('s2', 18500)],
            ['s3', structured('s3', 19000)],
          ])}
        />,
      );
      expect(cellOf('Total în lei, cu TVA', 0).textContent).toBe('—');
      expect(cellOf('Preț', 0).textContent).toBe('3.000 EUR');
      expect(screen.queryByText('0 lei')).toBeNull();
      expect(screen.queryByText(/Curs folosit/)).toBeNull();
      expect(screen.getByText('cel mai mic').closest('td')).toBe(cellOf('Total în lei, cu TVA', 1));
      unmount();
    }
  });
});

describe('LandingCompareDemo (exemplul de pe prima pagina)', () => {
  it('are aceleasi rubrici, in aceeasi ordine, ca tabelul real', () => {
    const real = wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          ['s1', structured('s1', 13900)],
          ['s2', structured('s2', 11450)],
        ])}
      />,
    );
    const realRows = rowHeads(real.container);
    real.unmount();
    const demo = wrap(<LandingCompareDemo />);
    expect(rowHeads(demo.container)).toEqual(realRows);
  });

  it('cel mai mic e pe totalul cu TVA, nu pe pretul de pornire', () => {
    wrap(<LandingCompareDemo />);
    expect(screen.getByText('cel mai mic').closest('td')?.textContent).toContain('12.900 lei');
    expect(screen.getByText('cel mai rapid').closest('td')?.textContent).toContain('6 săptămâni');
  });
});

describe('RequestJourney', () => {
  it('evidentiaza pasul curent', () => {
    wrap(<RequestJourney status="OFFERS_RECEIVED" />);
    expect(screen.getByText('Oferte primite').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Publicată').closest('li')?.getAttribute('aria-current')).toBeNull();
  });

  it('dispare pentru cererile iesite din drum', () => {
    const { container } = wrap(<RequestJourney status="CANCELLED" />);
    expect(container.textContent).toBe('');
  });
});

describe('UnreadBanner', () => {
  it('listeaza doar firmele cu mesaje noi', () => {
    wrap(<UnreadBanner threads={[thread('t1', 's1', 'Firma A', 2), thread('t2', 's2', 'Firma B')]} />);
    expect(screen.getByText('Firma A ți-a scris: 2 mesaje noi').closest('a')?.getAttribute('href')).toBe('#firm-s1');
    expect(screen.queryByText(/Firma B/)).toBeNull();
  });
});

// j1 (etapa 8): sub 640 px tabelul devine carduri pe rubrica, cu aceleasi valori
describe('OffersComparison — cards on phones (etapa 8)', () => {
  const setPhone = (on: boolean) => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: on && query === '(max-width: 639.98px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };
  afterEach(() => setPhone(false));

  const cases: [string, ChatThreadDto[], Map<string, QuoteDto>][] = [
    [
      '2 oferte (euro fara TVA langa lei)',
      [thread('t1', 's1', 'Firma A', 2), thread('t2', 's2', 'Firma B')],
      new Map([
        ['s1', structured('s1', 3900, { currency: 'EUR', vatMode: 'VAT_EXCLUDED' })],
        ['s2', structured('s2', 18500, { vatMode: 'VAT_INCLUDED', workingDays: 20 })],
      ]),
    ],
    [
      '3 oferte (cu proiectare, una refuzata, una in lucru)',
      [thread('t1', 's1', 'Firma A'), thread('t2', 's2', 'Firma B'), thread('t3', 's3', 'Firma C'), thread('t4', 's4', 'Firma D')],
      new Map([
        ['s1', structured('s1', 10000, { designFee: 1500, designIncludes: 'Randări 3D' })],
        ['s2', structured('s2', 9000, { status: 'DECLINED' })],
        ['s3', structured('s3', 12000, { weeks: 4 })],
      ]),
    ],
  ];

  it.each(cases)('%s: every rubric card has exactly the values of the table', (_name, threads, quotes) => {
    // desktop: tabelul
    const desk = wrap(<OffersComparison threads={threads} quoteByClaim={quotes} selectedClaimSlotId="s1" onSelect={() => {}} />);
    const tableRubrics = rowHeads(desk.container);
    const tableValues = tableRubrics.map((rubric) =>
      within(screen.getByText(rubric, { selector: 'th' }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent),
    );
    const tableActions = desk.container.querySelectorAll('tbody tr:last-child td').length;
    desk.unmount();

    // telefon: cardurile, fara tabel
    setPhone(true);
    const phone = wrap(<OffersComparison threads={threads} quoteByClaim={quotes} selectedClaimSlotId="s1" onSelect={() => {}} />);
    expect(phone.container.querySelector('table')).toBeNull();
    const cards = Array.from(phone.container.querySelectorAll<HTMLElement>('[data-compare-rubric]'));
    const rubricCards = cards.filter((c) => c.dataset.compareRubric !== 'actions');
    expect(rubricCards.map((c) => c.querySelector('h3')?.textContent)).toEqual(tableRubrics);
    rubricCards.forEach((card, i) => {
      expect(Array.from(card.querySelectorAll('dt')).map((d) => d.textContent)).toEqual(threads.map((th) => th.companyName));
      expect(Array.from(card.querySelectorAll('dd')).map((d) => d.textContent)).toEqual(tableValues[i]);
    });
    // ultimul card: actiunea fiecarei firme, o singura data
    const actions = cards.find((c) => c.dataset.compareRubric === 'actions')!;
    expect(actions.querySelector('h3')?.textContent).toBe(ro.Quotes.compare.actionsTitle);
    expect(within(actions).getAllByRole('listitem')).toHaveLength(tableActions);
    expect(screen.getAllByRole('button', { name: ro.Quotes.compare.openedBelow })).toHaveLength(1);
  });

  it('the badges and the unread pill stay on the phone cards', () => {
    setPhone(true);
    wrap(<OffersComparison threads={cases[0][1]} quoteByClaim={cases[0][2]} />);
    const total = document.querySelector<HTMLElement>('[data-compare-rubric="totalLeiVat"]')!;
    expect(within(total).getByText('cel mai mic').closest('dd')?.textContent).toContain('18.500 lei');
    const actions = document.querySelector<HTMLElement>('[data-compare-rubric="actions"]')!;
    expect(within(actions).getByText('2 mesaje noi').closest('li')?.textContent).toContain('Firma A');
    expect(screen.getByText(/1 EUR = 4,97 lei/)).toBeTruthy();
  });
});
