import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json';
import EditRequestPage from './page';

// Garda paginii de editare: aceeasi regula ca butonul "Editeaza" de pe pagina cererii — o cerere
// care nu mai poate fi editata (oferte primite, editari consumate) nu deschide editorul.
const state = vi.hoisted(() => ({
  query: { isPending: false, data: undefined as unknown, isError: false },
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'req-1' }) }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/hooks/use-requests', () => ({ useRequest: () => state.query }));
vi.mock('@/components/configurator/configurator-wizard', () => ({
  ConfiguratorWizard: ({ editId, repost }: { editId: string; repost?: boolean }) => (
    <div data-testid="wizard" data-repost={repost ? 'yes' : 'no'}>{editId}</div>
  ),
}));

// f6-2: repostUsed implicit true — o cerere expirata deja republicata nu se mai poate edita
const req = (status: string, pre = 0, post = 0, repostUsed = true) => ({ id: 'req-1', status, preClaimEditsUsed: pre, postClaimEditsUsed: post, repostUsed });
const view = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EditRequestPage />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  state.query = { isPending: false, data: undefined, isError: false };
});

describe('edit page guard', () => {
  it.each(['OFFERS_RECEIVED', 'NEGOTIATION', 'ACCEPTED', 'EXPIRED', 'DRAFT'])(
    '%s → the same "cannot be edited" message and a link back, not the editor',
    (status) => {
      state.query = { isPending: false, data: req(status), isError: false };
      view();
      expect(screen.getByText(en.Requests.edits.locked)).toBeTruthy();
      expect(screen.getByRole('link', { name: `← ${en.Requests.backToRequest}` }).getAttribute('href')).toBe('/requests/req-1');
      expect(screen.queryByTestId('wizard')).toBeNull();
    },
  );

  it('all edits used → "no edits left", no editor', () => {
    state.query = { isPending: false, data: req('IN_MARKETPLACE', 3), isError: false };
    view();
    expect(screen.getByText(en.Requests.edits.noneLeft)).toBeTruthy();
    expect(screen.queryByTestId('wizard')).toBeNull();
  });

  it.each([
    ['IN_MARKETPLACE', 2, 0],
    ['CLAIMED_PARTIAL', 3, 0],
    ['CLAIMED_FULL', 0, 0],
  ])('%s with edits left → the editor', (status, pre, post) => {
    state.query = { isPending: false, data: req(status, pre, post), isError: false };
    view();
    expect(screen.getByTestId('wizard').textContent).toBe('req-1');
  });

  it('saving the last edit does not swap the editor out before the redirect', () => {
    state.query = { isPending: false, data: req('CLAIMED_PARTIAL', 0, 0), isError: false };
    const v = view();
    state.query = { isPending: false, data: req('CLAIMED_PARTIAL', 0, 1), isError: false };
    v.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <EditRequestPage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('wizard')).toBeTruthy();
  });

  it('an error is left to the editor (it handles missing / not yours / session)', () => {
    state.query = { isPending: false, data: undefined, isError: true };
    view();
    expect(screen.getByTestId('wizard')).toBeTruthy();
  });

  // f6-2: „Republica cu modificari” — cererea expirata cu republicarea nefolosita deschide formularul
  it('EXPIRED with the repost unused → the editor in repost mode', () => {
    state.query = { isPending: false, data: req('EXPIRED', 3, 1, false), isError: false };
    view();
    expect(screen.getByTestId('wizard').getAttribute('data-repost')).toBe('yes');
  });

  it('a normal edit is not in repost mode', () => {
    state.query = { isPending: false, data: req('IN_MARKETPLACE', 0, 0, false), isError: false };
    view();
    expect(screen.getByTestId('wizard').getAttribute('data-repost')).toBe('no');
  });
});
