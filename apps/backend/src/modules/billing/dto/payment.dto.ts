import { IsUUID } from 'class-validator';

export class PurchaseCreditsDto {
  @IsUUID()
  creditPackageId: string;
}

export class PurchaseSubscriptionDto {
  @IsUUID()
  planId: string;
}

