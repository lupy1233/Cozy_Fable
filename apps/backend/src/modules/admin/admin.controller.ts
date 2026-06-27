import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AdminService } from './admin.service';
import {
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
  constructor(private readonly admin: AdminService) {}

  @Get('kpi')
  kpi() {
    return this.admin.getKpi();
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

  @Patch('plans/:id')
  @Audit('PLAN_UPDATED', 'subscription_plan')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
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

  @Post('jobs/:queue/:id/retry')
  @Audit('JOB_RETRIED', 'job')
  retryJob(@Param('queue') queue: string, @Param('id') id: string) {
    return this.admin.retryJob(queue, id);
  }
}
