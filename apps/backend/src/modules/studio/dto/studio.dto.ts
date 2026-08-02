import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_STUDIO_DRAFT_NAME_LENGTH } from '@marketplace/shared';

// Draft de Studio 3D salvat in cont. `data` e snapshotul complet al
// studioului — forma exacta (piese/scene/goluri) se valideaza in service cu
// studioDraftDataSchema din shared (class-validator nu poate cobori in JSON).
export class SaveStudioDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_STUDIO_DRAFT_NAME_LENGTH)
  name: string;

  @IsObject()
  data: Record<string, unknown>;
}
