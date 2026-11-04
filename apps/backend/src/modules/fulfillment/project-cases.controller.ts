import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { ProjectCasesService } from './project-cases.service';
import { ProjectClosureService } from './project-closure.service';
import {
  AdminRequestsQueryDto,
  CloseProjectDto,
  DismissProjectCaseDto,
  OpenProjectCaseDto,
  RespondProjectCaseDto,
} from './dto/fulfillment.dto';

// E-admin-platform-3 — controllere subtiri; ownership, stari si decontare in services.
// Audit: entityId = id-ul din raspuns (cazul) → entityType 'project_case' pe raport/raspuns.

// Clientul raporteaza un proiect acceptat blocat / raspunde raportului firmei.
@Controller('requests')
@Roles(UserRole.CLIENT)
@UseInterceptors(AuditInterceptor)
export class ClientProjectCaseController {
  constructor(private readonly cases: ProjectCasesService) {}

  @Get(':id/project-case')
  get(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.cases.getForClient(user.sub, id);
  }

  @Post(':id/project-case')
  @Audit('PROJECT_CASE_OPENED', 'project_case')
  open(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpenProjectCaseDto,
  ) {
    return this.cases.open({ kind: 'CLIENT', userId: user.sub }, id, dto);
  }

  @Post(':id/project-case/respond')
  @Audit('PROJECT_CASE_RESPONDED', 'project_case')
  respond(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProjectCaseDto,
  ) {
    return this.cases.respond({ kind: 'CLIENT', userId: user.sub }, id, dto);
  }
}

// Firma castigatoare (OWNER/MANAGER, verificat in service) raporteaza / raspunde.
@Controller('company/requests')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
@UseInterceptors(AuditInterceptor)
export class CompanyProjectCaseController {
  constructor(private readonly cases: ProjectCasesService) {}

  @Post(':id/project-case')
  @Audit('PROJECT_CASE_OPENED', 'project_case')
  open(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpenProjectCaseDto,
  ) {
    return this.cases.open({ kind: 'COMPANY', userId: user.sub, ctx }, id, dto);
  }

  @Post(':id/project-case/respond')
  @Audit('PROJECT_CASE_RESPONDED', 'project_case')
  respond(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProjectCaseDto,
  ) {
    return this.cases.respond({ kind: 'COMPANY', userId: user.sub, ctx }, id, dto);
  }
}

// Admin: proiectele acceptate, detaliu cu cronologie + inchiderea auditata (3.9).
@Controller('admin/requests')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminRequestsController {
  constructor(
    private readonly cases: ProjectCasesService,
    private readonly closure: ProjectClosureService,
  ) {}

  @Get()
  list(@Query() query: AdminRequestsQueryDto) {
    return this.cases.listAdmin(query.filter ?? 'accepted', query.page ?? 1);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.cases.getAdminRequestDetail(id);
  }

  @Post(':id/close')
  @HttpCode(200)
  @Audit('PROJECT_CLOSED', 'request')
  close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseProjectDto,
  ) {
    return this.closure.closeAcceptedProject(user.sub, id, dto);
  }
}

@Controller('admin/project-cases')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminProjectCasesController {
  constructor(private readonly cases: ProjectCasesService) {}

  @Post(':id/dismiss')
  @HttpCode(200)
  @Audit('PROJECT_CASE_DISMISSED', 'project_case')
  dismiss(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissProjectCaseDto,
  ) {
    return this.cases.dismiss(user.sub, id, dto);
  }
}
