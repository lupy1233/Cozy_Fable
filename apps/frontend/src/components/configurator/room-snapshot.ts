import {
  summarizeAnswers,
  type AnswerMap,
  type AttachmentDto,
  type RequestRoomDto,
} from '@marketplace/shared';

// Imaginea 3D a piesei pe pagina cererii (d4): fisierul din answers.snapshot3d, aratat in
// cardul piesei (RoomSpecCard) doar cand camera are configuratia 3D si fisierul are link.
// Aceeasi regula o foloseste pagina cererii ca sa nu arate imaginea a doua oara la "Atașamente".
export function roomSnapshotAttachment(
  room: Pick<RequestRoomDto, 'roomType' | 'answers' | 'flowVersion' | 'needsDesignHelp'>,
  attachments: AttachmentDto[] | undefined,
): AttachmentDto | undefined {
  // camera cu ajutor la proiectare vine fara configuratie (cardul arata doar fisierele ei)
  if (room.needsDesignHelp === true || !room.answers) return undefined;
  const answers = room.answers as AnswerMap;
  let hasConfig3d = false;
  try {
    hasConfig3d = summarizeAnswers(room.roomType, answers, room.flowVersion ?? 1).some((e) => e.kind === 'config3d');
  } catch {
    return undefined;
  }
  if (!hasConfig3d) return undefined;
  const ids = answers.snapshot3d;
  if (!Array.isArray(ids)) return undefined;
  return (attachments ?? []).find((a) => (ids as unknown[]).includes(a.id) && a.downloadUrl);
}
