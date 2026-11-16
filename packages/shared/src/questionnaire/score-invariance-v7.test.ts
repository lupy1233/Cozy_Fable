import { describe, expect, it } from 'vitest';
import { collectScoreEntries } from './engine';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';

// Etapa 10 (valul 2): instantaneul intrarilor de scor pe versiunile formularului v7 (kitchen v5, ..., canapea v3).
// Generat o singura data la comutarea CURRENT_FLOW_VERSION; orice diferenta ulterioara inseamna
// ca s-a schimbat costul in credite al unei cereri noi. Versiunile mai vechi raman in score-invariance.json / score-v6.json.
describe('punctajul pe versiunile noi (etapa 10)', () => {
  it('intrarile de scor pe toate flow-urile noi si variantele de raspuns', async () => {
    const out: Record<string, unknown> = {};
    for (const { roomType, version, flow } of allFixtureFlows({ only: 'etapa10' })) {
      for (const variant of FIXTURE_VARIANTS) {
        const answers = fixtureAnswers(flow, variant);
        out[`${roomType}@v${version}/${variant}`] = collectScoreEntries(roomType, answers, version);
      }
    }
    expect(Object.keys(out).length).toBeGreaterThan(0);
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__snapshots__/score-v7.json');
  });
});
