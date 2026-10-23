import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ActionConfirmDialog } from './action-confirm-dialog';

// E-company-6: dialogul de consecinte — bifa obligatorie, fara dublu-submit cat e pending, eroarea in dialog.
function renderDialog(props: Partial<Parameters<typeof ActionConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={{ Accessibility: { close: 'Închide' } }}>
      <ActionConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Retragi oferta?"
        confirmLabel="Da, retrag oferta"
        cancelLabel="Înapoi"
        pendingLabel="Se trimite…"
        pending={false}
        error={null}
        onConfirm={onConfirm}
        {...props}
      >
        <p>Clientul nu mai vede oferta.</p>
      </ActionConfirmDialog>
    </NextIntlClientProvider>,
  );
  return { onConfirm, onOpenChange };
}

describe('ActionConfirmDialog', () => {
  it('butonul de confirmare e dezactivat pana se bifeaza confirmarea', async () => {
    const { onConfirm } = renderDialog({ ackLabel: 'Înțeleg că preluarea expiră imediat.' });
    const confirm = screen.getByRole('button', { name: 'Da, retrag oferta' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Înțeleg că preluarea expiră imediat.' }));
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cat e pending nu apeleaza onConfirm si nu se inchide', async () => {
    const { onConfirm, onOpenChange } = renderDialog({ pending: true });
    const confirm = screen.getByRole('button', { name: 'Se trimite…' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('afiseaza eroarea in dialog', () => {
    renderDialog({ error: 'Fereastra de retragere s-a închis.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Fereastra de retragere s-a închis.');
    expect(screen.getByText('Clientul nu mai vede oferta.')).toBeVisible();
  });
});
