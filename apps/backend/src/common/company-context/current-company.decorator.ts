import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CompanyContext, RequestWithCompany } from './company-context';

// Injecteaza companyContext setat de CompanyApprovedGuard/SubscriptionActiveGuard.
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompanyContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithCompany>();
    return req.companyContext as CompanyContext;
  },
);
