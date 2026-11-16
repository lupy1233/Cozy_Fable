import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { AttachmentDto } from '@marketplace/shared';
import ro from '../../messages/ro.json';
import { RequestGeneralFiles, generalAttachments } from './request-general-files';

// a2: fisierele cererii care nu tin de nicio camera apar o singura data (pe piata si pe fisa).
const file = (id: string, filename: string): AttachmentDto => ({
  id,
  filename,
  mimeType: 'application/pdf',
  sizeBytes: 1000,
  status: 'SAFE',
  downloadUrl: `https://files.test/${id}`,
  createdAt: '2026-11-01T10:00:00.000Z',
});

const rooms = [{ answers: { sketch: ['sketch-1'], snapshot3d: ['snap-1'], layout: 'L_SHAPE' } }];
const attachments = [file('sketch-1', 'schita.png'), file('snap-1', 'piesa.png'), file('proj-1', 'proiect.pdf')];

describe('RequestGeneralFiles (a2)', () => {
  it('pastreaza doar fisierele nereferite de camere (schita si imaginea 3D raman in cardul camerei)', () => {
    expect(generalAttachments(rooms, attachments).map((a) => a.id)).toEqual(['proj-1']);
  });

  it('afiseaza sectiunea "Fisierele cererii" cu fisierul general', () => {
    render(
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <RequestGeneralFiles rooms={rooms} attachments={attachments} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { name: ro.Quotes.workspace.filesSection })).toBeTruthy();
    expect(screen.getByTitle('proiect.pdf')).toBeTruthy();
    expect(screen.queryByTitle('schita.png')).toBeNull();
    expect(screen.queryByTitle('piesa.png')).toBeNull();
  });

  it('fara fisiere generale → nimic', () => {
    const { container } = render(
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <RequestGeneralFiles rooms={rooms} attachments={attachments.slice(0, 2)} />
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
