import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { PenaltiesService } from './penalties.service';

// Firma isi vede soldul de penalizari + statusul de suspendare (4.12). NU foloseste
// CompanyApprovedGuard: o firma SUSPENDED trebuie sa-si poata vedea exact motivul.
@Controller('penalties')
@Roles(UserRole.COMPANY_USER)
export class PenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  @Get('me')
  myStatus(@CurrentUser() user: AccessTokenPayload) {
    return this.penalties.getStatusForUser(user.sub);
  }
}
