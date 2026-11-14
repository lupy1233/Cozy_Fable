import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeUnder } from './core-list-parts';

// Etapa 12 (k2): codul tehnic al starii nu mai apare in randul vizibil, ci in tooltip (title).
describe('CodeUnder', () => {
  it('arata doar eticheta; codul sta in title si data-code', () => {
    const { container } = render(
      <CodeUnder code="SUSPENDED">
        <span>Suspendată</span>
      </CodeUnder>,
    );
    const label = screen.getByText('Suspendată');
    const wrapper = label.parentElement as HTMLElement;
    expect(wrapper.getAttribute('title')).toBe('SUSPENDED');
    expect(wrapper.getAttribute('data-code')).toBe('SUSPENDED');
    expect(container.textContent).toBe('Suspendată');
    expect(screen.queryByText('SUSPENDED')).toBeNull();
  });
});
