import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../messages/ro.json';
import { PostClaimEditConfirm } from './post-claim-edit-confirm';

// e3 (etapa 9): salvarea editarii unei cereri preluate cere confirmare in dialogul aplicatiei.

function setup(status: string | null, editId: string | undefined = 'req-1') {
  const client = new QueryClient();
  if (status && editId) client.setQueryData(['request', editId], { id: editId, status });
  const onConfirm = vi.fn();
  const confirmSpy = vi.spyOn(window, 'confirm');
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <PostClaimEditConfirm editId={editId} onConfirm={onConfirm}>
          {(onClick) => (
            <button type="button" onClick={onClick}>
              Salvează modificările
            </button>
          )}
        </PostClaimEditConfirm>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Salvează modificările' }));
  return { onConfirm, confirmSpy };
}

describe('PostClaimEditConfirm (e3)', () => {
  it('cerere preluata: dialogul cu efectul asupra firmelor; „Nu acum” nu salveaza', () => {
    const { onConfirm, confirmSpy } = setup('CLAIMED_PARTIAL');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(ro.Configurator.postClaimEditConfirm.body)).toBeTruthy();
    // nu fereastra browserului
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: ro.Configurator.postClaimEditConfirm.cancel }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cerere preluata: confirmarea salveaza o singura data', () => {
    const { onConfirm } = setup('CLAIMED_FULL');
    fireEvent.click(screen.getByRole('button', { name: ro.Configurator.postClaimEditConfirm.confirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('m2: dublu clic pe „Da, salvează” → o singura salvare; redeschiderea porneste curat', () => {
    const { onConfirm } = setup('CLAIMED_PARTIAL');
    const confirm = screen.getByRole('button', { name: ro.Configurator.postClaimEditConfirm.confirm });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // o noua apasare pe „Salvează” (dupa ce salvarea s-a terminat) redeschide dialogul, cu butonul activ
    fireEvent.click(screen.getByRole('button', { name: 'Salvează modificările' }));
    const again = screen.getByRole('button', { name: ro.Configurator.postClaimEditConfirm.confirm });
    expect((again as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(again);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('cerere nepreluata (IN_MARKETPLACE) → salvare directa, fara dialog', () => {
    const { onConfirm } = setup('IN_MARKETPLACE');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('publicarea unei ciorne (fara editId) → direct', () => {
    const { onConfirm } = setup(null, undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
