import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { clientIpOf, throttleBucket } from '../http/client-ip';

type TrackedRequest = { ip?: string; clientIp?: string | null; user?: { sub?: string } };

// E-admin-platform-5: guard global (APP_GUARD) — limitele per IP (invarianta 3.13: 100/min
// global, 5/min login) cheie pe IP-ul real al clientului (common/http/client-ip.ts), IPv6 pe /64.
// Tracker-ul sta in subclasa: in throttler v6 un getTracker la nivel de modul ar suprascrie metoda.
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return throttleBucket(clientIpOf(req as TrackedRequest));
  }
}

// Limita per utilizator autentificat. DOAR ca guard de ruta (@UseGuards), dupa JwtAuthGuard
// global — guard-ul global de throttling ruleaza inaintea JWT si nu vede req.user.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const tracked = req as TrackedRequest;
    return tracked.user?.sub ? `user:${tracked.user.sub}` : throttleBucket(clientIpOf(tracked));
  }
}
