import { MarketplaceBudgetEstimator } from './marketplace-budget-estimate';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// b11: reperul "Estimare din raspunsuri" la firma — acelasi calcul ca estimarea clientului
// (scorul de baza × 1.000 lei, fara treapta de buget, fara proiectare, validare partiala).
function make(baseScore = 25, processRooms?: jest.Mock) {
  const configurator: Any = { processRooms: processRooms ?? jest.fn().mockReturnValue({ rooms: [], scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'KITCHEN' }] }) };
  const sizing: Any = { compute: jest.fn().mockResolvedValue({ score: 40, size: 'MEDIUM', creditCost: 25, baseScore }) };
  return { estimator: new MarketplaceBudgetEstimator(configurator, sizing), configurator, sizing };
}

const room = (over: Record<string, unknown> = {}) => ({
  roomType: 'KITCHEN' as const,
  flowVersion: 3,
  answers: { length: 2.4 },
  needsDesignHelp: false,
  ...over,
});

describe('MarketplaceBudgetEstimator (b11)', () => {
  it('scorul de baza × 1.000 lei, calculat ca la client', async () => {
    const { estimator, configurator, sizing } = make(25);
    await expect(estimator.estimateMinRon([room()])).resolves.toBe(25000);
    expect(configurator.processRooms).toHaveBeenCalledWith(
      [{ roomType: 'KITCHEN', flowVersion: 3, answers: { length: 2.4 }, needsDesignHelp: false }],
      { designBrief: true },
    );
    expect(sizing.compute).toHaveBeenCalledWith(expect.objectContaining({ budgetRange: 'UNDISCLOSED', includesPaidDesign: false }));
  });

  it('camera cu ajutor fara raspunsuri intra ca la publicare', async () => {
    const { estimator, configurator } = make(10);
    await expect(estimator.estimateMinRon([room({ answers: null, needsDesignHelp: true })])).resolves.toBe(10000);
    expect(configurator.processRooms.mock.calls[0][0][0].answers).toEqual({});
  });

  it('camere din formularul vechi sau nicio camera → fara reper', async () => {
    const { estimator, configurator } = make();
    await expect(estimator.estimateMinRon([])).resolves.toBeNull();
    await expect(estimator.estimateMinRon([room({ flowVersion: null })])).resolves.toBeNull();
    await expect(estimator.estimateMinRon([room({ answers: null })])).resolves.toBeNull();
    expect(configurator.processRooms).not.toHaveBeenCalled();
  });

  it('raspunsuri care nu mai trec validarea sau scor 0 → fara reper, fara eroare', async () => {
    const throwing = jest.fn(() => {
      throw new Error('invalid');
    });
    await expect(make(25, throwing).estimator.estimateMinRon([room()])).resolves.toBeNull();
    await expect(make(0).estimator.estimateMinRon([room()])).resolves.toBeNull();
  });
});
