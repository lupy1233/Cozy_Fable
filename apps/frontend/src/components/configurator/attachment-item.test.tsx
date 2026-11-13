import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AttachmentDto } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import { AttachmentRow, AttachmentThumb, fileSizeLabel } from './attachment-item';

function show(status: AttachmentDto['status'], mimeType = 'image/png') {
  const attachment = { id: 'drawing', filename: 'Drawing.png', mimeType, sizeBytes: 100, status, downloadUrl: 'https://storage.example.test/signed-drawing' } as AttachmentDto;
  render(<NextIntlClientProvider locale="en" messages={en}><AttachmentThumb attachment={attachment} /></NextIntlClientProvider>);
}

describe('attachment preview states', () => {
  it('never links a pending scan even if an old signed URL is present', () => {
    show('PENDING_SCAN');
    expect(screen.getByRole('status')).toHaveAccessibleName(/Drawing.png/);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('falls back to a download item when a safe image fails to load', () => {
    show('SAFE');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://storage.example.test/signed-drawing');
  });
  it('never previews a ZIP archive', () => {
    show('SAFE', 'application/zip');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toBeVisible();
  });
});

// b5 pas 4: marimea reala si motivul pe randul respins la scanare
describe('attachment row size and blocked reason (b5)', () => {
  it('fileSizeLabel: sub 1 KB / KB / MB', () => {
    expect(fileSizeLabel(0, '<1')).toBe('<1');
    expect(fileSizeLabel(85, '<1')).toBe('<1');
    expect(fileSizeLabel(40 * 1024, '<1')).toBe('40 KB');
    expect(fileSizeLabel(3.5 * 1024 * 1024, '<1')).toBe('3.5 MB');
  });

  it('a blocked 85 B file shows "under 1 KB" and the reason, not "0 KB"', () => {
    const attachment = { id: 'tiny', filename: 'tiny.png', mimeType: 'image/png', sizeBytes: 85, status: 'BLOCKED', downloadUrl: null } as AttachmentDto;
    render(<NextIntlClientProvider locale="en" messages={en}><ul><AttachmentRow attachment={attachment} /></ul></NextIntlClientProvider>);
    expect(screen.getByText(en.Configurator.uploads.sizeUnderKb)).toBeVisible();
    expect(screen.queryByText('0 KB')).not.toBeInTheDocument();
    expect(screen.getByText(en.Configurator.uploads.blockedNotice)).toBeVisible();
  });
});
