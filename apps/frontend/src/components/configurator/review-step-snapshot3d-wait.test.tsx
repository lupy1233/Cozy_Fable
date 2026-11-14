import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CURRENT_FLOW_VERSION, defaultPieceConfig } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { ReviewStep } from './review-step';

const NEW = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const hoisted = vi.hoisted(() => ({
  publish: { mutate: vi.fn(), mutateAsync: vi.fn(), error: null as unknown, isPending: false, isSuccess: false, failureCount: 0 },
  upload: vi.fn(async (_file: File): Promise<{ id: string }> => ({ id: '' })),
  mounted: 0,
  unmounted: 0,
}));
vi.mock('@/components/ui/toaster', () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({ data: { email: 'ana@demo.ro', role: 'CLIENT' }, isPending: false }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-requests', () => ({
  useAttachmentsStateFor: () => ({ attachments: [], isSuccess: true, isFetching: false, dataUpdatedAt: 0 }),
  useUploadAttachmentFor: () => ({ mutateAsync: hoisted.upload }),
  useRemoveAttachmentFor: () => ({ mutateAsync: vi.fn(async () => undefined) }),
  usePublishDraft: () => hoisted.publish,
  useEditRequestById: () => hoisted.publish,
  useDraftCoverage: () => ({ data: undefined }),
}));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./inspiration-picker', () => ({ InspirationPicker: () => null }));
vi.mock('./room-answer-summary', () => ({ RoomAnswerSummary: () => null }));
vi.mock('./room-screens', async (orig) => ({ ...(await orig<typeof import('./room-screens')>()), roomIssue: () => null }));
// desenarea ascunsa: imaginea iese dupa 300 ms (scena "se incarca")
vi.mock('./piece3d/snapshot3d-renderer', () => ({
  default: function FakeRenderer({ onDone }: { onDone: (dataUrl: string | null) => void }) {
    useEffect(() => {
      hoisted.mounted += 1;
      const timer = setTimeout(() => onDone(PNG), 300);
      return () => {
        hoisted.unmounted += 1;
        clearTimeout(timer);
      };
    }, [onDone]);
    return null;
  },
}));

const config = defaultPieceConfig('DESK');
const s = () => useConfiguratorStore.getState();

// revizuire m2 + m3: "Publica" asteapta imaginea care se pregateste; o desenare pe rand
describe('ReviewStep — publishing waits for the 3D picture being prepared (d4 review)', () => {
  beforeEach(() => {
    localStorage.clear();
    s().reset();
    // WebGL "exista": desenarea ascunsa porneste
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as never);
    hoisted.publish.mutateAsync = vi.fn(async () => ({ id: 'req-9', attachments: [] }));
    hoisted.upload.mockReset();
    hoisted.upload.mockImplementation(async () => ({ id: NEW }));
    s().loadSnapshot({
      ...s().snapshot(),
      startMode: 'STANDARD',
      phase: 'review',
      details: {
        budgetRange: 'UNDISCLOSED', budgetChosen: true, addressText: 'Str. 1', county: 'Cluj', city: 'Cluj',
        contactPreferences: [{ channel: 'EMAIL', value: 'ana@demo.ro' }],
      },
      roomInstances: [{ localId: 'd', roomType: 'PIECE_DESK', flowVersion: CURRENT_FLOW_VERSION.PIECE_DESK, answers: { config3d: config } as never, completed: true }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('"Publish" pressed while the picture is drawn waits ("Preparing…"), then the piece leaves with its picture', async () => {
    const texts = (en.Configurator.review as unknown as { snapshot3d: Record<string, string> }).snapshot3d;
    const onPublished = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ReviewStep token="tok" uploadTarget={{ kind: 'draft', token: 'tok' }} onBack={() => {}} onEditRoom={() => {}} onEditDetails={() => {}} onPublished={onPublished} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: en.Requests.publish }));
    // overlay-ul spune ca imaginea se pregateste (si cardul la fel)
    await waitFor(() => expect(screen.getAllByText(texts.working)).toHaveLength(2));
    expect(hoisted.publish.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('req-9'), { timeout: 3000 });
    const answers = (vi.mocked(hoisted.publish.mutateAsync).mock.calls[0][0] as { rooms: { answers: Record<string, unknown> }[] }).rooms[0].answers;
    expect(answers.snapshot3d).toEqual([NEW]);
    // o singura desenare, demontata dupa ce a dat imaginea
    expect(hoisted.mounted).toBe(1);
    expect(hoisted.unmounted).toBe(1);
  });
});
