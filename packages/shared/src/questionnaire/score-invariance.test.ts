import { describe, expect, it } from 'vitest';
import { collectScoreEntries } from './engine';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';

// d1 (etapa 3): rescrierea textelor generate pentru firma NU are voie sa schimbe punctajul
// unei cereri obisnuite. Instantaneul a fost scris INAINTE de rescriere (commit f10eac4) —
// orice diferenta aici inseamna ca s-a schimbat costul in credite.
describe('punctajul cererilor obisnuite e neschimbat de textele pentru firma', () => {
  it('intrarile de scor pe toate flow-urile, versiunile si variantele de raspuns', async () => {
    const out: Record<string, unknown> = {};
    // etapa 6: doar versiunile de dinainte (instantaneul ramane byte-identic)
    for (const { roomType, version, flow } of allFixtureFlows({ only: 'legacy' })) {
      for (const variant of FIXTURE_VARIANTS) {
        const answers = fixtureAnswers(flow, variant);
        out[`${roomType}@v${version}/${variant}`] = collectScoreEntries(roomType, answers, version);
      }
    }
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__snapshots__/score-invariance.json');
  });
});
