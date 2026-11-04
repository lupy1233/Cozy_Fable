import type { AttachmentDto } from '@marketplace/shared';
import { ApiError } from './api';

// Refoloseste endpointul autorizat de confirmare; un raspuns pending nu inseamna succes.
export async function waitForSafeUpload(confirm: () => Promise<AttachmentDto>): Promise<AttachmentDto> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const attachment = await confirm();
    if (attachment.status === 'SAFE') return attachment;
    if (attachment.status === 'BLOCKED') throw new ApiError('FILE_SCAN_BLOCKED', 400, 'File was blocked');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new ApiError('INTERNAL_ERROR', 503, 'File processing is still pending. Your upload has been saved.');
}
