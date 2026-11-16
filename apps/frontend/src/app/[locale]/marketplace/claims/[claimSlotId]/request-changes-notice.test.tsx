import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../../messages/ro.json';
import en from '../../../../../messages/en.json';

// e3 (etapa 9): caseta firmei „Cererea a fost modificata pe … — ce s-a schimbat”.

const hoisted = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: hoisted.data }),
}));

import { RequestChangesNotice, type ClaimRequestEditDto } from './request-changes-notice';

function renderNotice(data: ClaimRequestEditDto | null, locale: 'ro' | 'en' = 'ro') {
  hoisted.data = data;
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <RequestChangesNotice claimSlotId="s1" />
    </NextIntlClientProvider>,
  );
}

const edit = (over: Partial<NonNullable<ClaimRequestEditDto['edit']>> = {}): ClaimRequestEditDto => ({
  edit: { editedAt: '2026-11-12T08:00:00.000Z', comparable: true, fields: [], rooms: [], ...over },
});

describe('RequestChangesNotice (e3)', () => {
  it('fara editare dupa preluare → nimic', () => {
    expect(renderNotice({ edit: null }).container.textContent).toBe('');
    expect(renderNotice(null).container.textContent).toBe('');
  });

  it('data editarii, campurile generale si camerele adaugate / scoase / modificate', () => {
    renderNotice(
      edit({
        fields: ['budget', 'description', 'location'],
        rooms: [
          { change: 'ADDED', roomType: 'LIVING', ordinal: 1, ofType: 1, detailed: true, aspects: [] },
          { change: 'MODIFIED', roomType: 'BEDROOM', ordinal: 2, ofType: 2, detailed: true, aspects: ['answers'] },
          { change: 'REMOVED', roomType: 'KITCHEN', ordinal: 1, ofType: 1, detailed: true, aspects: [] },
        ],
      }),
    );
    expect(screen.getByRole('heading', { name: 'Cererea a fost modificată pe 12 noiembrie 2026' })).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      'Bugetul',
      ro.Requests.field.message,
      'Localitatea',
      `Cameră adăugată: ${ro.Configurator.rooms.type.LIVING}`,
      `${ro.Configurator.rooms.type.BEDROOM} 2 a fost modificată: răspunsurile din formular`,
      `Cameră scoasă: ${ro.Configurator.rooms.type.KITCHEN}`,
    ]);
  });

  it('camera fara comparatie sigura → doar „a fost modificata”, fara detalii', () => {
    renderNotice(edit({ rooms: [{ change: 'MODIFIED', roomType: 'KITCHEN', ordinal: 1, ofType: 1, detailed: false, aspects: [] }] }));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `${ro.Configurator.rooms.type.KITCHEN} a fost modificată`,
    ]);
  });

  it('copii necomparabile → mesajul fara detalii; nimic vizibil schimbat → spune asta', () => {
    renderNotice(edit({ comparable: false }));
    expect(screen.getByText(ro.Quotes.requestChanges.notComparable)).toBeTruthy();
    renderNotice(edit());
    expect(screen.getByText(ro.Quotes.requestChanges.nothingVisible)).toBeTruthy();
  });

  it('in engleza', () => {
    renderNotice(edit({ fields: ['deadline'] }), 'en');
    expect(screen.getByRole('heading', { name: 'The request was changed on November 12, 2026' })).toBeTruthy();
    expect(screen.getByText('Desired timeframe')).toBeTruthy();
  });
});
