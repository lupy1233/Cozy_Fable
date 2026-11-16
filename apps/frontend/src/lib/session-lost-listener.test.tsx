import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLostListener } from './session-lost-listener';
import { AUTH_QUERY_KEY, isAccountPath, resetSessionLostForTests, sessionLostTarget, signalSessionLost } from './session-lost';
import { useLoginRedirect } from './use-login-redirect';

// f3: la semnalul global, de pe o pagina cu cont → login cu intoarcere si reason=expired;
// de pe o pagina publica sau de pe /login → fara redirect.
const state = vi.hoisted(() => ({ pathname: '/dashboard', replace: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
}));

function setup(opts: { pathname: string; loggedIn?: boolean; search?: string }) {
  state.pathname = opts.pathname;
  window.history.replaceState(null, '', `/ro${opts.pathname}${opts.search ?? ''}`);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (opts.loggedIn !== false) qc.setQueryData(AUTH_QUERY_KEY, { id: 'u1', role: 'CLIENT' });
  qc.setQueryData(['requests', 'mine'], [{ id: 'r1' }]);
  const view = render(
    <QueryClientProvider client={qc}>
      <SessionLostListener />
    </QueryClientProvider>,
  );
  // navigare in aplicatie: alta pagina, acelasi ascultator montat
  const navigate = (pathname: string) => {
    state.pathname = pathname;
    window.history.replaceState(null, '', `/ro${pathname}`);
    view.rerender(
      <QueryClientProvider client={qc}>
        <SessionLostListener />
      </QueryClientProvider>,
    );
  };
  return Object.assign(qc, { navigate });
}

describe('SessionLostListener', () => {
  beforeEach(() => {
    resetSessionLostForTests();
    state.replace.mockReset();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('review M1: semnalul cererii paginii sosit inaintea lui /auth/me nu mai pierde redirectul', () => {
    setup({ pathname: '/requests/abc', loggedIn: false });
    // „cine sunt eu” inca nu e in cache → ignorat, fara fereastra
    act(() => signalSessionLost({ source: 'api', path: '/requests/abc' }));
    expect(state.replace).not.toHaveBeenCalled();
    act(() => signalSessionLost({ source: 'api', path: '/auth/me' }));
    expect(state.replace).toHaveBeenCalledTimes(1);
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Frequests%2Fabc&reason=expired');
    // dupa actiune, fereastra de 5 s strange semnalele simultane
    act(() => signalSessionLost({ source: 'socket' }));
    expect(state.replace).toHaveBeenCalledTimes(1);
  });

  it('review m4: golirea fara redirect de pe o pagina publica nu inghite semnalul urmator', () => {
    const qc = setup({ pathname: '/inspiration' });
    act(() => signalSessionLost({ source: 'api', path: '/inspiration/pins' }));
    expect(state.replace).not.toHaveBeenCalled();
    qc.navigate('/requests/abc');
    act(() => signalSessionLost({ source: 'api', path: '/auth/me' }));
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Frequests%2Fabc&reason=expired');
  });

  it('pagina cu cont → router.replace(/login?redirect=<pagina>&reason=expired) si golirea datelor contului', () => {
    const qc = setup({ pathname: '/requests/abc', search: '?tab=offers' });
    act(() => signalSessionLost({ source: 'api', path: '/requests/abc' }));
    expect(state.replace).toHaveBeenCalledTimes(1);
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Frequests%2Fabc%3Ftab%3Doffers&reason=expired');
    expect(qc.getQueryData(['requests', 'mine'])).toBeUndefined();
    expect(qc.getQueryData(AUTH_QUERY_KEY)).toBeUndefined();
  });

  it('semnalul de pe socket (alt dispozitiv) duce la fel la login', () => {
    setup({ pathname: '/marketplace/claims' });
    act(() => signalSessionLost({ source: 'socket' }));
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Fmarketplace%2Fclaims&reason=expired');
  });

  it('pagina publica → fara redirect, dar datele contului se golesc', () => {
    const qc = setup({ pathname: '/inspiration' });
    act(() => signalSessionLost({ source: 'api', path: '/inspiration/pins' }));
    expect(state.replace).not.toHaveBeenCalled();
    expect(qc.getQueryData(['requests', 'mine'])).toBeUndefined();
  });

  it('pe /login → fara redirect (fara bucla)', () => {
    setup({ pathname: '/login' });
    act(() => signalSessionLost({ source: 'api', path: '/notifications' }));
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('vizitator fara sesiune → nici redirect, nici golire', () => {
    const qc = setup({ pathname: '/dashboard', loggedIn: false });
    act(() => signalSessionLost({ source: 'socket' }));
    expect(state.replace).not.toHaveBeenCalled();
    expect(qc.getQueryData(['requests', 'mine'])).toEqual([{ id: 'r1' }]);
  });

  it('401 chiar pe /auth/me dovedeste sesiunea (cookie-uri vechi) → login', () => {
    setup({ pathname: '/dashboard', loggedIn: false });
    act(() => signalSessionLost({ source: 'api', path: '/auth/me' }));
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Fdashboard&reason=expired');
  });
});

describe('isAccountPath / sessionLostTarget', () => {
  it('deosebeste paginile cu cont de cele publice', () => {
    for (const p of ['/dashboard', '/requests', '/requests/x/edit', '/company', '/marketplace/x', '/admin/users', '/inspiration/boards/b1', '/change-password']) {
      expect(isAccountPath(p)).toBe(true);
    }
    for (const p of ['/', '/inspiration', '/partners', '/studio', '/terms', '/privacy', '/firm-rules', '/requests/new', '/login', '/register', '/reset-password', '/companyx']) {
      expect(isAccountPath(p)).toBe(false);
    }
  });

  it('adresa de intoarcere nesigura nu se propaga', () => {
    expect(sessionLostTarget('/dashboard//evil.com')).toBe('/login?reason=expired');
    expect(sessionLostTarget('/terms')).toBeNull();
  });
});

describe('useLoginRedirect (review M2: garda paginilor)', () => {
  beforeEach(() => {
    resetSessionLostForTests();
    state.replace.mockReset();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('dupa ascultator, garda duce la aceeasi tinta (intoarcere + reason=expired), nu la /login gol', () => {
    setup({ pathname: '/marketplace/claims/c1', search: '?tab=chat' });
    act(() => signalSessionLost({ source: 'socket' }));
    const listenerTarget = state.replace.mock.calls[0][0];
    const { result } = renderHook(() => useLoginRedirect());
    act(() => result.current());
    expect(state.replace).toHaveBeenLastCalledWith(listenerTarget);
    expect(listenerTarget).toBe('/login?redirect=%2Fmarketplace%2Fclaims%2Fc1%3Ftab%3Dchat&reason=expired');
  });

  it('vizitator fara sesiune: intoarcere, dar fara mesajul „sesiunea a expirat”', () => {
    state.pathname = '/dashboard';
    window.history.replaceState(null, '', '/ro/dashboard');
    const { result } = renderHook(() => useLoginRedirect());
    act(() => result.current());
    expect(state.replace).toHaveBeenCalledWith('/login?redirect=%2Fdashboard');
  });
});
