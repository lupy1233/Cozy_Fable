import { IsIn, IsUUID } from 'class-validator';

export class PurchaseCreditsDto {
  @IsUUID()
  creditPackageId: string;
}

export class PurchaseSubscriptionDto {
  @IsUUID()
  planId: string;
}

export class PaymentWebhookDto {
  @IsUUID()
  orderId: string;

  @IsIn(['CONFIRMED', 'CANCELLED'])
  status: 'CONFIRMED' | 'CANCELLED';
}
