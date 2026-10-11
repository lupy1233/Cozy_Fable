import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForSafeUpload } from './upload-scan';

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
});
