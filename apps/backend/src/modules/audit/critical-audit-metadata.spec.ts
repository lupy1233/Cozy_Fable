import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { ClaimsController } from '../claims/claims.controller';
import { ClaimLifecycleController, ClientClarificationController } from '../claims/lifecycle.controller';
import { QuotesController, ClientQuotesController } from '../quotes/quotes.controller';
import { AdminPaymentsController, PaymentsController } from '../billing/payments.controller';
import { AdminBillingController } from '../billing/admin-billing.controller';
import { InspirationAdminController } from '../inspiration/inspiration.controller';
import { CompanyDeliveryController, ClientFulfillmentController } from '../fulfillment/fulfillment.controller';
import {
  AdminProjectCasesController,
  AdminRequestsController,
  ClientProjectCaseController,
  CompanyProjectCaseController,
} from '../fulfillment/project-cases.controller';
import { AdminController } from '../admin/admin.controller';
import { AdminCalendarController } from '../admin/admin-calendar.controller';
import { AdminSizingController } from '../admin/admin-sizing.controller';
import { LegalController } from '../legal/legal.controller';
import { CompaniesController } from '../companies/companies.controller';

describe('Critical route audit wiring', () => {
  const routes = [
    [ClaimsController, ['create', 'assign']],
    [ClaimLifecycleController, ['requestClarification', 'withdraw']],
    [ClientClarificationController, ['answer']],
    [QuotesController, ['create', 'revise', 'extra', 'reoffer', 'extend', 'withdraw', 'endNegotiation', 'rejectChange', 'invite']],
    [ClientQuotesController, ['requestChange', 'accept', 'respondInvite', 'requestExtension']],
    [PaymentsController, ['buyCredits', 'buySubscription', 'checkout', 'markPaid']], // E-company-24: markPaid
    [InspirationAdminController, ['create', 'update', 'remove', 'confirmImage', 'completeImage']],
    [CompanyDeliveryController, ['deliver']],
    [ClientFulfillmentController, ['confirm', 'review']],
    // E-admin-platform-3
    [AdminRequestsController, ['close']],
    [AdminProjectCasesController, ['dismiss']],
    [ClientProjectCaseController, ['open', 'respond']],
    [CompanyProjectCaseController, ['open', 'respond']],
    // E-admin-platform-1
    [AdminController, ['sendTestEmail', 'blockUser', 'unblockUser']],
    // E-admin-platform-58: POST /admin/plans (+ PATCH existent)
    [AdminController, ['createPlan', 'updatePlan']],
    // E-admin-platform-2
    [LegalController, ['accept']],
    // E-admin-platform-4
    [AdminPaymentsController, ['confirm', 'cancel', 'updateEInvoice']],
    [AdminBillingController, ['updateSeller']],
    // E-admin-platform-25
    [AdminCalendarController, ['create', 'update', 'remove']],
    [AdminSizingController, ['updateWeights']],
  ] as const;
  for (const [controller, methods] of routes) {
    it(`${controller.name} has an outer audit interceptor and metadata on every listed mutation`, () => {
      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, controller)).toContain(AuditInterceptor);
      for (const method of methods) {
        const handler = (controller.prototype as unknown as Record<string, object>)[method];
        expect(Reflect.getMetadata(AUDIT_ACTION_KEY, handler)).toEqual({ action: expect.any(String), entityType: expect.any(String) });
      }
    });
  }

  // E-client-9: interceptor la nivel de metoda (restul rutelor firmei nu sunt auditate)
  const methodLevelRoutes = [
    [CompaniesController, ['addLocation', 'updateLocation', 'deleteLocation']],
  ] as const;
  for (const [controller, methods] of methodLevelRoutes) {
    it(`${controller.name} has a method-level audit interceptor and metadata on every listed mutation`, () => {
      for (const method of methods) {
        const handler = (controller.prototype as unknown as Record<string, object>)[method];
        expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toContain(AuditInterceptor);
        expect(Reflect.getMetadata(AUDIT_ACTION_KEY, handler)).toEqual({ action: expect.any(String), entityType: 'company_location' });
      }
    });
  }

  // E-company-19: PATCH /companies/me (isVatPayer ajunge pe facturi) e auditat la nivel de metoda
  it('CompaniesController.updateProfile is audited as COMPANY_PROFILE_UPDATED', () => {
    const handler = (CompaniesController.prototype as unknown as Record<string, object>).updateProfile;
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toContain(AuditInterceptor);
    expect(Reflect.getMetadata(AUDIT_ACTION_KEY, handler)).toEqual({ action: 'COMPANY_PROFILE_UPDATED', entityType: 'company' });
  });
});
