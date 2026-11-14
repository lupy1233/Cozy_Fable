import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollToHashSection } from './use-scroll-to-hash';

// h1 (etapa 11) + revizuire m5: derularea la /company#sectiune dupa incarcare, cu focus pe
// titlu; fara derulare la „Inapoi” sau cand browserul a restaurat deja pozitia.

function Page() {
  useScrollToHashSection(0);
  return (
    <>
      <section id="profile">
        <h2>Profil</h2>
      </section>
      <section id="portfolio">
        <h2>Portofoliu</h2>
      </section>
    </>
  );
}

const scrollIntoView = vi.fn();
let navType = 'navigate';

beforeEach(() => {
  vi.useFakeTimers();
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  navType = 'navigate';
  vi.spyOn(performance, 'getEntriesByType').mockImplementation(
    () => [{ type: navType }] as unknown as PerformanceEntryList,
  );
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  window.history.replaceState(null, '', '/ro/company#portfolio');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useScrollToHashSection', () => {
  it('navigare noua cu ancora: deruleaza la sectiune si muta focusul pe titlul ei', () => {
    const { getByRole } = render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('portfolio'));
    const heading = getByRole('heading', { name: 'Portofoliu' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveFocus();
  });

  it('la „Inapoi” (back_forward) nu atinge pozitia restaurata de browser', () => {
    navType = 'back_forward';
    render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('pagina deja derulata (pozitie restaurata) → nu deruleaza din nou', () => {
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('fara ancora sau cu ancora necunoscuta → nimic', () => {
    window.history.replaceState(null, '', '/ro/company');
    render(<Page />).unmount();
    window.history.replaceState(null, '', '/ro/company#nu-exista');
    render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
