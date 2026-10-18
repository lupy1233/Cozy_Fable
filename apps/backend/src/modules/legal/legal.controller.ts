import { Body, Controller, Get, Header, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptLegalDto } from './dto/accept-legal.dto';
import { LegalService } from './legal.service';

// E-admin-platform-2: identitatea operatorului (publica) + acceptarea versionata a Termenilor/Politicii.
@Controller('legal')
@UseInterceptors(AuditInterceptor)
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('operator')
  @Header('Cache-Control', 'public, max-age=300')
  operator() {
    return this.legal.getOperator();
  }

  // E-company-9: valorile in vigoare din "Reguli pentru firme" (doar citire, fara audit/idempotenta).
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('firm-rules')
  @Header('Cache-Control', 'public, max-age=300')
  firmRules() {
    return this.legal.getFirmRules();
  }

  // Idempotent prin valoare si fara bani: nu cere Idempotency-Key. Orice rol autentificat.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept')
  @HttpCode(200)
  @Audit('LEGAL_ACCEPTED', 'user')
  accept(@CurrentUser() user: AccessTokenPayload, @Body() dto: AcceptLegalDto) {
    return this.legal.accept(user.sub, dto);
  }
}
