import { describe, expect, it } from 'vitest';
import { collectScoreEntries } from './engine';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';

// Etapa 6 (valul 3): instantaneul intrarilor de scor pe versiunile NOI (kitchen v4, ..., catalog v2).
// Generat o singura data la comutarea CURRENT_FLOW_VERSION; orice diferenta ulterioara inseamna
// ca s-a schimbat costul in credite al unei cereri noi. Versiunile vechi raman in score-invariance.json.
describe('punctajul pe versiunile noi (etapa 6)', () => {
  it('intrarile de scor pe toate flow-urile noi si variantele de raspuns', async () => {
    const out: Record<string, unknown> = {};
    for (const { roomType, version, flow } of allFixtureFlows({ only: 'etapa6' })) {
      for (const variant of FIXTURE_VARIANTS) {
        const answers = fixtureAnswers(flow, variant);
        out[`${roomType}@v${version}/${variant}`] = collectScoreEntries(roomType, answers, version);
      }
    }
    expect(Object.keys(out).length).toBeGreaterThan(0);
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__snapshots__/score-v6.json');
  });
});
