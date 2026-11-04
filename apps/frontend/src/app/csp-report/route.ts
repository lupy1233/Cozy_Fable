// E-admin-platform-56: colector same-origin pentru incalcarile CSP (report-uri + report-to).
// Logica (limite, parsare, mascare) e in lib/csp-report.ts; aici doar handlerul.
import { handleCspReport } from '@/lib/csp-report';

export const dynamic = 'force-dynamic';

export function POST(req: Request): Promise<Response> {
  return handleCspReport(req);
}
