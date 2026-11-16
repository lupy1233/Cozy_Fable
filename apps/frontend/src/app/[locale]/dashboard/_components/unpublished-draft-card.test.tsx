import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import { UnpublishedDraftCard } from './unpublished-draft-card';

const hasDraft = vi.fn();

vi.mock('@/lib/session-cleanup', () => ({
  hasUnpublishedLocalDraft: () => hasDraft(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function renderCard() {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <UnpublishedDraftCard />
    </NextIntlClientProvider>,
  );
}

describe('UnpublishedDraftCard (b4)', () => {
  beforeEach(() => hasDraft.mockReset());

  it('cu ciorna locala nepublicata → cardul cu „Continuă” spre /requests/new', () => {
    hasDraft.mockReturnValue(true);
    renderCard();
    expect(screen.getByRole('heading', { name: 'Ai o cerere gata de publicare' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuă' })).toHaveAttribute('href', '/requests/new');
  });

  it('fara ciorna → nimic', () => {
    hasDraft.mockReturnValue(false);
    const { container } = renderCard();
    expect(container).toBeEmptyDOMElement();
  });
});
