import { checkAttachmentFile } from '@marketplace/shared';
import { ApiError } from './api';
import { UploadStillPendingError } from './upload-scan';

// b5: motivele pentru care un fisier nu a putut fi adaugat (lista „Nu am putut adăuga”).
// TYPE / EMPTY / SIZE / LIMIT se afla inainte de trimitere; restul vin de la server sau din retea.
export type UploadRejectReason =
  | 'TYPE'
  | 'EMPTY'
  | 'SIZE'
  | 'LIMIT'
  | 'SCAN'
  | 'NETWORK'
  | 'PENDING'
  | 'INVALID'
  | 'NOT_EDITABLE';

export interface RejectedUpload {
  id: string;
  name: string;
  reason: UploadRejectReason;
  // doar pentru NETWORK: fisierul pastrat pentru „Reîncearcă”
  file?: File;
}

let seq = 0;
export function rejection(file: File, reason: UploadRejectReason): RejectedUpload {
  seq += 1;
  return { id: `rej-${seq}`, name: file.name, reason, ...(reason === 'NETWORK' ? { file } : {}) };
}

// Verificarea locala per fisier (tip cu extensie, gol, 25 MB) — aceleasi limite ca serverul.
export function localRejectReason(file: File): UploadRejectReason | null {
  const check = checkAttachmentFile(file);
  return check.ok ? null : check.reason;
}

// Imparte fisierele in acceptate / refuzate; peste locurile ramase → LIMIT.
export function splitFiles(
  files: readonly File[],
  slotsLeft: number,
): { accepted: File[]; rejected: RejectedUpload[] } {
  const accepted: File[] = [];
  const rejected: RejectedUpload[] = [];
  for (const file of files) {
    const reason = localRejectReason(file);
    if (reason) rejected.push(rejection(file, reason));
    else if (accepted.length >= slotsLeft) rejected.push(rejection(file, 'LIMIT'));
    else accepted.push(file);
  }
  return { accepted, rejected };
}

// Eroarea unei incarcari → motivul aratat clientului (pe cod, nu pe mesaj — invarianta 3.10).
export function rejectReasonFromError(err: unknown): UploadRejectReason {
  if (err instanceof UploadStillPendingError) return 'PENDING';
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'FILE_TYPE_NOT_ALLOWED':
        return 'TYPE';
      case 'FILE_TOO_LARGE':
        return 'SIZE';
      case 'FILE_LIMIT_REACHED':
        return 'LIMIT';
      case 'FILE_SCAN_BLOCKED':
        return 'SCAN';
      case 'VALIDATION_ERROR':
        return 'INVALID';
      case 'REQUEST_NOT_EDITABLE':
        return 'NOT_EDITABLE';
      default:
        return 'NETWORK';
    }
  }
  // fetch respins (fara retea) sau PUT-ul in storage esuat
  return 'NETWORK';
}

// Id-ul atasamentului respins la scanare (pus de waitForSafeUpload in details).
export function blockedAttachmentId(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== 'FILE_SCAN_BLOCKED') return null;
  const details = err.details as { attachmentId?: unknown } | undefined;
  return typeof details?.attachmentId === 'string' ? details.attachmentId : null;
}
