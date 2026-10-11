describe('standby provider registration', () => {
  const original = process.env.DEPLOYMENT_MODE;

  afterAll(() => {
    if (original === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = original;
  });

  it.each([
    ['../modules/billing/billing.module', 'BillingModule'],
    ['../modules/claims/claims.module', 'ClaimsModule'],
    ['../modules/fulfillment/fulfillment.module', 'FulfillmentModule'],
    ['../modules/notifications/notifications.module', 'NotificationsModule'],
    ['../modules/outbox/outbox.module', 'OutboxModule'],
    ['../modules/quotes/quotes.module', 'QuotesModule'],
    ['../modules/requests/requests.module', 'RequestsModule'],
    ['../modules/uploads/uploads.module', 'UploadsModule'],
  ])('does not register processors from %s', (modulePath, exportName) => {
    process.env.DEPLOYMENT_MODE = 'standby';
    jest.resetModules();

    let providers: Array<{ name?: string }> = [];
    jest.isolateModules(() => {
      const loaded = jest.requireActual<Record<string, object>>(modulePath);
      providers = Reflect.getMetadata('providers', loaded[exportName]) ?? [];
    });

    expect(providers.map((provider) => provider.name).filter((name) => name?.endsWith('Processor')))
      .toEqual([]);
  });
});
