import {
  approxLengthApplies,
  collectScoreEntries,
  deriveRoomForFirms,
  ERROR_CODES,
  getFlow,
  isFlowVersionRegistered,
  pruneAnswers,
  validateRoomAnswers,
  visibleSteps,
  type AnswerMap,
  type DerivedRoom,
  type RoomType,
  type ScoreEntry,
} from '@marketplace/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfiguratorRoomInputDto } from './dto/request.dto';
import { assertApproxLengthAllowed } from './publish-rules';

// O camera procesata: forma legacy derivata (pentru persistenta + afisare) +
// answers-ul brut canonic + intrarile de scoring (rezolvate ulterior din DB).
export interface ProcessedRoom {
  sourceLocalId?: string;
  roomType: RoomType;
  flowVersion: number;
  // b8: camera cu ajutor de proiectare (answers = doar fisierele ei); processRooms il pune mereu
  needsDesignHelp?: boolean;
  // d3 (PO d3-2): lungimea aproximativa (m), doar cu proiect propriu; null = nedata
  approxLengthM?: number | null;
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
// Moduri de relaxare a validarii stricte de publish:
// - ownProject (PO 2026-07-31): clientul are proiect tehnic → dimensiunile nu mai sunt
//   obligatorii (proiectul atasat la pasul Fisiere e sursa de adevar pentru firme).
// - camera cu needsDesignHelp (b8, PO g0-8 / b8-3, 2026-11-13): "La camera asta am nevoie
//   de ajutor" → raspunsurile la chestionar NU pleaca la firme (raman doar in ciorna
//   clientului); se pastreaza tipul camerei si fisierele ei (pasii 'upload'). Camera se
//   valideaza partial. Celelalte camere se valideaza strict, indiferent de orice bifa.
// - designBrief: validare partiala pe TOATE camerele — doar pentru estimarea informativa
//   (POST /requests/estimate), nu pentru publicare/editare.
export interface ProcessRoomsOptions {
  ownProject?: boolean;
  designBrief?: boolean;
}

// Raspunsurile unei camere cu ajutor: doar pasii de fisiere pe care clientul ii VEDE (schitele);
// pasii ascunsi (snapshot3d = poza piesei configurate) cad, la fel ca fileAnswersOnly din FE.
export function designHelpAnswers(roomType: RoomType, flowVersion: number, answers: AnswerMap): AnswerMap {
  const flow = getFlow(roomType, flowVersion);
  const kept: AnswerMap = {};
  for (const step of flow.steps) {
    if (step.type === 'upload' && !step.hidden && answers[step.id] !== undefined) kept[step.id] = answers[step.id];
  }
  return pruneAnswers(flow, kept);
}

// Id-urile de fisiere (pasi 'upload') din raspunsurile brute ale camerelor cu ajutor care nu mai
// sunt referite de nicio camera procesata (ex. snapshot3d aruncat) — altfel ar ramane pe cerere
// ca "fisier al proiectului" si ar ajunge la firme.
export function droppedDesignHelpUploadIds(rawRooms: ConfiguratorRoomInputDto[], processed: ProcessedRoom[]): string[] {
  const kept = new Set<string>();
  for (const room of processed) {
    for (const value of Object.values(room.answers)) {
      if (Array.isArray(value)) value.forEach((v) => typeof v === 'string' && kept.add(v));
    }
  }
  const dropped = new Set<string>();
  rawRooms.forEach((room) => {
    if (room.needsDesignHelp !== true || !isFlowVersionRegistered(room.roomType, room.flowVersion)) return;
    for (const step of getFlow(room.roomType, room.flowVersion).steps) {
      const value = (room.answers as AnswerMap)[step.id];
      if (step.type !== 'upload' || !Array.isArray(value)) continue;
      for (const id of value) if (typeof id === 'string' && !kept.has(id)) dropped.add(id);
    }
  });
  return [...dropped];
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
    // d3: lungimea aproximativa doar cu proiect propriu (estimarea informativa o accepta oricum)
    if (opts.designBrief !== true) assertApproxLengthAllowed(rooms, opts.ownProject === true);

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
      const needsDesignHelp = room.needsDesignHelp === true;
      const relaxed = needsDesignHelp || opts.designBrief === true;

      const answers = needsDesignHelp
        ? designHelpAnswers(room.roomType, room.flowVersion, room.answers as AnswerMap)
        : (room.answers as AnswerMap);
      const validation = validateRoomAnswers(room.roomType, answers, {
        partial: relaxed,
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

      // d1 (PO d1-1): camera cu ajutor nu primeste piese, materiale si dimensiuni puse din
      // oficiu — firma vede "Detaliile se stabilesc cu firma", iar costul scade corespunzator
      const derived = deriveRoomForFirms(room.roomType, answers, room.flowVersion, { needsDesignHelp });
      // Unde dimensiunile sunt obligatorii, o camera derivata cu lungime/latime/
      // inaltime 0 nu poate pleca in marketplace (firma ar vedea "0 × 0.6 m").
      // Camerele cu proiect propriu sau brief de proiectare pot ramane fara
      // dimensiuni (PO 2026-07-31) — FE le afiseaza "Dimensiuni nespecificate".
      if (opts.ownProject !== true && !relaxed) {
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

      // d3: camera cu ajutor nu are proiect propriu, deci nici lungime aproximativa; iar valoarea
      // se pastreaza doar cand campul are sens (pas de dimensiuni liniar, lungime derivata 0) —
      // o valoare ramasa dupa ce clientul si-a schimbat raspunsurile nu se salveaza si nu se plateste
      const approxLengthM =
        !needsDesignHelp && typeof room.approxLengthM === 'number' && approxLengthApplies(room.roomType, answers, room.flowVersion)
          ? room.approxLengthM
          : null;
      processed.push({
        sourceLocalId: room.sourceLocalId,
        roomType: room.roomType,
        flowVersion: room.flowVersion,
        needsDesignHelp,
        approxLengthM,
        answers,
        derived,
        scoreEntries: collectScoreEntries(room.roomType, answers, room.flowVersion, { needsDesignHelp, approxLengthM }),
      });
    });

    return {
      rooms: processed,
      scoreEntries: processed.flatMap((p) => p.scoreEntries),
    };
  }

  // Trece camera validarea STRICTA de publicare (fara ajutor)? Folosit de compatibilitatea cu
  // interfata veche (b8): doar camerele care nu trec devin brief cu ajutor.
  passesStrictValidation(room: ConfiguratorRoomInputDto, opts: { ownProject?: boolean } = {}): boolean {
    try {
      this.processRooms([{ ...room, needsDesignHelp: false }], { ownProject: opts.ownProject });
      return true;
    } catch (err) {
      if (err instanceof BadRequestException) return false;
      throw err;
    }
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
