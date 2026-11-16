import type { AttachmentDto } from '@marketplace/shared';
import { ApiError } from './api';

// Fisierul e salvat, dar verificarea dureaza inca: NU e un esec de retea (fara „Reîncearcă”,
// altfel s-ar incarca de doua ori). Ramane ApiError INTERNAL_ERROR pentru apelantii vechi.
export class UploadStillPendingError extends ApiError {
  constructor() {
    super('INTERNAL_ERROR', 503, 'File processing is still pending. Your upload has been saved.');
    this.name = 'UploadStillPendingError';
  }
}

// Refoloseste endpointul autorizat de confirmare; un raspuns pending nu inseamna succes.
export async function waitForSafeUpload(confirm: () => Promise<AttachmentDto>): Promise<AttachmentDto> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const attachment = await confirm();
    if (attachment.status === 'SAFE') return attachment;
    // b5: id-ul in details → interfata poate scoate randul respins din lista
    if (attachment.status === 'BLOCKED') {
      throw new ApiError('FILE_SCAN_BLOCKED', 400, 'File was blocked', { attachmentId: attachment.id });
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new UploadStillPendingError();
}
