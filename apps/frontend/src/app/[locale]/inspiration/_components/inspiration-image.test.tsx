import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { InspirationImage } from './inspiration-image';

describe('Idea Book image failures', () => {
  it.each([['en', en, 'Photo unavailable'], ['ro', ro, 'Fotografie indisponibilă']] as const)(
    'keeps a titled, sized localized fallback for a failed %s photo', (locale, messages, unavailable) => {
      render(<NextIntlClientProvider locale={locale} messages={messages}>
        <InspirationImage src="https://example.test/missing.jpg" alt="Wardrobe" className="aspect-square w-full" />
      </NextIntlClientProvider>);
      fireEvent.error(screen.getByRole('img'));
      expect(screen.getByText(unavailable)).toBeVisible();
      expect(screen.getByRole('img', { name: `Wardrobe — ${unavailable}` })).toHaveClass('aspect-square');
      expect(document.querySelector('img')).toBeNull();
    },
  );
  it('tries a different photo URL after navigation instead of retaining the previous failure', () => {
    const show = (src: string | undefined) => <NextIntlClientProvider locale="en" messages={en}>
      <InspirationImage src={src} alt="Furniture" />
    </NextIntlClientProvider>;
    const view = render(show('https://example.test/old.jpg'));
    fireEvent.error(screen.getByRole('img'));
    view.rerender(show('https://example.test/new.jpg'));
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/new.jpg');
    view.rerender(show(undefined));
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Photo unavailable')).toBeVisible();
  });
});
