import type { RequestStatus } from '@marketplace/shared';

// Limitele de editare (docs/03 §4.3): 3 inainte de prima preluare, 1 dupa.
export const MAX_PRE_CLAIM_EDITS = 3;
export const MAX_POST_CLAIM_EDITS = 1;

export type RequestEditability = {
  preClaim: boolean;
  postClaim: boolean;
  remaining: number;
  canEdit: boolean;
  // cheia textului din Requests.edits (preClaim / postClaim / noneLeft / locked)
  noteKey: 'preClaim' | 'postClaim' | 'noneLeft' | 'locked';
};

// f6-2 (PO): cererea expirata cu republicarea nefolosita se poate republica cu modificari
// (formularul in mod editare; salvarea republica). Nu consuma din editari. Serverul aplica
// aceeasi regula (repostWithChangesForClient → REPOST_ALREADY_USED la a doua incercare).
export function canRepostWithChanges(r: { status: RequestStatus; repostUsed?: boolean }): boolean {
  return r.status === 'EXPIRED' && r.repostUsed === false;
}

// Regula unica pentru butonul "Editeaza" de pe pagina cererii SI pentru garda paginii de
// editare: pre-claim doar IN_MARKETPLACE, post-claim doar CLAIMED_PARTIAL / CLAIMED_FULL,
// cu editari ramase. Serverul aplica aceleasi limite la salvare (assertEditableAndCount).
export function requestEditability(r: {
  status: RequestStatus;
  preClaimEditsUsed: number;
  postClaimEditsUsed: number;
}): RequestEditability {
  const preClaim = r.status === 'IN_MARKETPLACE';
  const postClaim = r.status === 'CLAIMED_PARTIAL' || r.status === 'CLAIMED_FULL';
  const remaining = preClaim
    ? MAX_PRE_CLAIM_EDITS - r.preClaimEditsUsed
    : postClaim
      ? MAX_POST_CLAIM_EDITS - r.postClaimEditsUsed
      : 0;
  const canEdit = (preClaim || postClaim) && remaining > 0;
  const noteKey = canEdit ? (preClaim ? 'preClaim' : 'postClaim') : preClaim || postClaim ? 'noneLeft' : 'locked';
  return { preClaim, postClaim, remaining, canEdit, noteKey };
}
