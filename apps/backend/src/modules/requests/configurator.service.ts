import {
  collectScoreEntries,
  ERROR_CODES,
  getFlow,
  isFlowVersionRegistered,
  validateRoomAnswers,
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

      processed.push({
        roomType: room.roomType,
        flowVersion: room.flowVersion,
        answers,
        derived: flow.deriveRoom(answers),
        scoreEntries: collectScoreEntries(room.roomType, answers, room.flowVersion),
      });
    });

    return {
      rooms: processed,
      scoreEntries: processed.flatMap((p) => p.scoreEntries),
    };
  }

  // Aduna attachment id-urile din step-urile 'upload' (schita per camera).
  // Apartenenta lor la cerere e verificata de RequestsService la publish/edit.
  collectUploadAttachmentIds(rooms: ProcessedRoom[]): string[] {
    const ids: string[] = [];
    for (const room of rooms) {
      const flow = getFlow(room.roomType, room.flowVersion);
      for (const step of flow.steps) {
        if (step.type !== 'upload') continue;
        const answer = room.answers[step.id];
        if (Array.isArray(answer)) {
          for (const id of answer) {
            if (typeof id === 'string') ids.push(id);
          }
        }
      }
    }
    return ids;
  }
}
