import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action';

// 3.9 — marcheaza o ruta pentru audit log. entityType e optional (default null).
export const Audit = (action: string, entityType?: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, entityType });
