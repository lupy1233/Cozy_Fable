# Experience implementation map

## Review adaptation

Source inspected: `F:/Cozy-Mobilaunicat/apps/frontend/src/components/configurator/review-facts-card.tsx`, `review-room-card.tsx`, `review-step.tsx`.

| Source idea | Marketplace implementation | Contract retained |
| --- | --- | --- |
| Compact facts card | `review-facts-card.tsx` | Existing `DetailsValues`; budget estimate is explicitly not a firm quote; undisclosed budget hides stale amount |
| Furniture recap plus complete answers | `review-room-card.tsx` + `room-answer-summary.tsx` | Existing `getFlow(roomType, flowVersion)` and `summarizeAnswers`; quantities stay unchanged; incomplete rooms do not display default-derived items as confirmed |
| Edit actions | Passed `onEditRoom` / `onEditDetails` callbacks | Existing wizard edit-and-return navigation |
| Request files minus room files | `review-step.tsx` | Attachment IDs deduplicated; files use API-provided signed URLs; thumbnails require SAFE status |
| Network error feedback | `review-step.tsx` | Existing mutations and authenticated publication; generic network errors now surface and receive focus |
| Contact confirmation | Client's own facts card only | Approved post-claim company access remains server-authorized |

Not imported: anonymous publication, terms requirements, `/multumim`, source `needsPaidDesign` or source `bedConfig`. Bed/house presentation follows the target's shared contracts when those are ready. No new tables, API calls or publication permissions are introduced.

## Artwork contract

Style: existing material/opening photographs remain the reference. New artwork uses isolated showroom objects, restrained oak/cream surfaces, soft shadows, consistent three-quarter view and generous margins. UI labels remain real translated text.

`illustrations/showroom-atlas.tsx` contains the exact row-major 4-by-4 rosters for three original PNG atlases (48 concepts). CSS selects cells without re-encoding image data. Generated assets and visual inspection are a separate root-owned step; file paths alone are not evidence of successful generation.

`illustrations/coverage.ts` calculates the full coverage manifest from every actual registered flow version. It records room, flow version, question, answer, renderer and exact visual classification. `coverage.test.tsx` reports current totals and detects concept-map regressions. Registry output is evidence at execution time; it changes when flow versions change.

Coverage includes full choice cards, compact inline/material pills, boolean cards and material/opening question target strips. Common material/opening PNGs are preserved. The previously missing open-dressing option now has an explicit informative visual.

Retained diagram exceptions: room/layout shapes, dimensional bed-size comparisons, one/two nightstands, door movement, suspended/floor/media-wall distinctions, ceiling/cable/storage configurations without a precise corresponding atlas object, ventilation and open/enclosed balcony. A generic cabinet image must not replace these distinctions. Numeric fields and native selectors remain text controls rather than adding misleading decoration.

## Evidence and remaining integration

- Shared-control tests cover keyboard file chooser/drop, wraparound/Home/End tab navigation and panel linkage, localized Radix close and Escape focus restoration.
- Facts tests cover undisclosed amount suppression and budget-vs-quote wording.
- File tests cover pending-scan link suppression, failed-image fallback and no ZIP preview.
- Registry tests cover all 48 distinct atlas coordinates, bed semantic reuse and all flow versions.
- Visual inspection at card, pill and anchor sizes is required after original assets land.
- Bed/house summary integration, authenticated full publish journeys and firm access tests remain dependent on their owners' contracts and integrated browser checks.
