import {
  collectScoreEntries,
  ERROR_CODES,
  getFlow,
  isFlowVersionRegistered,
  validateRoomAnswers,
  visibleSteps,
  type AnswerMap,
  type DerivedRoom,
  type RoomType,
  type ScoreEntry,
} from '@marketplace/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfiguratorRoomInputDto } from './dto/request.dto';

// O camera procesata: forma legacy derivata (pentru persistenta + afisare) +
// answers-ul brut canonic + intrarile de scoring (rezolvate ulterior din DB).
export interface ProcessedRoom {
  sourceLocalId?: string;
  roomType: RoomType;
  flowVersion: number;
  answers: AnswerMap;
  derived: DerivedRoom;
  scoreEntries: ScoreEntry[];
}

export interface ProcessedRooms {
  rooms: ProcessedRoom[];
  scoreEntries: ScoreEntry[];
}

// Valideaza raspunsurile configuratorului contra flow-urilor din @marketplace/shared
// si deriva forma legacy (rooms/items/dims) + scoringul. Sursa de adevar server:
// clientul nu trimite niciodata dims/items/scoruri, doar answers brute.
// Moduri de relaxare a validarii stricte de publish (PO 2026-07-31):
// - ownProject: clientul are proiect tehnic → dimensiunile nu mai sunt obligatorii
//   (proiectul atasat la pasul Fisiere e sursa de adevar pentru firme).
// - designBrief: cerere cu "Proiectare platita" pornita pe fluxul "am nevoie de
//   ajutor" → camerele pot ramane fara raspunsuri (brief minimal); ce e raspuns
//   ramane validat strict, cheile necunoscute raman respinse.
export interface ProcessRoomsOptions {
  ownProject?: boolean;
  designBrief?: boolean;
}

@Injectable()
export class ConfiguratorService {
  // partial=false: validare stricta de publicare (toate step-urile obligatorii vizibile
  // trebuie raspunse). Arunca BadRequest cu detalii per camera/step la esec.
  processRooms(rooms: ConfiguratorRoomInputDto[], opts: ProcessRoomsOptions = {}): ProcessedRooms {
    const processed: ProcessedRoom[] = [];
    const sourceIds = rooms.flatMap((room) => room.sourceLocalId ? [room.sourceLocalId] : []);
    if (new Set(sourceIds).size !== sourceIds.length) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'Duplicate request entry identity' });
    }

    rooms.forEach((room, roomIndex) => {
      // orice versiune INREGISTRATA e acceptata: cererile publicate pe o versiune
      // veche raman valide la edit/republish; doar versiunile necunoscute pica
      if (!isFlowVersionRegistered(room.roomType, room.flowVersion)) {
        throw new BadRequestException({
          code: ERROR_CODES.CONFIGURATOR_FLOW_VERSION_UNSUPPORTED,
          message: 'Configurator flow version is not registered',
          details: { roomIndex, roomType: room.roomType, got: room.flowVersion },
        });
      }
      const flow = getFlow(room.roomType, room.flowVersion);

      const answers = room.answers as AnswerMap;
      const validation = validateRoomAnswers(room.roomType, answers, {
        partial: opts.designBrief === true,
        ownProject: opts.ownProject === true,
        version: room.flowVersion,
      });
      if (!validation.ok) {
        throw new BadRequestException({
          code: ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID,
          message: 'Configurator answers are invalid',
          details: validation.errors.map((e) => ({ roomIndex, ...e })),
        });
      }

      const derived = flow.deriveRoom(answers);
      // Unde dimensiunile sunt obligatorii, o camera derivata cu lungime/latime/
      // inaltime 0 nu poate pleca in marketplace (firma ar vedea "0 × 0.6 m").
      // Camerele cu proiect propriu sau brief de proiectare pot ramane fara
      // dimensiuni (PO 2026-07-31) — FE le afiseaza "Dimensiuni nespecificate".
      if (opts.ownProject !== true && opts.designBrief !== true) {
        const zeroDims = derived.lengthM <= 0 || derived.widthM <= 0 || derived.heightM <= 0;
        const dimStep = zeroDims
          ? visibleSteps(flow, answers).find(
              (step) =>
                step.type === 'dimension-group' &&
                answers[step.id] !== undefined &&
                step.slots(answers).some((slot) => slot.countsTowardLinear),
            )
          : undefined;
        if (dimStep) {
          throw new BadRequestException({
            code: ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID,
            message: 'Configurator answers are invalid',
            details: [{ roomIndex, stepId: dimStep.id, messageKey: 'validation.dimensionOutOfRange' }],
          });
        }
      }

      processed.push({
        sourceLocalId: room.sourceLocalId,
        roomType: room.roomType,
        flowVersion: room.flowVersion,
        answers,
        derived,
        scoreEntries: collectScoreEntries(room.roomType, answers, room.flowVersion),
      });
    });

    return {
      rooms: processed,
      scoreEntries: processed.flatMap((p) => p.scoreEntries),
    };
  }

  // Aduna attachment id-urile din step-urile 'upload' (schita per camera,
  // snapshot3d) impreuna cu camera si pasul lor — erorile de apartenenta pot
  // indica exact unde e fisierul lipsa. Verificarea: RequestsService la publish/edit.
  collectUploadAttachmentRefs(rooms: ProcessedRoom[]): { roomIndex: number; stepId: string; id: string }[] {
    const refs: { roomIndex: number; stepId: string; id: string }[] = [];
    rooms.forEach((room, roomIndex) => {
      const flow = getFlow(room.roomType, room.flowVersion);
      for (const step of flow.steps) {
        if (step.type !== 'upload') continue;
        const answer = room.answers[step.id];
        if (Array.isArray(answer)) {
          for (const id of answer) {
            if (typeof id === 'string') refs.push({ roomIndex, stepId: step.id, id });
          }
        }
      }
    });
    return refs;
  }

  collectUploadAttachmentIds(rooms: ProcessedRoom[]): string[] {
    return this.collectUploadAttachmentRefs(rooms).map((ref) => ref.id);
  }
}
