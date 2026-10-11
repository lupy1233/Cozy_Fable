import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AttachmentDto } from '@marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { UploadsStep } from './uploads-step';

const SKETCH = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const PROJECT = '1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f';
let attachments: AttachmentDto[] = [];

vi.mock('./inspiration-picker', () => ({ InspirationPicker: () => null }));
vi.mock('@/hooks/use-requests', () => ({
  useAttachmentsFor: () => attachments,
  useUploadAttachmentFor: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveAttachmentFor: () => ({ mutate: vi.fn() }),
}));

function file(id: string, filename: string, status: AttachmentDto['status']): AttachmentDto {
  return { id, filename, status, mimeType: 'application/pdf', sizeBytes: 2048 } as AttachmentDto;
}

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UploadsStep target={{ kind: 'draft', token: 't' }} onBack={() => {}} onContinue={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe('UploadsStep — own project and room files (E-client-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setDetails({ hasOwnProject: true });
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'OWN_PROJECT',
      phase: 'uploads',
      roomInstances: [{ localId: 'bed', roomType: 'BEDROOM', flowVersion: 2, answers: { sketch: [SKETCH] }, completed: true }],
    });
  });

  it('blocks Continue until a SAFE project file exists', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'PENDING_SCAN')];
    mount();
    expect(screen.getByRole('button', { name: en.Configurator.nav.continue })).toBeDisabled();
    expect(screen.getByText(en.Configurator.uploads.projectRequired)).toBeVisible();
    expect(screen.getByRole('button', { name: en.Configurator.uploads.switchToGuided })).toBeVisible();
  });

  it('enables Continue with a SAFE project file', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'SAFE')];
    mount();
    expect(screen.getByRole('button', { name: en.Configurator.nav.continue })).toBeEnabled();
  });

  it('lists room sketches read-only and project files with remove', () => {
    attachments = [file(SKETCH, 'sketch.pdf', 'SAFE'), file(PROJECT, 'project.pdf', 'SAFE')];
    const { container } = mount();
    const roomFiles = container.querySelector('[data-room-files]') as HTMLElement;
    expect(within(roomFiles).getByText('sketch.pdf')).toBeVisible();
    expect(within(roomFiles).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Configurator.uploads.removeFile.replace('{name}', 'project.pdf') })).toBeVisible();
    expect(screen.queryByRole('button', { name: en.Configurator.uploads.removeFile.replace('{name}', 'sketch.pdf') })).not.toBeInTheDocument();
  });

  // E-client-9 (C7-3): avertismentul ca fisierele sunt vizibile firmelor inainte de preluare
  it('shows the pre-claim visibility notice above the dropzone', () => {
    attachments = [];
    const { container } = mount();
    const notice = container.querySelector('[data-uploads-visibility]') as HTMLElement;
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent(en.Configurator.uploads.visibilityNotice);
  });
});
