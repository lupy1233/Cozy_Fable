import { IsOptional, IsUUID } from 'class-validator';

export class CreateClaimDto {
  @IsUUID()
  requestId!: string;

  // Optional: atribuie direct unui membru (self-assign daca e propriul id).
  @IsOptional()
  @IsUUID()
  assignToUserId?: string;
}

export class AssignClaimDto {
  @IsUUID()
  assignToUserId!: string;
}
