import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { CONTACT_MASK_TOKEN } from '@marketplace/shared';
import ro from '@/messages/ro.json';
import en from '@/messages/en.json';
import { ContactSafeText } from './contact-safe-text';
import { ContactInTextHint } from '../configurator/contact-in-text-hint';

// E-admin-platform-45: tokenul de mascare devine eticheta localizata; hintul din
// configurator apare doar pentru contacte reale, nu pentru dimensiuni.
describe('ContactSafeText', () => {
  it('renders the masked token as a localized chip (RO + EN)', () => {
    const text = `Sunati la ${CONTACT_MASK_TOKEN}. Corp 240 x 60 cm`;
    const { container, unmount } = render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <p>
          <ContactSafeText text={text} />
        </p>
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe('Sunati la contact ascuns. Corp 240 x 60 cm');
    expect(screen.getByTitle(ro.ContactMask.hiddenHint)).toHaveTextContent('contact ascuns');
    unmount();

    const enView = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ContactSafeText text={text} />
      </NextIntlClientProvider>,
    );
    expect(enView.container.textContent).toContain('contact hidden');
    expect(enView.container.textContent).not.toContain(CONTACT_MASK_TOKEN);
  });

  it('leaves plain text untouched', () => {
    const { container } = render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <ContactSafeText text="Corp 240 x 60 cm" />
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe('Corp 240 x 60 cm');
  });
});

describe('ContactInTextHint', () => {
  const renderHint = (value: string) =>
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <ContactInTextHint value={value} />
      </NextIntlClientProvider>,
    );

  it('shows the hint for a phone or an email', () => {
    renderHint('Sunati la 0722 123 456');
    expect(screen.getByRole('status')).toHaveTextContent(ro.Configurator.contactInText.hint);
  });

  it('stays hidden for dimensions and for an app mention alone', () => {
    const { container } = renderHint('Corp 240 x 60 cm, blat 38 mm');
    expect(container.textContent).toBe('');
    const mention = renderHint('prefer WhatsApp');
    expect(mention.container.textContent).toBe('');
  });
});
