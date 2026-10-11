// Erorile externe pot include corpuri de mesaje, adrese si URL-uri cu token.
// Retinem doar clasificari operationale, niciodata message/stack/response/payload.
export function safeErrorSummary(error: unknown): string {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const names = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientInitializationError', 'PrismaClientValidationError', 'StripeError', 'StripeAPIError', 'StripeConnectionError', 'StripeAuthenticationError', 'StripeInvalidRequestError', 'StripeSignatureVerificationError', 'TimeoutError', 'AbortError'];
  const kind = typeof fields.name === 'string' && names.includes(fields.name) ? fields.name : 'Error';
  const code = typeof fields.code === 'string' && /^(?:P\d{4}|E[A-Z_]{2,40})$/.test(fields.code) ? ` code=${fields.code}` : '';
  const status = [fields.statusCode, fields.status, fields.responseCode].find((value) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599);
  return `kind=${kind}${code}${status !== undefined ? ` status=${status}` : ''}`;
}

// Primul cadru din codul aplicatiei (fara node_modules/node:), ca `dist/modules/x/y.js:12`.
// Citeste doar liniile `at ...` din stack — niciodata linia de mesaj.
export function topStackFrame(error: unknown): string {
  const stack = error && typeof error === 'object' ? (error as { stack?: unknown }).stack : undefined;
  if (typeof stack !== 'string') return 'unknown';
  for (const line of stack.split('\n')) {
    if (!/^\s*at\s/.test(line)) continue;
    // locatia = continutul ultimei paranteze sau, fara paranteze, textul de dupa `at`
    const location = line.includes('(') ? line.slice(line.lastIndexOf('(') + 1) : line.replace(/^\s*at\s+/, '');
    if (location.startsWith('node:') || location.includes('node_modules')) continue;
    // caile pot contine spatii (ex. "F:\Cozy Fable\..."), deci doar ():\n sunt excluse
    const match = /^((?:[A-Za-z]:)?[^():\n]+?):(\d+):\d+\)?\s*$/.exec(location.trim());
    if (!match) continue;
    const rawPath = match[1];
    const path = rawPath.replace(/\\/g, '/');
    const marker = Math.max(path.lastIndexOf('/src/'), path.lastIndexOf('/dist/'));
    const short = marker >= 0 ? path.slice(marker + 1) : path.slice(path.lastIndexOf('/') + 1);
    return `${short}:${match[2]}`;
  }
  return 'unknown';
}
