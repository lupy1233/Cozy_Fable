import {
  collectFreeTextAnswers,
  detectContactInfo,
  isHideable,
  redactContactExcerpt,
  type ContactDetectionField,
  type ContactMatchKind,
} from '@marketplace/shared';
import type { RoomType } from '@prisma/client';
import type { ProcessedRoom } from './configurator.service';

// E-admin-platform-45 (F2-16): screening pur (fara Nest) al textelor libere la
// publicare/editare — titlu manual, "Mesaj pentru firme", raspunsurile text/piese si
// notitele pozelor de inspiratie (E-client-34).
// Nu modifica nimic: intoarce randurile de log (fragment partial ascuns) si detaliile
// de blocare pentru politica BLOCK.

export const MAX_CONTACT_DETECTION_ROWS = 20;
export const CONTACT_IN_TEXT_MESSAGE_KEY = 'validation.contactInText';

export interface ContactScreeningRow {
  field: ContactDetectionField;
  roomType: RoomType | null;
  stepId: string | null;
  kinds: ContactMatchKind[];
  excerpt: string;
  // false = doar mentiune de aplicatie ("prefer WhatsApp"): se logheaza, nu se ascunde
  hideable: boolean;
}

export type ContactBlockingDetail =
  | { roomIndex: number; stepId: string; messageKey: string }
  | { field: 'description'; messageKey: string }
  | { field: 'inspirationNote'; photoId: string; messageKey: string };

export interface ContactScreeningResult {
  rows: ContactScreeningRow[];
  titleHasContact: boolean;
  blockingDetails: ContactBlockingDetail[];
}

export interface ContactScreeningInput {
  manualTitle?: string;
  description?: string;
  rooms: ProcessedRoom[];
  // E-client-34: notitele clientului pe pozele de inspiratie (roomType = camera legata)
  inspirationNotes?: { photoId: string; note: string; roomType: RoomType | null }[];
}

function screenText(
  text: string | undefined,
): { kinds: ContactMatchKind[]; excerpt: string; hideable: boolean } | null {
  if (!text) return null;
  const matches = detectContactInfo(text);
  if (matches.length === 0) return null;
  const kinds = [...new Set(matches.map((m) => m.kind))];
  const hideable = matches.some(isHideable);
  // fragmentul se centreaza pe primul contact ascunzibil (altfel pe prima mentiune)
  const focus = matches.find(isHideable) ?? matches[0];
  return { kinds, excerpt: redactContactExcerpt(text, focus), hideable };
}

export function screenRequestText(input: ContactScreeningInput): ContactScreeningResult {
  const rows: ContactScreeningRow[] = [];
  const blockingDetails: ContactBlockingDetail[] = [];
  const push = (row: ContactScreeningRow) => {
    if (rows.length < MAX_CONTACT_DETECTION_ROWS) rows.push(row);
  };

  // titlul manual (doar din apeluri API directe; UI-ul trimite titlu automat)
  const title = screenText(input.manualTitle?.trim());
  const titleHasContact = title?.hideable === true;
  if (title) push({ field: 'TITLE', roomType: null, stepId: null, ...title });

  const description = screenText(input.description);
  if (description) {
    push({ field: 'DESCRIPTION', roomType: null, stepId: null, ...description });
    if (description.hideable) {
      blockingDetails.push({ field: 'description', messageKey: CONTACT_IN_TEXT_MESSAGE_KEY });
    }
  }

  input.rooms.forEach((room, roomIndex) => {
    const blockedSteps = new Set<string>();
    for (const answer of collectFreeTextAnswers(room.roomType, room.flowVersion, room.answers)) {
      const hit = screenText(answer.value);
      if (!hit) continue;
      push({ field: 'ANSWER', roomType: room.roomType, stepId: answer.stepId.slice(0, 80), ...hit });
      if (hit.hideable && !blockedSteps.has(answer.stepId)) {
        blockedSteps.add(answer.stepId);
        blockingDetails.push({ roomIndex, stepId: answer.stepId, messageKey: CONTACT_IN_TEXT_MESSAGE_KEY });
      }
    }
  });

  for (const item of input.inspirationNotes ?? []) {
    const hit = screenText(item.note);
    if (!hit) continue;
    push({ field: 'PHOTO_NOTE', roomType: item.roomType, stepId: null, ...hit });
    if (hit.hideable) {
      blockingDetails.push({ field: 'inspirationNote', photoId: item.photoId, messageKey: CONTACT_IN_TEXT_MESSAGE_KEY });
    }
  }

  return { rows, titleHasContact, blockingDetails };
}
