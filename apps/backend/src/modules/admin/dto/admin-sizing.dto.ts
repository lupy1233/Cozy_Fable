import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

// E-admin-platform-25: punctele optiunilor (project_sizing_config). Oglinda
// sizingWeightChangesSchema (shared): doar randuri existente, 0..100.
export class SizingWeightChangeDto {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  @Max(100)
  weight: number;
}

export class UpdateSizingWeightsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SizingWeightChangeDto)
  changes: SizingWeightChangeDto[];
}
