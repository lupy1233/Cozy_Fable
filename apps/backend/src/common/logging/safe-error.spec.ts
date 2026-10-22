import { safeErrorSummary, topStackFrame } from './safe-error';

describe('safe provider error logging', () => {
  it('retains operational classification without raw details', () => {
    const error = Object.assign(new Error('private@example.invalid https://host?token=secret'), { code: 'ECONNREFUSED', statusCode: 502, response: { password: 'secret' } });
    expect(safeErrorSummary(error)).toBe('kind=Error code=ECONNREFUSED status=502');
  });
  it('does not trust arbitrary name, code, status or non-error text', () => {
    expect(safeErrorSummary({ name: 'Private person', code: 'secret-token', statusCode: 'private@example.invalid', message: 'secret' })).toBe('kind=Error');
    expect(safeErrorSummary('raw token')).toBe('kind=Error');
  });
  it('keeps safe Prisma and SMTP codes', () => {
    expect(safeErrorSummary({ name: 'PrismaClientKnownRequestError', code: 'P2034' })).toBe('kind=PrismaClientKnownRequestError code=P2034');
    expect(safeErrorSummary({ code: 'EAUTH', responseCode: 535 })).toBe('kind=Error code=EAUTH status=535');
  });
});

describe('topStackFrame (E-admin-platform-8)', () => {
  it('returns the first app frame as a relative path without the message line', () => {
    const error = new Error('private@example.invalid');
    error.stack = [
      'Error: private@example.invalid',
      '    at Object.fn (F:\\x\\node_modules\\@nestjs\\core\\router.js:3:1)',
      '    at AdminController.run (F:\\Cozy Fable\\apps\\backend\\dist\\modules\\a\\b.js:12:5)',
      '    at node:internal/process/task_queues:95:5',
    ].join('\n');
    expect(topStackFrame(error)).toBe('dist/modules/a/b.js:12');
  });
  it('skips node: frames, handles posix paths and falls back to unknown', () => {
    const error = new Error('x');
    error.stack = 'Error: x\n    at node:internal/timers:1:1\n    at run (/app/apps/backend/src/modules/q.ts:7:9)';
    expect(topStackFrame(error)).toBe('src/modules/q.ts:7');
    expect(topStackFrame('not an error')).toBe('unknown');
    expect(topStackFrame({ stack: 42 })).toBe('unknown');
  });
  it('whitelists TimeoutError and AbortError kinds', () => {
    expect(safeErrorSummary({ name: 'TimeoutError' })).toBe('kind=TimeoutError');
    expect(safeErrorSummary({ name: 'AbortError' })).toBe('kind=AbortError');
  });
});
