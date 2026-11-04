import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from './analytics';

describe('track (statistici fara cookie-uri)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/ro/requests/drafts/AbCdEf1234567890xyz?email=a@b.ro');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });

  function configure(provider: string) {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', provider);
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_HOST', 'https://stats.example.eu');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_SITE_ID', 'site-1');
  }

  it('nu trimite nimic cand nu e configurat', () => {
    track('wizard_start');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'umami');
    track('wizard_start');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nu trimite nimic cu Do Not Track', () => {
    configure('umami');
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    track('wizard_start');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('umami: payload cu URL fix, fara caile reale sau cookie-uri', () => {
    configure('umami');
    track('wizard_start', 'en');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://stats.example.eu/api/send');
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect(JSON.parse(init.body)).toEqual({
      type: 'event',
      payload: { website: 'site-1', hostname: 'localhost', url: '/en/requests/new', name: 'wizard_start' },
    });
    expect(init.body).not.toContain('AbCdEf1234567890xyz');
    expect(init.body).not.toContain('a@b.ro');
  });

  it('plausible: payload cu URL absolut fix si domeniul configurat', () => {
    configure('plausible');
    track('request_published');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://stats.example.eu/api/event');
    expect(JSON.parse(init.body)).toEqual({
      name: 'request_published',
      url: 'http://localhost:3000/ro/requests/new',
      domain: 'site-1',
    });
    expect(init.body).not.toContain('drafts');
  });

  it('nu arunca daca fetch esueaza', () => {
    configure('umami');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(() => track('wizard_start')).not.toThrow();
  });
});
