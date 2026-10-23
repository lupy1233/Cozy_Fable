import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { useSavedRefs } from '@/hooks/use-inspiration-boards';
import { SaveButton } from './save-button';

// E-client-34: o poza se salveaza in mai multe colectii din acelasi popover (bife), optimistic,
// cu rollback doar pe perechea care a esuat.

const PHOTO = '00000000-0000-4000-8000-000000000001';

const server = vi.hoisted(() => ({
  pairs: new Set<string>(),
  calls: [] as { method: string; path: string; body?: unknown }[],
  failBoards: new Set<string>(),
}));

vi.mock('@/hooks/use-auth', () => ({ useMe: () => ({ data: { id: 'u1', email: 'a@b.ro' } }) }));
vi.mock('@/lib/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: vi.fn(async (path: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      if (method === 'GET' && path === '/inspiration/boards') {
        return [
          { id: 'bA', name: 'Board A', itemsCount: 0, coverUrls: [], createdAt: '', updatedAt: '' },
          { id: 'bB', name: 'Board B', itemsCount: 0, coverUrls: [], createdAt: '', updatedAt: '' },
        ];
      }
      if (method === 'GET' && path === '/inspiration/boards/saved') {
        return [...server.pairs].map((p) => {
          const [photoId, boardId] = p.split('|');
          return { photoId, boardId };
        });
      }
      server.calls.push({ method, path, body });
      const board = path.split('/')[3];
      if (server.failBoards.has(board)) throw new Error('boom');
      if (method === 'POST') server.pairs.add(`${body.photoId}|${board}`);
      if (method === 'DELETE') server.pairs.delete(`${path.split('/')[5]}|${board}`);
      return undefined;
    }),
  };
});

function Harness() {
  const saved = useSavedRefs();
  const ids = (saved.data ?? []).filter((r) => r.photoId === PHOTO).map((r) => r.boardId);
  return <SaveButton photoId={PHOTO} savedBoardIds={ids} authed onRequireAuth={() => undefined} />;
}

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en}>
        <Harness />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const box = (name: string) => screen.findByRole('checkbox', { name: new RegExp(name) });

describe('SaveButton — mai multe colectii', () => {
  beforeEach(() => {
    server.pairs.clear();
    server.calls.length = 0;
    server.failBoards.clear();
  });

  it('two ticks send two POSTs and both boards stay ticked', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await box('Board A'));
    await userEvent.click(await box('Board B'));

    await waitFor(() => expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(server.calls.map((c) => c.path)).toEqual([
      '/inspiration/boards/bA/items',
      '/inspiration/boards/bB/items',
    ]);
    expect(await box('Board A')).toHaveAttribute('aria-checked', 'true');
    expect(await box('Board B')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Saved in 2 collections' })).toBeInTheDocument();
  });

  it('unticking one board sends a DELETE and keeps the other', async () => {
    server.pairs.add(`${PHOTO}|bA`);
    server.pairs.add(`${PHOTO}|bB`);
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Saved in 2 collections' }));
    await userEvent.click(await box('Board A'));

    await waitFor(() => expect(server.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1));
    expect(server.calls[0].path).toBe(`/inspiration/boards/bA/items/${PHOTO}`);
    await waitFor(async () => expect(await box('Board A')).toHaveAttribute('aria-checked', 'false'));
    expect(await box('Board B')).toHaveAttribute('aria-checked', 'true');
  });

  it('a failed tick reverts only that board', async () => {
    server.failBoards.add('bB');
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await box('Board A'));
    await userEvent.click(await box('Board B'));

    await waitFor(async () => expect(await box('Board B')).toHaveAttribute('aria-checked', 'false'));
    expect(await box('Board A')).toHaveAttribute('aria-checked', 'true');
  });
});
