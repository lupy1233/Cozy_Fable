import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AttachmentDto } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import { AttachmentThumb } from './attachment-item';

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
