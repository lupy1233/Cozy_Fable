import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { UploadStillPendingError, waitForSafeUpload } from './upload-scan';

afterEach(() => vi.useRealTimers());
describe('wait for upload scan', () => {
  it('does not return pending as successful, then returns SAFE', async () => {
    vi.useFakeTimers();
    const confirm = vi.fn().mockResolvedValueOnce({ id: 'a1', status: 'PENDING_SCAN' }).mockResolvedValue({ id: 'a1', status: 'SAFE' });
    const result = waitForSafeUpload(confirm);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toMatchObject({ status: 'SAFE' });
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('BLOCKED does not enter the chat/summary as a completed upload', async () => {
    await expect(waitForSafeUpload(vi.fn().mockResolvedValue({ status: 'BLOCKED' }))).rejects.toMatchObject({ code: 'FILE_SCAN_BLOCKED' });
  });

  // b5: id-ul fisierului respins merge mai departe, ca randul sa poata fi scos din lista
  it('BLOCKED carries the attachment id in details', async () => {
    await expect(waitForSafeUpload(vi.fn().mockResolvedValue({ id: 'a9', status: 'BLOCKED' }))).rejects.toMatchObject({
      code: 'FILE_SCAN_BLOCKED',
      details: { attachmentId: 'a9' },
    });
  });

  it('still pending after all attempts → UploadStillPendingError (still an INTERNAL_ERROR ApiError)', async () => {
    vi.useFakeTimers();
    const result = waitForSafeUpload(vi.fn().mockResolvedValue({ id: 'a1', status: 'PENDING_SCAN' }));
    const assertion = expect(result).rejects.toBeInstanceOf(UploadStillPendingError);
    await vi.advanceTimersByTimeAsync(2000 * 20);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 503 });
  });
});
