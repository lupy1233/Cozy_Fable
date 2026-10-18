import type { RoomType } from '../enums';
import type { RequestItemInput } from '../request.schemas';
import { maskContactInfo } from '../contact-detection';
import { getFlow, isFlowVersionRegistered } from './engine';
import type { AnswerMap, AnswerValue } from './types';

// Textele libere dintr-o camera (E-admin-platform-45): raspunsurile step-urilor
// 'text' si name/description din piesele step-urilor 'pieces'. Se parcurg TOATE
// step-urile (nu doar cele vizibile) — un raspuns ramas dintr-o ramura ascunsa
// ajunge oricum in answers.

export interface FreeTextAnswer {
  stepId: string;
  // ex. 'notes', 'extraPieces[0].description'
  path: string;
  value: string;
}

function isPieceArray(value: AnswerValue | undefined): value is RequestItemInput[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null);
}

// Fallback pentru versiuni de flow neinregistrate: toate frunzele string.
function walkStrings(value: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof value === 'string') {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, out);
  }
}

function deepMaskStrings(value: unknown): unknown {
  if (typeof value === 'string') return maskContactInfo(value);
  if (Array.isArray(value)) return value.map(deepMaskStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepMaskStrings(v)]));
  }
  return value;
}

export function collectFreeTextAnswers(
  roomType: RoomType,
  flowVersion: number,
  answers: AnswerMap,
): FreeTextAnswer[] {
  const out: FreeTextAnswer[] = [];
  if (!isFlowVersionRegistered(roomType, flowVersion)) {
    for (const [stepId, value] of Object.entries(answers)) {
      const leaves: { path: string; value: string }[] = [];
      walkStrings(value, stepId, leaves);
      for (const leaf of leaves) out.push({ stepId, ...leaf });
    }
    return out;
  }
  for (const step of getFlow(roomType, flowVersion).steps) {
    const answer = answers[step.id];
    if (step.type === 'text') {
      if (typeof answer === 'string' && answer.length > 0) {
        out.push({ stepId: step.id, path: step.id, value: answer });
      }
    } else if (step.type === 'pieces' && isPieceArray(answer)) {
      answer.forEach((piece, i) => {
        if (typeof piece.name === 'string' && piece.name.length > 0) {
          out.push({ stepId: step.id, path: `${step.id}[${i}].name`, value: piece.name });
        }
        if (typeof piece.description === 'string' && piece.description.length > 0) {
          out.push({
            stepId: step.id,
            path: `${step.id}[${i}].description`,
            value: piece.description,
          });
        }
      });
    }
  }
  return out;
}

// Copie a raspunsurilor cu contactele din textele libere inlocuite cu tokenul.
// Restul raspunsurilor (id-uri de upload, configuratii 3D, dimensiuni) raman identice.
export function maskRoomAnswers(
  roomType: RoomType,
  flowVersion: number,
  answers: AnswerMap,
): AnswerMap {
  if (!isFlowVersionRegistered(roomType, flowVersion)) {
    return deepMaskStrings(answers) as AnswerMap;
  }
  const out: AnswerMap = { ...answers };
  for (const step of getFlow(roomType, flowVersion).steps) {
    const answer = answers[step.id];
    if (step.type === 'text' && typeof answer === 'string') {
      out[step.id] = maskContactInfo(answer);
    } else if (step.type === 'pieces' && isPieceArray(answer)) {
      out[step.id] = answer.map((piece) => ({
        ...piece,
        name: typeof piece.name === 'string' ? maskContactInfo(piece.name) : piece.name,
        description:
          typeof piece.description === 'string'
            ? maskContactInfo(piece.description)
            : piece.description,
      }));
    }
  }
  return out;
}
