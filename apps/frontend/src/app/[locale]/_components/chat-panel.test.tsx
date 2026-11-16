import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { MessageDto } from '@marketplace/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import en from '../../../messages/en.json';
import { ChatPanel, MESSAGE_MAX_LENGTH } from './chat-panel';

// a4 (etapa 4): mesajele de sistem din conversatie (cererea de modificare, refuzul ofertei)
// apar ca nota centrata, cu textul clientului; mesajele obisnuite raman baloane.
// g3 (etapa 7): erorile la trimitere / incarcare apar sub camp, textul ramane.
const state = vi.hoisted(() => ({
  messages: [] as unknown[],
  send: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/hooks/use-chat', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useMessages: () => ({ data: state.messages, isPending: false, isSuccess: true }),
    useSendMessage: () => ({ mutateAsync: state.send, isPending: false }),
    useUploadChatAttachment: () => ({ mutateAsync: state.upload, isPending: false }),
    useMarkThreadRead: mutation,
  };
});

beforeEach(() => {
  state.messages = [];
  state.send = vi.fn().mockResolvedValue({});
  state.upload = vi.fn().mockResolvedValue('att-1');
});

beforeAll(() => {
  // jsdom nu are IntersectionObserver
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

const msg = (over: Partial<MessageDto>): MessageDto => ({
  id: 'm1',
  chatThreadId: 't1',
  senderUserId: 'u-client',
  senderName: 'Ana',
  isMine: false,
  body: null,
  attachments: [],
  createdAt: '2026-11-13T10:00:00.000Z',
  systemKind: null,
  systemPayload: null,
  ...over,
});

function renderPanel(qc = new QueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>
        <ChatPanel threadId="t1" mode="company" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const field = () => screen.getByRole('textbox');
const sendButton = () => screen.getByRole('button', { name: en.Chat.send });
const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;
const typeText = (value: string) => fireEvent.change(field(), { target: { value } });

describe('ChatPanel — erorile la trimitere si incarcare (g3)', () => {
  it('butonul e inactiv cat mesajul e gol (si doar spatii) si fara fisier', () => {
    renderPanel();
    expect(sendButton()).toBeDisabled();
    typeText('   ');
    expect(sendButton()).toBeDisabled();
    typeText('Buna ziua');
    expect(sendButton()).toBeEnabled();
  });

  it('eroare generala la trimitere: mesajul apare sub camp, textul ramane', async () => {
    state.send.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500, 'boom'));
    renderPanel();
    typeText('Buna ziua');
    fireEvent.click(sendButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(en.Chat.errors.sendFailed);
    expect(field()).toHaveValue('Buna ziua');
  });

  it('peste limita: contorul si motivul apar, butonul e inactiv', () => {
    const { container } = renderPanel();
    typeText('a'.repeat(MESSAGE_MAX_LENGTH - 1));
    expect(container.querySelector('[data-chat-counter]')).toHaveTextContent('4,999 / 5,000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    typeText('a'.repeat(MESSAGE_MAX_LENGTH + 1));
    expect(container.querySelector('[data-chat-counter]')).toHaveTextContent('5,001 / 5,000');
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.Chat.errors.tooLong.replace('{max}', '5,000'),
    );
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(sendButton()).toBeDisabled();
  });

  it('mesaj scurt: fara contor', () => {
    const { container } = renderPanel();
    typeText('Buna');
    expect(container.querySelector('[data-chat-counter]')).toBeNull();
  });

  it('conversatia inchisa intre timp: nota „doar citire” inlocuieste campul, starea se reincarca', async () => {
    state.send.mockRejectedValue(new ApiError('THREAD_READ_ONLY', 409, 'Thread is read-only'));
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    renderPanel(qc);
    typeText('Buna ziua');
    fireEvent.click(sendButton());
    expect(await screen.findByText(en.Chat.readOnly)).toBeInTheDocument();
    // m5: mesajul NU a plecat — se spune de ce, iar textul ramane vizibil, doar de citit
    expect(screen.getByRole('alert')).toHaveTextContent(en.Chat.errors.readOnly);
    const unsent = screen.getByLabelText(en.Chat.unsentLabel);
    expect(unsent).toHaveValue('Buna ziua');
    expect(unsent).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: en.Chat.send })).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chat'] });
  });

  it('prea multe fisiere (FILE_LIMIT_REACHED) la trimitere', async () => {
    state.send.mockRejectedValue(new ApiError('FILE_LIMIT_REACHED', 400, 'Too many attachments'));
    renderPanel();
    typeText('x');
    fireEvent.click(sendButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.Chat.errors.tooManyFiles.replace('{max}', '5'),
    );
  });

  it('401 la trimitere: nicio eroare locala (sesiunea pierduta e tratata global), textul ramane', async () => {
    state.send.mockRejectedValue(new ApiError('UNAUTHORIZED', 401, 'Unauthorized'));
    renderPanel();
    typeText('Buna ziua');
    fireEvent.click(sendButton());
    await waitFor(() => expect(state.send).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field()).toHaveValue('Buna ziua');
  });

  it('selectorul accepta doar tipurile permise', () => {
    const { container } = renderPanel();
    expect(fileInput(container).accept).toContain('application/pdf');
    expect(fileInput(container).accept).toContain('.zip');
  });

  it('fisier cu tip nepermis: refuzat inainte de incarcare, cu textul din formularul de cerere', async () => {
    const { container } = renderPanel();
    const bad = new File(['x'], 'notes.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput(container), { target: { files: [bad] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('notes.exe');
    expect(alert).toHaveTextContent(en.Configurator.uploads.rejectReason.TYPE);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it('fisier respins de server la scanare: motivul apare', async () => {
    state.upload.mockRejectedValue(new ApiError('FILE_SCAN_BLOCKED', 400, 'blocked'));
    const { container } = renderPanel();
    const pdf = new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput(container), { target: { files: [pdf] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(en.Configurator.uploads.rejectReason.SCAN);
  });

  it('fisier fara tip de la browser (Windows): se trimite tipul dedus din extensie; butonul devine activ', async () => {
    const { container } = renderPanel();
    const zip = new File(['PK'], 'proiect.zip', { type: '' });
    fireEvent.change(fileInput(container), { target: { files: [zip] } });
    await waitFor(() => expect(state.upload).toHaveBeenCalled());
    expect((state.upload.mock.calls[0][0] as File).type).toBe('application/zip');
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });
});

describe('ChatPanel — mesajele de sistem (a4)', () => {
  it('cererea de modificare: nota cu varianta si textul cererii', () => {
    state.messages = [
      msg({
        body: 'Alt blat, mai ieftin',
        systemKind: 'QUOTE_CHANGE_REQUESTED',
        systemPayload: { quoteId: 'q1', version: 1, changeRequestId: 'cr1' },
      }),
    ];
    renderPanel();
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(en.Chat.system.changeRequestedOn.replace('{n}', '1'));
    expect(note).toHaveTextContent('“Alt blat, mai ieftin”');
  });

  it('refuzul ofertei: nota cu motivul si textul clientului', () => {
    state.messages = [
      msg({ body: 'Am gasit mai repede', systemKind: 'QUOTE_DECLINED', systemPayload: { quoteId: 'q1', reason: 'DELIVERY_TERM' } }),
    ];
    renderPanel();
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(en.Chat.system.quoteDeclined);
    expect(note).toHaveTextContent(en.Quotes.declineReasons.DELIVERY_TERM);
    expect(note).toHaveTextContent('“Am gasit mai repede”');
  });

  it('mesajul obisnuit ramane balon', () => {
    state.messages = [msg({ body: 'Buna ziua' })];
    renderPanel();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByText('Buna ziua')).toBeInTheDocument();
  });
});
