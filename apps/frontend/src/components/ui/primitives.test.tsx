import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../messages/ro.json';
import { Card, CardSection } from './card';
import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';
import { SkeletonPage } from './skeleton';
import { StatCard } from './stat-card';

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('primitive de layout', () => {
  it('Card as="section" randeaza <section> cu rounded-xl', () => {
    const { container } = wrap(<Card as="section">continut</Card>);
    const el = container.querySelector('section');
    expect(el).not.toBeNull();
    expect(el!.className).toContain('rounded-xl');
  });

  it('Card asChild pune stilul pe copil (card interactiv)', () => {
    wrap(
      <Card asChild interactive>
        <button type="button">Card interactiv</button>
      </Card>,
    );
    const el = screen.getByRole('button', { name: 'Card interactiv' });
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('hover:-translate-y-0.5');
  });

  it('CardSection leaga aria-labelledby de titlu', () => {
    wrap(<CardSection title="Credite">corp</CardSection>);
    const region = screen.getByRole('region', { name: 'Credite' });
    expect(region).toBeInTheDocument();
  });

  it('StatCard cu href randeaza un link cu eticheta si valoarea', () => {
    wrap(<StatCard label="Preluari" value={12} href="/marketplace/claims" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/marketplace/claims');
    expect(within(link).getByText('Preluari')).toBeInTheDocument();
    expect(within(link).getByText('12')).toBeInTheDocument();
  });

  it('StatCard tone=warning foloseste cardul chihlimbar', () => {
    const { container } = wrap(<StatCard label="Dispute" value={3} tone="warning" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('bg-amber-soft');
  });

  it('EmptyState afiseaza titlul, sugestia si actiunea', () => {
    wrap(<EmptyState title="Nimic aici" hint="Revino mai tarziu" action={<button type="button">Fa ceva</button>} />);
    expect(screen.getByText('Nimic aici')).toBeInTheDocument();
    expect(screen.getByText('Revino mai tarziu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fa ceva' })).toBeInTheDocument();
  });

  it('PageHeader randeaza UN h1 si linkul inapoi', () => {
    wrap(<PageHeader title="Portofel" subtitle="Sub" back={{ href: '/marketplace', label: 'Inapoi' }} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Portofel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Inapoi/ })).toHaveAttribute('href', '/marketplace');
  });

  it('SkeletonPage are role=status si textul doar sr-only', () => {
    const { container } = wrap(<SkeletonPage variant="table" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    const label = within(status).getByText('Se încarcă…');
    expect(label.className).toContain('sr-only');
    // in afara textului sr-only nu exista text vizibil
    const visibleText = (container.textContent ?? '').replace('Se încarcă…', '').trim();
    expect(visibleText).toBe('');
  });
});
