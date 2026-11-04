import { CURRENT_FLOW_VERSION, ERROR_CODES } from '@marketplace/shared';
import { BadRequestException } from '@nestjs/common';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import type { ConfiguratorRoomInputDto } from './dto/request.dto';

const service = new ConfiguratorService();

function bedroom(answers: Record<string, unknown> = {}): ConfiguratorRoomInputDto {
  return { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers } as ConfiguratorRoomInputDto;
}

function errorOf(fn: () => unknown): { code?: string; details?: unknown } {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).getResponse() as { code?: string; details?: unknown };
  }
  throw new Error('expected BadRequestException');
}

describe('ConfiguratorService', () => {
  it('collectUploadAttachmentRefs keeps room index and step id', () => {
    const rooms = [
      { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers: {} },
      { roomType: 'BEDROOM', flowVersion: CURRENT_FLOW_VERSION.BEDROOM, answers: { sketch: ['a', 'b'] } },
    ] as unknown as ProcessedRoom[];
    const refs = service.collectUploadAttachmentRefs(rooms);
    expect(refs).toEqual([
      { roomIndex: 1, stepId: 'sketch', id: 'a' },
      { roomIndex: 1, stepId: 'sketch', id: 'b' },
    ]);
    expect(service.collectUploadAttachmentIds(rooms)).toEqual(['a', 'b']);
  });

  it('allows an empty design-brief room (zero derived length is "unknown")', () => {
    const processed = service.processRooms([bedroom()], { designBrief: true });
    expect(processed.rooms).toHaveLength(1);
    expect(processed.rooms[0].derived.lengthM).toBe(0);
  });

  it('rejects an empty room in strict mode with room/step details', () => {
    const body = errorOf(() => service.processRooms([bedroom(), bedroom()]));
    expect(body.code).toBe(ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID);
    const details = body.details as { roomIndex: number; stepId: string; messageKey: string }[];
    expect(details.length).toBeGreaterThan(0);
    expect(details[0].roomIndex).toBe(0);
    expect(typeof details[0].stepId).toBe('string');
  });
});
