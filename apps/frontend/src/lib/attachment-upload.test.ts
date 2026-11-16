import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { blockedAttachmentId, rejectReasonFromError, splitFiles } from './attachment-upload';
import { UploadStillPendingError } from './upload-scan';

const fileOf = (name: string, type: string, size = 100) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('splitFiles (b5)', () => {
  it('local reasons first, then LIMIT past the free slots', () => {
    const { accepted, rejected } = splitFiles(
      [fileOf('a.pdf', 'application/pdf'), fileOf('x.txt', 'text/plain'), fileOf('b.png', 'image/png'), fileOf('c.jpg', '')],
      2,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.pdf', 'b.png']);
    expect(rejected.map((r) => [r.name, r.reason])).toEqual([['x.txt', 'TYPE'], ['c.jpg', 'LIMIT']]);
    expect(new Set(rejected.map((r) => r.id)).size).toBe(2);
  });
});

describe('rejectReasonFromError (b5)', () => {
  it.each([
    ['FILE_TYPE_NOT_ALLOWED', 'TYPE'],
    ['FILE_TOO_LARGE', 'SIZE'],
    ['FILE_LIMIT_REACHED', 'LIMIT'],
    ['FILE_SCAN_BLOCKED', 'SCAN'],
    ['VALIDATION_ERROR', 'INVALID'],
    ['REQUEST_NOT_EDITABLE', 'NOT_EDITABLE'],
    ['INTERNAL_ERROR', 'NETWORK'],
  ] as const)('%s → %s', (code, reason) => {
    expect(rejectReasonFromError(new ApiError(code, 400, 'x'))).toBe(reason);
  });

  it('network failures and a failed storage PUT → NETWORK; still scanning → PENDING', () => {
    expect(rejectReasonFromError(new TypeError('Failed to fetch'))).toBe('NETWORK');
    expect(rejectReasonFromError(new Error('upload failed'))).toBe('NETWORK');
    expect(rejectReasonFromError(new UploadStillPendingError())).toBe('PENDING');
  });

  it('blockedAttachmentId reads the id only from FILE_SCAN_BLOCKED', () => {
    expect(blockedAttachmentId(new ApiError('FILE_SCAN_BLOCKED', 400, 'x', { attachmentId: 'a1' }))).toBe('a1');
    expect(blockedAttachmentId(new ApiError('FILE_TOO_LARGE', 400, 'x', { attachmentId: 'a1' }))).toBeNull();
    expect(blockedAttachmentId(new Error('x'))).toBeNull();
  });
});
