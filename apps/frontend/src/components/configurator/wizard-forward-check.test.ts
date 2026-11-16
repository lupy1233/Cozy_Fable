import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }), Link: () => null }));
import { useConfiguratorStore } from '@/stores/configurator-store';
import { canLeaveScreenForward } from './configurator-wizard';
import { roomIssue } from './room-screens';

// m11 (revizuire etapa 12): Forward din browser trece de un ecran doar daca „Continua” ar trece
const store = () => useConfiguratorStore.getState();

beforeEach(() => {
  localStorage.clear();
  store().reset();
  store().setStartMode('STANDARD');
});

describe('canLeaveScreenForward', () => {
  it('the cart needs at least one room', () => {
    store().setPhase('cart');
    expect(canLeaveScreenForward(store())).toBe(false);
    store().addRoom('KITCHEN');
    expect(canLeaveScreenForward(store())).toBe(true);
  });

  it('a questions screen with an empty required answer does not let Forward through; the Summary flags the room', () => {
    store().addRoom('KITCHEN');
    store().setActiveRoom(0);
    store().setPhase('rooms');
    expect(canLeaveScreenForward(store())).toBe(false);
    // Sumarul prinde oricum camera incompleta (nu se bazeaza pe Forward / bifa „completed”)
    expect(roomIssue(store().roomInstances[0]!, { ownProject: false })).not.toBeNull();
  });

  it('General details: empty → no; complete → yes', () => {
    store().addRoom('KITCHEN');
    store().setPhase('details');
    expect(canLeaveScreenForward(store())).toBe(false);
    store().setDetails({
      addressText: 'Strada Lunga 1',
      county: 'Cluj',
      city: 'Cluj-Napoca',
      country: 'RO',
      budgetRange: 'UNDISCLOSED',
      budgetChosen: true,
      contactPreferences: [{ channel: 'EMAIL', value: 'ana@example.com' }],
    });
    expect(canLeaveScreenForward(store())).toBe(true);
  });

  it('other screens (files, review) do not block', () => {
    store().setPhase('uploads');
    expect(canLeaveScreenForward(store())).toBe(true);
  });
});
