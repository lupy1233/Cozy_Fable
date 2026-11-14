import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StickyActionBar } from './sticky-action-bar';

const classesOf = (el: Element) => el.className.split(/\s+/).filter(Boolean);

describe('StickyActionBar', () => {
  it('un singur element, cu copiii lui', () => {
    const { container } = render(
      <StickyActionBar>
        <button type="button">Înapoi</button>
        <button type="button">Continuă</button>
      </StickyActionBar>,
    );
    expect(container.children).toHaveLength(1);
    const bar = container.firstElementChild!;
    expect(bar.querySelectorAll('button')).toHaveLength(2);
  });

  it('lipita doar sub lg; de la lg bara statica de azi', () => {
    const { container } = render(<StickyActionBar>x</StickyActionBar>);
    const c = classesOf(container.firstElementChild!);
    // telefon
    expect(c).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'z-20', 'border-t', 'border-border', 'backdrop-blur']));
    expect(c).toContain('pb-[max(0.75rem,env(safe-area-inset-bottom))]');
    expect(c).toEqual(expect.arrayContaining(['-mx-5', 'px-5', 'sm:-mx-7', 'sm:px-7']));
    // desktop
    expect(c).toEqual(expect.arrayContaining(['lg:static', 'lg:pt-6', 'lg:pb-0', 'lg:mx-0', 'lg:px-0', 'lg:bg-transparent']));
    // niciodata fixed (cardul are transform)
    expect(c.some((k) => k === 'fixed' || k.endsWith(':fixed'))).toBe(false);
    // sticky doar fara prefix (lipirea e anulata de lg:static)
    expect(c.filter((k) => k.endsWith('sticky'))).toEqual(['sticky']);
  });

  it('bleed={false}: fara margini negative (Sumar)', () => {
    const { container } = render(<StickyActionBar bleed={false}>x</StickyActionBar>);
    const c = classesOf(container.firstElementChild!);
    expect(c).toContain('sticky');
    expect(c.some((k) => k.includes('-mx-'))).toBe(false);
  });

  it('className se adauga peste aspectul implicit', () => {
    const { container } = render(
      <StickyActionBar className="flex-col-reverse sm:flex-row lg:hidden">x</StickyActionBar>,
    );
    const c = classesOf(container.firstElementChild!);
    expect(c).toEqual(expect.arrayContaining(['flex-col-reverse', 'sm:flex-row', 'lg:hidden', 'sticky']));
  });
});
