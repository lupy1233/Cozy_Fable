import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { MessageDto } from '@marketplace/shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ChatPanel } from './chat-panel';

// a4 (etapa 4): mesajele de sistem din conversatie (cererea de modificare, refuzul ofertei)
// apar ca nota centrata, cu textul clientului; mesajele obisnuite raman baloane.
const state = vi.hoisted(() => ({ messages: [] as unknown[] }));

vi.mock('@/hooks/use-chat', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useMessages: () => ({ data: state.messages, isPending: false, isSuccess: true }),
    useSendMessage: mutation,
    useUploadChatAttachment: mutation,
    useMarkThreadRead: mutation,
  };
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

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChatPanel threadId="t1" mode="company" />
    </NextIntlClientProvider>,
  );
}

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
