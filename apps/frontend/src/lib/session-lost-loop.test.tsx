import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ro from '@/messages/ro.json';
import MarketplacePage from '@/app/[locale]/marketplace/page';
import CompanyClaimsPage from '@/app/[locale]/marketplace/claims/page';
import CompanyClaimPage from '@/app/[locale]/marketplace/claims/[claimSlotId]/page';
import RequestOffersPage from '@/app/[locale]/requests/[id]/offers/page';
import AdminWithdrawalsPage from '@/app/[locale]/admin/withdrawals/page';
import WalletPage from '@/app/[locale]/marketplace/wallet/page';
import MyRequestsPage from '@/app/[locale]/requests/page';
import { useMe } from '@/hooks/use-auth';
import { api } from './api';
import { SessionHintProvider } from './session-hint-context';
import { SessionLostListener } from './session-lost-listener';
import { AUTH_QUERY_KEY, resetSessionLostForTests } from './session-lost';

// Defect D1 (verificarea din browser, etapele 4-5): cu sesiunea pierduta, /marketplace si
// /marketplace/claims ramaneau pe „Se incarca…” si loveau serverul in bucla (~4.900 cereri / 60 s).
// Paginile reale + hook-urile reale + ascultatorul global; doar `fetch` e simulat si numarat.
const state = vi.hoisted(() => ({ pathname: '/marketplace', replace: (() => {}) as (href: string) => void }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: (href: string) => state.replace(href), push: vi.fn() }),
}));
// socketul nu are server in teste
vi.mock('@/hooks/use-socket', () => ({ useRealtimeSync: () => {} }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => ({ id: 'r1', claimSlotId: 'c1' }),
  useSearchParams: () => new URLSearchParams(),
}));

type Server = 'noCookies' | 'staleRefresh';
let calls: string[] = [];

// de cate ori a fost chemata cea mai chemata cale (bucla = zeci / sute)
function maxPerPath(): number {
  const n = new Map<string, number>();
  for (const p of calls) n.set(p, (n.get(p) ?? 0) + 1);
  return Math.max(0, ...n.values());
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// (a) cookie-urile sterse: /auth/me → 200 { user: null }, restul 401;
// (b) cookie de reimprospatare prezent dar nevalid: /auth/me → 401, /auth/refresh → 401.
function mockServer(kind: Server) {
  calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const path = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    calls.push(path);
    if (path === '/auth/me') {
      return kind === 'noCookies'
        ? json(200, { user: null })
        : json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } });
    }
    return json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } });
  });
}

async function renderPage(page: ReactNode, opts: { pathname: string; cachedMe?: boolean }) {
  state.pathname = opts.pathname;
  window.history.replaceState(null, '', `/ro${opts.pathname}`);
  // aceleasi optiuni implicite ca providers.tsx
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
  if (opts.cachedMe) qc.setQueryData(AUTH_QUERY_KEY, { id: 'u1', role: 'COMPANY_USER', email: 'b@demo.ro', name: 'B' });
  render(
    <QueryClientProvider client={qc}>
      <SessionHintProvider initialRole="COMPANY_USER">
        <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
          {page}
        </NextIntlClientProvider>
      </SessionHintProvider>
      <SessionLostListener />
    </QueryClientProvider>,
  );
  // cat ar dura sute de cicluri de bucla cu un `fetch` care raspunde imediat
  await act(() => new Promise((r) => setTimeout(r, 600)));
  return qc;
}

const PAGES = [
  { name: '/marketplace', pathname: '/marketplace', page: () => <MarketplacePage /> },
  { name: '/marketplace/claims', pathname: '/marketplace/claims', page: () => <CompanyClaimsPage /> },
];

describe('sesiune pierduta pe paginile firmei: fara bucla de cereri, login cu intoarcere', () => {
  let replace: Mock<(href: string) => void>;
  beforeEach(() => {
    resetSessionLostForTests();
    replace = vi.fn<(href: string) => void>();
    state.replace = replace;
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  for (const { name, pathname, page } of PAGES) {
    for (const server of ['noCookies', 'staleRefresh'] as const) {
      it(`${name}, ${server}: cel mult o incercare per interogare, apoi /login?redirect&reason=expired`, async () => {
        mockServer(server);
        await renderPage(page(), { pathname });
        // fiecare interogare a paginii: prima cerere + cel mult o reluare dupa golirea facuta de
        // ascultator (cand /auth/me a primit 401); masurat: 4-9 cereri. Bucla facea 300-800 aici.
        expect(calls.length).toBeLessThanOrEqual(12);
        expect(maxPerPath()).toBeLessThanOrEqual(2);
        expect(replace).toHaveBeenCalled();
        expect(replace).toHaveBeenLastCalledWith(`/login?redirect=${encodeURIComponent(pathname)}&reason=expired`);
        // nu chema redirectul la nesfarsit (fiecare apel ar reporni navigarea)
        expect(replace.mock.calls.length).toBeLessThanOrEqual(3);
      });
    }

    it(`${name}: sesiunea scoasa in timpul folosirii („cine sunt eu” in cache) → fara bucla`, async () => {
      mockServer('noCookies');
      await renderPage(page(), { pathname, cachedMe: true });
      // masurat: fiecare interogare de cont = prima cerere + reluarea de dupa golire (9-15 cereri)
      expect(calls.length).toBeLessThanOrEqual(16);
      expect(maxPerPath()).toBeLessThanOrEqual(2);
      expect(replace).toHaveBeenLastCalledWith(`/login?redirect=${encodeURIComponent(pathname)}&reason=expired`);
      expect(replace.mock.calls.length).toBeLessThanOrEqual(3);
    });
  }

  // f4 („Gata cand”): linkurile din e-mail deschise intr-o fereastra privata (vizitator, fara
  // niciun cookie) → login cu intoarcere exact pe pagina din link, fara „Nu am putut incarca datele”
  it.each([
    ['„Vezi oferta”', '/requests/r1/offers', () => <RequestOffersPage />],
    ['„Deschide lucrarea”', '/marketplace/claims/c1', () => <CompanyClaimPage />],
  ])('%s fara sesiune → /login?redirect=<pagina>, fara eroare falsa', async (_label, pathname, page) => {
    // vizitatorul nu are indiciul de sesiune: fara SessionHintProvider cu rol
    calls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input).replace(/^.*\/api\/v1/, '').split('?')[0];
      calls.push(path);
      return path === '/auth/me' ? json(200, { user: null }) : json(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } });
    });
    state.pathname = pathname;
    window.history.replaceState(null, '', `/ro${pathname}`);
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
          {page()}
        </NextIntlClientProvider>
        <SessionLostListener />
      </QueryClientProvider>,
    );
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(replace).toHaveBeenLastCalledWith(`/login?redirect=${encodeURIComponent(pathname)}`);
    expect(screen.queryByText(ro.Common.loadState.errorTitle)).toBeNull();
    expect(screen.queryByText(ro.Access.claimNotYours)).toBeNull();
    expect(screen.queryByText(ro.Access.requestNotYours)).toBeNull();
    expect(maxPerPath()).toBeLessThanOrEqual(2);
  });

  // f4 (dupa integrare): o pagina de admin si portofelul — fara sesiune → login cu intoarcere;
  // cont cu alt rol → ecranul de acces, fara salt tacut pe Panou
  const ROLE_PAGES = [
    { name: '/admin/withdrawals', pathname: '/admin/withdrawals', role: 'ADMIN' as const, other: 'CLIENT', page: () => <AdminWithdrawalsPage /> },
    { name: '/marketplace/wallet', pathname: '/marketplace/wallet', role: 'COMPANY_USER' as const, other: 'CLIENT', page: () => <WalletPage /> },
    // review m8: „Cererile mele” pe garda comuna
    { name: '/requests', pathname: '/requests', role: 'CLIENT' as const, other: 'COMPANY_USER', page: () => <MyRequestsPage /> },
  ];
  for (const { name, pathname, role, other, page } of ROLE_PAGES) {
    it(`${name}: fara sesiune → /login?redirect=<pagina>`, async () => {
      mockServer('noCookies');
      await renderPage(page(), { pathname });
      expect(replace).toHaveBeenLastCalledWith(`/login?redirect=${encodeURIComponent(pathname)}&reason=expired`);
      expect(maxPerPath()).toBeLessThanOrEqual(2);
    });

    it(`${name}: cont ${other} → „${ro.Access.onlyFor[role]}”, fara redirect`, async () => {
      calls = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const path = String(input).replace(/^.*\/api\/v1/, '').split('?')[0];
        calls.push(path);
        if (path === '/auth/me') return json(200, { user: { id: 'u9', role: other, email: 'x@demo.ro', name: 'X' } });
        return json(403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });
      });
      await renderPage(page(), { pathname });
      expect(screen.getByRole('alert')).toHaveTextContent(ro.Access.onlyFor[role]);
      expect(replace).not.toHaveBeenCalled();
    });
  }

  // review M1: tabul ramas „vizitator” (me in eroare) afla de login-ul facut in alt tab la
  // revenirea in tab — o singura cerere; cu sesiune buna, revenirea nu cere nimic
  function MeProbe() {
    const me = useMe();
    return <p>{me.data ? `cont:${me.data.role}` : me.isError ? 'vizitator' : '…'}</p>;
  }
  const backToTab = () => act(() => void window.dispatchEvent(new Event('visibilitychange')));

  it('M1: eroare → revenire in tab → o singura cerere /auth/me → omul apare autentificat', async () => {
    calls = [];
    let loggedInElsewhere = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input).replace(/^.*\/api\/v1/, '').split('?')[0];
      calls.push(path);
      if (path === '/auth/me') {
        return json(200, { user: loggedInElsewhere ? { id: 'u1', role: 'CLIENT', email: 'a@demo.ro', name: 'A' } : null });
      }
      return json(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } });
    });
    await renderPage(<MeProbe />, { pathname: '/' });
    expect(screen.getByText('vizitator')).toBeInTheDocument();
    expect(calls.filter((p) => p === '/auth/me')).toHaveLength(1);
    // login in alt tab (confirmarea e-mailului), apoi revenire aici
    loggedInElsewhere = true;
    backToTab();
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls.filter((p) => p === '/auth/me')).toHaveLength(2);
    expect(screen.getByText('cont:CLIENT')).toBeInTheDocument();
    // autentificat: alte reveniri in tab nu mai cer nimic (fara bucla, fara cereri in plus)
    backToTab();
    backToTab();
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls.filter((p) => p === '/auth/me')).toHaveLength(2);
  });

  it('M1: tot vizitator → fiecare revenire in tab = cel mult o cerere, nimic intre reveniri', async () => {
    mockServer('noCookies');
    await renderPage(<MeProbe />, { pathname: '/' });
    backToTab();
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(calls.filter((p) => p === '/auth/me')).toHaveLength(2);
    expect(screen.getByText('vizitator')).toBeInTheDocument();
  });

  // Formularul public (/requests/new) cu cookie-uri vechi: cererea publica primeste 401 cat
  // timp cookie-ul de acces vechi e trimis; reimprospatarea esuata il sterge (Set-Cookie), iar
  // reluarea facuta de ascultator reuseste ca vizitator. Fara reluare, pagina ramanea pe
  // „Se pregateste…” (testul e2e account-offers.spec.ts acopera pagina reala).
  it('pagina publica cu sesiune expirata: se incarca o data ca pentru vizitator, fara redirect si fara bucla', async () => {
    calls = [];
    let staleCookies = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input).replace(/^.*\/api\/v1/, '').split('?')[0];
      calls.push(path);
      if (path === '/auth/refresh') {
        staleCookies = false;
        return json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } });
      }
      if (staleCookies) return json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } });
      if (path === '/auth/me') return json(200, { user: null });
      return json(200, { id: 'draft-1' });
    });
    function PublicForm() {
      const me = useMe();
      const draft = useQuery({ queryKey: ['requests', 'draft', 't1'], queryFn: () => api<{ id: string }>('/requests/draft/t1'), retry: false });
      return (
        <p>
          {draft.isSuccess ? `gata:${draft.data.id}` : 'se pregateste'} {me.isError ? 'vizitator' : me.isPending ? '…' : 'cont'}
        </p>
      );
    }
    await renderPage(<PublicForm />, { pathname: '/requests/new' });
    expect(screen.getByText(/gata:draft-1/)).toBeInTheDocument();
    expect(screen.getByText(/vizitator/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(calls.length).toBeLessThanOrEqual(8);
  });
});
