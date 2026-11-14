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

  it('„Inapoi” in interiorul aplicatiei (popstate chiar inainte de montare) → nici derulare, nici focus', () => {
    // ceasul testului e dat un minut inapoi, ca momentul retinut sa nu atinga testele urmatoare
    vi.setSystemTime(new Date(Date.now() - 60_000));
    window.dispatchEvent(new PopStateEvent('popstate'));
    const { getByRole } = render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(getByRole('heading', { name: 'Portofoliu' })).not.toHaveFocus();
    // dupa fereastra de 2 s o navigare noua se poarta din nou normal
    vi.advanceTimersByTime(2500);
    const again = render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    again.unmount();
  });

  it('pagina deja derulata (pozitie restaurata) → nu deruleaza din nou', () => {
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // verificarea in browser (etapa 11): la clic din cardul „Pregateste-ti firma” Next deruleaza
  // singur la ancora inaintea efectului → pozitia ramane, dar focusul tot trece pe titlu
  it('Next a derulat deja la ancora (sectiunea e sus) → fara derulare, cu focus pe titlu', () => {
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 72 } as DOMRect);
    const { getByRole } = render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(getByRole('heading', { name: 'Portofoliu' })).toHaveFocus();
  });

  it('pozitie restaurata in alt loc al paginii (sectiunea nu e sus) → nici derulare, nici focus', () => {
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 1400 } as DOMRect);
    const { getByRole } = render(<Page />);
    vi.runAllTimers();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(getByRole('heading', { name: 'Portofoliu' })).not.toHaveFocus();
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
