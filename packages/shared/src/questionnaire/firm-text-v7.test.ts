import { describe, expect, it } from 'vitest';
import { allFixtureFlows, fixtureAnswers, FIXTURE_VARIANTS } from './firm-text.fixtures';

// Etapa 10 (valul 2): instantaneul textelor pe care le citeste firma (nume + descriere piese,
// cantitate, material, sisteme, dimensiuni, recomandarea firmei) pe versiunile NOI.
// Versiunile mai vechi raman in firm-text.json / firm-text-v6.json (byte-identice).
function collect() {
  const out: Record<string, unknown> = {};
  for (const { roomType, version, flow } of allFixtureFlows({ only: 'etapa10' })) {
    for (const variant of FIXTURE_VARIANTS) {
      const derived = flow.deriveRoom(fixtureAnswers(flow, variant));
      out[`${roomType}@v${version}/${variant}`] = {
        dims: [derived.lengthM, derived.widthM, derived.heightM],
        items: derived.items.map((it) => `${it.quantity}× ${it.name} | ${it.material} | ${it.systems.join(',')}${it.description ? ` | ${it.description}` : ''}`),
        ...(derived.firmRecommendations?.length
          ? { firm: derived.firmRecommendations.map((r) => `${r.itemName}: material=${r.material} opening=${r.opening}`) }
          : {}),
      };
    }
  }
  return out;
}

describe('textele generate pentru firma pe versiunile noi (etapa 10)', () => {
  it('instantaneu pe toate flow-urile noi', async () => {
    const out = collect();
    expect(Object.keys(out).length).toBeGreaterThan(0);
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__snapshots__/firm-text-v7.json');
  });
});
