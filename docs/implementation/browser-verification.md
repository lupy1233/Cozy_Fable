# Browser and live journey verification — 2026-09-15

## Environment and boundaries

Local Next.js development server on port 3100, local NestJS on port 3001, isolated PostgreSQL/Redis/MinIO/Mailpit. Nothing was deployed and no production data was accessed. Browser tests run serially with Playwright Chromium: Desktop Chrome and Pixel 7 emulation. The Node 24 bundled runtime was used.

## Browser checks

`pnpm -F frontend exec playwright test --workers=1`: **6 passed**, latest full run 56.1 seconds.

After the mobile action/teaser layout fix, the four RO/EN desktop/mobile experience tests were rerun: **4 passed** in 40.8 seconds. Fresh RO mobile screenshots confirm the button fits its card and the gallery description uses the available width. ESLint passed all touched browser/illustration/review files.

- RO and EN guest review screens on both viewports preserve an undisclosed budget despite an old numeric estimate in draft state. The numeric estimate is not displayed; login-to-publish is enabled and anonymous publish is absent. No document-level horizontal overflow.
- Connected two-room Studio fixture loads both room and whole-house canvases without uncaught page errors. Changing the shared doorway width updates both endpoints. Undo and page reload retain the two rooms and their connection.
- Studio browser tests isolate backend requests as guest responses. They are not evidence of authenticated publication; the separate live REST journey below covers that boundary.
- A previous short canvas wait was insufficient during dynamic 3D loading. The Studio assertion now waits up to 30 seconds for the second canvas. Actual final runs completed each Studio test in about 7 seconds; this is functional timing, not a performance benchmark.

Fresh screenshots in `screenshots/`: `studio-{desktop,mobile}.png`, `house-3d-{desktop,mobile}.png`, `house-viewport-{desktop,mobile}.png`, and `summary-{en,ro}-{desktop,mobile}.png`. Full-page captures scroll to the top first so the sticky header is not misleadingly captured midway down the document. The Next development indicator is expected and is not part of production UI.

## Visual findings and fixes

- Desktop and mobile connected-house scenes show the bed, two nightstands, dining table and storage bench with a shared doorway. Mobile controls stack and remain usable within the viewport. Desktop library names can truncate; this is visible and not treated as missing furniture.
- RO mobile review exposed a long login button extending outside its card and a cramped gallery teaser. The action row and teaser now stack on small screens; the browser test also asserts that the action fits its parent, not merely the document width.
- Reviewed all 48 showroom concepts at **160 / 80 / 36 px**. The generated atlases were not perfectly aligned to equal-size rows: original uniform cropping clipped tall lower-row pieces and exposed neighbouring-object fragments. Calibrated CSS crop windows correct this without altering/re-encoding the original PNGs. The updated contact sheet and three per-atlas screenshots show the complete objects without those fragments.
- At 36 px, silhouette/category is useful but small details such as a cable opening cannot independently communicate meaning. Existing option text remains necessary. Measurement/size diagrams are intentionally retained rather than replaced by decorative furniture pictures.
- Artwork registry tests: **3 passed**. Current registry inventory: 498 answer rows, 57 showroom uses, 388 existing material/opening photo uses, 50 retained diagrams, 3 generic Boolean controls, no missing fallback artwork. These are usages, not 498 distinct images.

Contact sheet: `docs/showroom-artwork-contact-sheet.html`; screenshots: `artwork-atlas-1.png`, `artwork-atlas-2.png`, `artwork-atlas-3.png`, `artwork-contact-sheet.png`.

## Real authenticated local journey

Gated reusable runner: `apps/backend/scripts/house-acceptance.cjs`. Requires explicit `RUN_LOCAL_HOUSE_ACCEPTANCE=1`, local `TEST_DATABASE_URL`, and `DEMO_PASSWORD`. It uses actual REST authentication cookies without logging tokens; only geocache setup uses direct Prisma writes, avoiding external Nominatim. Existing seed accounts are not rewritten.

Run `House acceptance 2026-09-15T19:41:12.010Z` passed:

1. Client saves/reloads account Studio draft; another account receives 404 for that draft.
2. Strict publication persists two scene snapshots, one house connection and five unique placement-to-request-entry mappings. Two nightstands each produce one item with quantity 1.
3. Firm B can inspect the pre-claim house without client email or full address.
4. Actual claim exposes contact/address and house to firm B. Firm A receives 404 for that claim context.
5. Voluntary withdrawal within the grace window removes contact/address access. Normal refund rules apply; no artificial credit or penalty reset.
6. Read-only follow-up confirmed all five related outbox events dispatched and completed on their first attempt, without errors.

Retained named local records for inspection:

- Request: `f8da9102-d42e-4076-a6e6-f86cd928ddf4`
- Studio draft: `69872109-17a1-43e0-bc3d-186ac761da9a`
- Withdrawn claim: `3d72f3f4-da64-4946-afb3-84e9d730fc3b`

The first invocation encountered backend restart before login or domain mutation; the next ready invocation succeeded. No uncertain mutation was automatically repeated.

## Adjacent critical transaction — real REST, not browser clicks

The same gated runner supports `TEST_HOUSE_FULL_JOURNEY=1`. A fresh run `House transaction 2026-09-15T19:55:07.197Z` passed the preceding publication/contact checks and then:

- Firm B sends a chat message; the owning client reads its decrypted content. Unrelated firm A is denied with 403.
- Firm B creates a RON 10,000 test offer with five per-entry prices. The two distinct nightstand entry IDs each retain their own RON 750 price; room prices sum exactly to the offer total. Repeating quote creation with the same idempotency key returns the same quote DTO.
- Client acceptance transitions the quote/request to ACCEPTED. Same-key acceptance replay returns the original DTO without another effect.
- Another firm cannot mark delivery (403). The winning firm marks DELIVERED_BY_COMPANY and the client confirms COMPLETED. Repeating completion is rejected with 409. The claim is COMPLETED and both nightstand units remain present.
- Follow-up PostgreSQL inspection confirmed all eleven request-related outbox intents completed on their first attempt with no delivery error, including chat, quote creation/acceptance, and delivery marking/confirmation.

Retained local records: request `62392395-b30b-49df-b951-1caa26dab177`, quote `3b016409-01ac-4632-8607-67cceab1c1bf`, claim `60270267-55aa-46e4-b2b9-a277ccd4a28e`, Studio draft `7da4baef-35ca-4e74-a3b7-475cc958d36f`. Normal winner credit consumption was intentionally exercised on the local demo company. No payment was made and no seed balance was overwritten.

An earlier attempted transaction stopped at a test expectation mismatch: unauthorized chat reads correctly returned 403, not the assumed 404. Its new claim `21b4a0cb-af71-4087-a134-0fe37dce537d` was withdrawn through the real API within grace and fully refunded; request `9a8b80fe-535a-4cf5-ae46-90b7a29c1ad0` and its named draft remain as clearly identifiable test records. The original acceptance fixture above was not changed. No uncertain mutation was repeated.

## Real desktop browser login handoff

Gated Playwright spec `e2e/studio-authenticated.spec.ts` uses `RUN_LOCAL_STUDIO_AUTH=1` and `DEMO_PASSWORD`, targets only the local desktop project, and disables tracing to avoid retaining authentication headers. It does not mock the API. Initial fixture seeding occurs once per browser session, so navigation cannot hide data loss by reinserting the fixture.

The real test found that Studio's guest My drafts → Sign in link omitted the return path: successful login went to `/en/dashboard`. The authorized one-line fix uses the existing `/login?redirect=/studio` convention. After the fix, actual guest → sign-in → login → Studio → account save/load passed (6.5-second test, 13.2-second runner). The bed, two rooms and house connection survived. New local draft `439664f1-1b5c-4c16-914c-21e565e38747` was retained. Keyboard activation/focus is exercised for My drafts and Sign in. This is narrow login/draft browser evidence, not a screen-reader audit or full browser purchase journey.

The strengthened final run also changed the shared doorway locally to 1.1 m, then loaded the account draft and verified restoration to the saved 0.9 m while retaining the bed/house. **1 passed** (6.0-second test, 10.4-second runner), retaining local draft `99250475-e24a-4b2c-9050-a0d912b87770`. An intermediate test-only locator assumed the My drafts button name remained exact after saving; it actually appends the draft name. The corrected anchored locator passed without another app change. ESLint passed the new spec and Studio page.

## Additional compatibility and failure-path acceptance (2026-09-16)

New `studio-compatibility.test.ts` exercises account v2-to-v3 conversion without mutating input, legacy-key recovery preservation across current writes and stale old-tab writes, refusal of versions 0/4/99, corrupt-current refusal rather than silently replacing it with an older recovery copy, interrupted/quota writes, denied storage reads, and asynchronous storage failures. Together with the existing legacy-v1 migration tests this covers the automated compatibility boundary, not a claim that an old binary understands new furniture kinds. Nine new compatibility tests passed. Four API refresh tests passed, including recovery after network failure, a maximum of one resource retry, and unchanged mutation idempotency headers across retry.

New `e2e/resilience.spec.ts` uses mocked APIs only: unavailable WebGL with usable house plan/door controls; My drafts keyboard activation, trapped Tab focus, Escape and focus restoration; 320 CSS-pixel reflow; quota failure warning while the previous stored house remains untouched; and held/failed publication with one outgoing mutation, disabled submit, status announcement, focused error, retry availability, and unchanged draft data. It runs on Chromium desktop and emulated Pixel 7. These failure tests do not create database records or exercise external providers.

Final browser run: **6 passed (21.0 seconds)**. The tests exposed and fixed Studio's missing room-canvas fallback, unreported storage read/write failures, and narrow-layout overflow (implicit grid sizing and the unwrapped opening palette). WebGL2 probes release their temporary contexts. Storage errors now block subsequent automatic writes and tell users that current in-memory edits might not survive reload. Existing recovery data is not deleted. Focused ESLint and frontend TypeScript checks passed.

Only Chromium is installed locally. Firefox/WebKit testing would require additional browser installation; none was downloaded due to the constrained system disk. Actual assistive-technology navigation, physical low-end device GPU/touch behavior, and user visual/video approval remain manual. A 320 CSS-pixel viewport checks reflow but is not a complete browser-zoom audit. Failed optional image upload and every questionnaire branch are not covered by this new suite. Numeric GPU/resource budgets remain the separately owned performance check.

## Frozen-renderer resource regression (2026-09-16)

`node tools/showroom-rendering-check.mjs` passed against the final renderer. It opens a two-door wardrobe editor twice; each mount runs four oak → white paint → walnut finish cycles with width changes, then opens/closes one door and resizes to a narrow viewport. Instrumented native WebGL allocations stayed at **8 live textures / 61 live buffers** at all eight settled checkpoints. Every context explicitly deleted all **478 allocated buffers**; **5 of 9 texture allocations** were explicitly deleted and context loss released the remaining renderer resources. Both closed contexts ended at zero live resources. These are allocation counts, not physical GPU-memory byte measurements. No page errors or WebGL/shader errors were reported.

Evidence: `screenshots/rendering-regression/results.json`, `asymmetric-door-0.png`, `closed-door-0.png`, and `narrow-editor-0.png` (second-mount equivalents also retained). Native images were inspected: one hinged door opens while the other remains closed; the selected interior remains visible; the floor shadow stays beneath the cabinet; the closed cabinet fits the narrow canvas without clipping. The fixture uses intercepted guest APIs and performs no account or backend writes.

The full frozen-renderer Playwright run finished **12 passed, 2 deliberately skipped (1.6 minutes)**: RO/EN summary, quota preservation, unavailable WebGL/keyboard/reflow, slow failed publication, and connected-house persistence all passed in desktop Chromium and emulated Pixel 7. The two gated real-login cases were skipped because authenticated local execution was not enabled; no credentials were supplied. Concurrent gallery capture makes this suite duration unsuitable as a rendering-performance measurement.

Fresh `screenshots/house-3d-desktop.png` was visually inspected after the final overview-lighting optimization. Both complete rooms and all five placements remain visible: bed, two nightstands, table, and bench. The whole-house cutaway intentionally has simpler material response than the detailed active-room canvas below it. No missing geometry or canvas clipping was observed. The full-page image is the review artifact; `house-viewport-desktop.png` is a browser-viewport capture whose lower canvas continues below the viewport. Current mobile counterparts were also regenerated by the passing suite.

A final targeted resource-probe rerun explicitly listened to every browser console level for `Multiple instances of Three`. It passed with `warnings: []` and `errors: []` in the fresh results JSON, while retaining the same resource plateau and cleanup results. Thus the warning observed in the mixed-module unit-test harness was not reproduced in this actual Studio/editor browser route; this does not assert that every application route was checked for duplicate imports.

## Current environment and remaining limits

Current environment update (2026-09-16 final rendering check): Docker's WSL engine is unavailable following an externally initiated storage-location move failure; the local backend is not reachable. The successful real REST and authenticated-browser journeys documented above are historical evidence from the earlier working local environment, not fresh post-rendering checks. Final rendering/browser regressions use isolated guest fixtures and intercepted APIs. The gated authenticated test is deliberately skipped without explicit local credentials; no real service availability or production readiness is implied.

This is not full accessibility certification or a real-device GPU/performance study. Safari/Firefox, screen-reader navigation, low-end mobile hardware, every questionnaire branch, and every furniture variant were not exercised end to end. Authenticated publication/contact authorization and completion were verified through real REST services; only login/account-draft handoff was additionally exercised as real browser clicks. Stripe and SMTP delivery are covered separately; no real payment or external customer email was sent by this journey. User visual approval and the planned client-facing video remain separate follow-ups.
