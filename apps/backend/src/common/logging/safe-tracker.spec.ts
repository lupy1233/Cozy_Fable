import { scrubServerEvent } from './safe-tracker';

describe('scrubServerEvent (E-admin-platform-8)', () => {
  it('keeps only the exception type, safe summary, frame locations and allowlisted tags', () => {
    const original = new TypeError('private@example.invalid');
    const event = {
      event_id: 'abc',
      release: 'sha',
      request: { url: 'https://x/requests/drafts/secret-token', headers: { cookie: 'mm_access=secret' } },
      user: { email: 'private@example.invalid', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'private@example.invalid' }],
      extra: { body: 'secret' },
      server_name: 'host-with-name',
      modules: { express: '4' },
      contexts: { runtime: { name: 'node' }, os: { name: 'linux' }, trace: { trace_id: 't' }, app: { free_memory: 1 } },
      tags: { traceId: 'trace', route: '/api/v1/requests/:id', release: 'x', email: 'private@example.invalid', slot: 'blue' },
      exception: {
        values: [
          { type: 'Error', value: 'cause private@example.invalid' },
          {
            type: 'TypeError',
            value: 'private@example.invalid',
            stacktrace: {
              frames: [
                {
                  filename: '/app/dist/a.js',
                  function: 'run',
                  lineno: 3,
                  colno: 7,
                  in_app: true,
                  vars: { email: 'private@example.invalid' },
                  pre_context: ['const secret = 1'],
                  context_line: 'throw new TypeError(email)',
                  post_context: ['}'],
                },
              ],
            },
          },
        ],
      },
    };

    const scrubbed = scrubServerEvent(event as Record<string, any>, original);
    const serialized = JSON.stringify(scrubbed);

    for (const leaked of ['private@', 'cookie', 'mm_access', 'secret', '1.2.3.4', 'host-with-name', 'free_memory']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(scrubbed.exception.values[1].type).toBe('TypeError');
    expect(scrubbed.exception.values[1].value).toBe('kind=TypeError');
    expect(scrubbed.exception.values[0].value).toBeUndefined();
    expect(scrubbed.exception.values[1].stacktrace.frames[0]).toEqual({
      filename: '/app/dist/a.js',
      function: 'run',
      lineno: 3,
      colno: 7,
      in_app: true,
    });
    const vendor = scrubServerEvent(
      { exception: { values: [{ type: 'Error', stacktrace: { frames: [{ filename: '/app/node_modules/rxjs/x.js', in_app: true }] } }] } },
      original,
    );
    expect(vendor.exception.values[0].stacktrace.frames[0].in_app).toBe(false);
    expect(scrubbed.tags).toEqual({ traceId: 'trace', route: '/api/v1/requests/:id', slot: 'blue' });
    expect(Object.keys(scrubbed.contexts)).toEqual(['runtime', 'os', 'trace']);
    expect(scrubbed.release).toBe('sha');
  });
});
