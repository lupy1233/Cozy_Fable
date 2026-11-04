import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { MonitoringTestError } from '../../infra/monitoring/error-tracking';
import { AdminService } from './admin.service';
import { LedgerCheckService, type LedgerCheckReport } from '../billing/ledger-check.service';
import {
  AdminUsersQueryDto,
  CreatePlanDto,
  UpdateCreditPackageDto,
  UpdatePenaltyRuleDto,
  UpdatePlanDto,
  UpdateSettingDto,
  UpdateThresholdDto,
  UpsertCreditPackageDto,
} from './dto/admin.dto';

// Consola admin (4.19). @Audit pe scrieri (interceptorul logheaza doar rutele marcate).
@Controller('admin')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly ledgerCheck: LedgerCheckService,
  ) {}

  @Get('kpi')
  kpi() {
    return this.admin.getKpi();
  }

  // ===== Utilizatori (pasul 6, D-L1-2) =====

  @Get('users')
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query.q, query.role);
  }

  @Post('users/:id/block')
  @HttpCode(200)
  @Audit('USER_BLOCKED', 'user')
  blockUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.blockUser(id);
  }

  @Post('users/:id/unblock')
  @HttpCode(200)
  @Audit('USER_UNBLOCKED', 'user')
  unblockUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.unblockUser(id);
  }

  @Get('audit-logs')
  auditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.admin.getAuditLogs(Number(page) || 1, Number(pageSize) || 25, { action, entityType, userId });
  }

  // Email de test (E-admin-platform-1): doar catre adresa adminului curent; snapshotul
  // de audit pastreaza doar ok (allowlist audit-snapshot).
  @Post('mail/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Audit('MAIL_TEST_SENT', 'mail')
  sendTestEmail(@CurrentUser() user: AccessTokenPayload) {
    return this.admin.sendTestEmail(user.sub);
  }

  // E-admin-platform-8: eroare de test pentru tracker (GET: merge si pe standby, nu scrie nimic)
  @Get('monitoring/test-error')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  monitoringTestError(): never {
    throw new MonitoringTestError();
  }

  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Put('settings/:key')
  @Audit('SETTING_UPDATED', 'system_setting')
  updateSetting(
    @CurrentUser() user: AccessTokenPayload,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.admin.updateSetting(key, dto.value, user.sub);
  }

  @Get('penalty-rules')
  penaltyRules() {
    return this.admin.getPenaltyRules();
  }

  @Patch('penalty-rules/:id')
  @Audit('PENALTY_RULE_UPDATED', 'penalty_rule')
  updatePenaltyRule(@Param('id') id: string, @Body() dto: UpdatePenaltyRuleDto) {
    return this.admin.updatePenaltyRule(id, dto);
  }

  @Get('credit-packages')
  creditPackages() {
    return this.admin.getCreditPackages();
  }

  @Post('credit-packages')
  @Audit('CREDIT_PACKAGE_CREATED', 'credit_package')
  createCreditPackage(@Body() dto: UpsertCreditPackageDto) {
    return this.admin.createCreditPackage(dto);
  }

  @Patch('credit-packages/:id')
  @Audit('CREDIT_PACKAGE_UPDATED', 'credit_package')
  updateCreditPackage(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    return this.admin.updateCreditPackage(id, dto);
  }

  @Get('plans')
  plans() {
    return this.admin.getPlans();
  }

  // E-admin-platform-58: plan nou (cod unic, pret >= 0, acces marketplace ales explicit)
  @Post('plans')
  @Audit('PLAN_CREATED', 'subscription_plan')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.admin.createPlan(dto);
  }

  @Patch('plans/:id')
  @Audit('PLAN_UPDATED', 'subscription_plan')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto);
  }

  @Get('thresholds')
  thresholds() {
    return this.admin.getThresholds();
  }

  @Patch('thresholds/:id')
  @Audit('THRESHOLD_UPDATED', 'project_size_threshold')
  updateThreshold(@Param('id') id: string, @Body() dto: UpdateThresholdDto) {
    return this.admin.updateThreshold(id, dto);
  }

  @Get('jobs')
  jobs() {
    return this.admin.getFailedJobs();
  }

  // E-admin-platform-15: raportul ledger vs portofel la cerere (doar citiri, fara alerta/audit)
  @Get('credits/ledger-check')
  ledgerCheckReport(): Promise<LedgerCheckReport> {
    return this.ledgerCheck.check();
  }

  @Post('jobs/:queue/:id/retry')
  @Audit('JOB_RETRIED', 'job')
  retryJob(@Param('queue') queue: string, @Param('id') id: string) {
    return this.admin.retryJob(queue, id);
  }
}
