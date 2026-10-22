# Green artwork, Idea Book and fullscreen acceptance

Date: 2026-09-16. User preference: realistic furniture pictures.

## Scope

Frontend option illustrations, PlayingCard details, RO/EN copy and Idea Book image fallback. A guarded one-time restoration adds the repository's existing curated catalog to Green's isolated database (`companies` and `inspiration_photos`). No schema, pricing, saved answer or production routing changes.

## Requested artwork

| Area | Accepted content |
| --- | --- |
| Kitchen | Straight/L/U kitchen layouts; PAL/HPL/quartz/granite countertop samples |
| Walk-in closet | Linear/L/U/walk-in layouts; open/hinged/sliding doors; LED lighting |
| Living room | Corrected bookshelf crop; wall-mounted shelves; floating/floor/full-wall TV units; new inset sliding-door image |
| Bedroom | Wardrobe door types; 90/140/160/180/custom mattress sizes; side-opening bed drawers; exactly two nightstands |
| Office | Straight/L/U desks |
| Bathroom | Window/fan/no-ventilation options |
| Laundry | Side by side / Alaturate, without implying a worktop; appliance housing, separate worktop, sink cabinet and existing closed storage |
| Pantry | One-wall/L/U storage runs |
| Balcony | Enclosed/open balcony and narrow supported worktop |

The 41 original standalone images are generated with the built-in image tool. Prompts and provenance are retained alongside this report. Next/Image delivers responsive optimized files. Existing shared and historical question mappings retain canonical answer values. Compact previews are supplementary to translated labels; mattress pictures are illustrative, with exact dimensions supplied by the option labels.

## Idea Book

- [x] Empty Green catalog diagnosed: API returned an empty list, not an image-rendering failure.
- [x] Restored exactly 70 existing curated photos and one source-company attribution, with 9 featured photos and 8 room types. No private production data imported.
- [x] Seed requires explicit opt-in and exact Green DB/Redis/storage/mail identities, refuses Stripe-enabled targets, serializes concurrent reruns, and preserves existing publication/attribution decisions.
- [x] Repeat dry-run proposes zero changes; all 70 source image URLs respond successfully.
- [x] EN/RO desktop/mobile gallery, kitchen filtering, lightbox and project link verified.
- [x] Localized unavailable-image fallback verified with forced image failure.

## Fullscreen line

The reproducible card-height white line came from the option card's 3D flip passing through an edge-on angle. The card now swaps its active face with a 150 ms opacity reveal inside stable bounds. Keyboard focus and reduced-motion behavior are covered. Ordinary option selection and Studio fullscreen retain viewport bounds; no unrelated global canvas or wall rendering was changed. A separate screen-height stripe was not reproduced.

## Validation and release

The first candidate, `b389eaab-43c4-4063-aa82-91c01d035b59`, compiled but crashed because the seed test imported Prisma helpers outside `src`, expanding TypeScript's inferred output root. Added `apps/backend/tsconfig.build.json` with an explicit source root and test exclusions; typecheck/Jest continue to include tests separately. Docker now checks `dist/main.js` both after compilation and in the runtime image. Local production backend build, entrypoint check, typecheck and all 16 seed tests pass. No business code or schema was changed for this correction.

- [x] All 41 images decoded, rendered and visually reviewed at 176 px card and 36 px compact sizes; five grouped sheets inspected.
- [x] Frontend: 172 tests pass across 24 files, typecheck and lint pass. Registry covers all 498 current choices with zero missing mappings. Seed: 16 focused tests pass.
- [x] Fullscreen regression: four desktop/mobile cases pass, covering the exact animation midpoint, repeated keyboard navigation, reduced motion, selection and Studio canvas bounds.
- [x] Green deployment `6ec40898-081a-44fa-9fb1-22db8993e503` complete and healthy; image `sha256:4f900a234d0e33af2bfe09c2c8d393f385335ecce3dd5c8d0372cec06b71e5b6`. PostgreSQL, Redis and storage report up, with isolated Green settings retained.
- [x] Complete ten-room form verified on final Green deployment in RO/EN: 156 questions and 54 image sources per run, real SAFE upload, draft save/reload, authenticated publication and persisted request read-back. Both desktop cases pass (53.2 s / 54.8 s).
- [x] Complete English mobile form also passes on this release (1.1 minutes), including the same real upload/save/reload/publication flow. Artifacts: `apps/frontend/test-results/green-artwork-form-mobile`.
- [x] Deployed Idea Book: EN/RO desktop/mobile pass with 70 catalog photos, 15 kitchen-filter results, working lightbox, forced-error fallback and zero page errors. Six deployed artwork cases pass, including all 41 assets and the corrected crop/copy. Four fullscreen cases pass on this release.
- [x] Blue remains at successful deployment `720549d5-233d-4917-8d85-dc356db0aead`; gateway remains `backend.railway.internal:3000`.

## Security close

- PASS: No new endpoints, auth roles, ownership paths or critical money/claim mutations.
- PASS: No change to upload authorization, SAFE status, signed URLs, cookie or CORS rules.
- PASS: New static artwork is public product content; curated portfolio attribution and source links are preserved.
- PASS: Seed credentials come from environment only; guard failures omit connection strings and sensitive values.
- PASS: Green seed is opt-in, transactional, idempotent and restricted to the isolated preview dependencies.

Suggested scoped commit after review: `fix(configurator): restore realistic option art and Green inspiration`.

Evidence: `apps/frontend/test-results/green-artwork`, `apps/frontend/test-results/green-fullscreen`, `docs/implementation/screenshots/inspiration-green`. Final deployed art sheets were visually inspected. Sliding-door artwork is delivered as a 2,312-byte WebP at 256 px, rather than downloading its 1.28 MB source image to the option card.
