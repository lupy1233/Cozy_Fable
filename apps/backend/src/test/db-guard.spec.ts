import { assertSafeTestDatabaseUrl, testDatabaseUrl } from './db-guard';

// E-admin-platform-14 — garda de host pentru testele de integrare.
describe('assertSafeTestDatabaseUrl', () => {
  it.each([
    'postgresql://u:p@localhost:5432/x',
    'postgresql://u:p@127.0.0.1:5432/x',
    'postgresql://u:p@[::1]:5432/x',
    'postgres://u:p@postgres:5432/x',
    'postgresql://u:p@LOCALHOST:5432/x',
  ])('accepta %s', (raw) => {
    expect(() => assertSafeTestDatabaseUrl(raw)).not.toThrow();
  });

  it.each([
    ['postgresql://u:secretpw@db.example.invalid:5432/x', 'db.example.invalid'],
    ['postgresql://u:secretpw@xyz.proxy.rlwy.net:12345/railway', 'xyz.proxy.rlwy.net'],
    ['postgresql://u:secretpw@postgres.railway.internal:5432/railway', 'postgres.railway.internal'],
  ])('refuza %s si numeste doar host-ul', (raw, host) => {
    let message = '';
    try {
      assertSafeTestDatabaseUrl(raw);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('Refuz sa rulez testele de integrare');
    expect(message).toContain(`"${host}"`);
    expect(message).not.toContain('u:secretpw');
    expect(message).not.toContain('secretpw');
  });

  it('refuza alt protocol (mysql://localhost)', () => {
    expect(() => assertSafeTestDatabaseUrl('mysql://u:secretpw@localhost:3306/x')).toThrow(/protocolul "mysql:"/);
  });

  it('refuza un text care nu e URL', () => {
    expect(() => assertSafeTestDatabaseUrl('not a url')).toThrow(/nu este un URL valid/);
  });
});

describe('testDatabaseUrl', () => {
  const saved = process.env.TEST_DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = saved;
  });

  it('fara variabila → undefined (suita de integrare se sare)', () => {
    delete process.env.TEST_DATABASE_URL;
    expect(testDatabaseUrl()).toBeUndefined();
  });

  it('host local → intoarce URL-ul', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://u:p@localhost:5432/x';
    expect(testDatabaseUrl()).toBe('postgresql://u:p@localhost:5432/x');
  });

  it('host la distanta → arunca', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://u:p@db.example.invalid:5432/x';
    expect(() => testDatabaseUrl()).toThrow(/db\.example\.invalid/);
  });
});
