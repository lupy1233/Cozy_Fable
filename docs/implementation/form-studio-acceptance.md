# Full form and Studio acceptance — 2026-09-16

## Scope

Frontend questionnaire bootstrap, artwork, RO/EN descriptions and Studio interaction/rendering; shared placement geometry and Studio UI store. Existing question flow versions, request schemas and business rules remain unchanged. No new tables or migrations. Green's existing schema is initialized in a new, isolated database, with synthetic acceptance data only.

## Changes and acceptance

- [x] Furniture footprints cannot cross each other or room boundaries during drag/nudge. Swept collision checks prevent tunneling; blocked movement slides along clear axes.
- [x] Place, duplicate, rotate, shared-piece resize and room/ceiling resize reject invalid changes atomically. Touching edges are allowed. Legacy overlaps remain readable and can be moved apart.
- [x] Full walls are the initial Studio view; Cutaway remains an explicit option. House 3D renders actual doors/windows; floor plans show their position and width.
- [x] Tool panels stay open on selection. Minimized selection state survives selecting another object and hiding/restoring tools; mobile panels stack without overlap.
- [x] House initial framing accounts for full wall height and viewport aspect; later edits preserve camera ownership.
- [x] All ten room types completed through the actual guided form UI, with each displayed question and image checked.
- [x] Question artwork/description inventory and regression checks complete in RO/EN.
- [x] Draft bootstrap failures show a retry action and preserve local answers; expired-token recovery verified.
- [x] Real Green draft save, reload, authenticated publish and resulting ten-room request verified.
- [x] Final Green build, Studio smoke and Blue/gateway unchanged verified.

Collision scope is the declared outer furniture footprint at quarter-turn rotations, not a physics simulation. No invented walking clearance or door-swing clearance is imposed.

## Isolated Green preview

Green previously used production dependencies in standby mode, which blocked draft creation with HTTP 503. A writable preview now uses its own PostgreSQL, Redis, private storage bucket, authentication secrets and captured email. No production records were copied; Stripe is unconfigured. The public Blue service and gateway routing stay unchanged.

| Resource | Green-only target |
| --- | --- |
| App | `app-green`, existing preview URL |
| Database | `green-postgres.railway.internal`, database `green_preview` |
| Queue/cache | `green-redis.railway.internal` |
| Storage | `https://green-storage-production.up.railway.app`, private bucket `green-preview` |
| Mail capture | `green-mail.railway.internal:1025`, no public inbox |

Railway resource IDs: database `1a0f5a56-7098-4c2a-bc26-c1ff7ac99b8f`, Redis `8ecfdf80-cd84-403c-b8e3-7e12b36672e4`, storage `d7b8b3c2-b6bb-4ab9-aea4-daf06a378ffe`, mail `21a8cce8-032e-46f4-a76f-4cbbe868b739`. These additional preview services incur Railway usage. Setup follows Railway's [service creation](https://docs.railway.com/cli/add) and [volume](https://docs.railway.com/volumes) controls.

The storage image initially referenced by the local compose file is no longer pullable from its registry. Green uses the same verified immutable image as the existing storage service, with new credentials and a separate volume/bucket. The private bucket was explicitly created and verified with an authenticated HeadBucket call. PostgreSQL uses a `pgdata` subdirectory under its persistent mount so the filesystem's `lost+found` directory cannot block initialization. CLI environment edits reported success without persisting start commands; the live GraphQL service-instance update and a fresh service-instance deploy were used and verified. Re-deploying an older deployment retains its older start-command configuration.

Synthetic account bootstrap: `apps/backend/scripts/seed-green-preview.cjs` requires explicit opt-in and exact isolated Green database, Redis, bucket and mail identities. Passwords remain in Railway variables and are never written to this document. Form test location is an isolated geocache entry, preventing test address lookups against a public geocoder.

Before a future promotion, Green must be reconnected to production dependencies in **standby** mode, with reviewed immutable source, migrations and compatibility checks. Preview data must never be copied into production. Follow `blue-green-release.md`; active preview is not an active production slot.

## Validation record

- Shared: 260 tests pass, including 14 collision geometry regressions.
- Studio store: 35 tests pass, including 20 collision/history tests. Nine new gesture regressions preserve redo after blocked/no-op interactions and group accepted movement into one undo.
- Camera framing/preservation: 9 tests pass.
- Studio browser scenarios: four desktop/mobile cases pass; two no-WebGL fallbacks pass.
- Global lint/typecheck: pass before the final form-test adjustments.
- Full guided form: EN/RO on desktop/mobile pass locally; both EN/RO pass against deployed Green with real API/storage/auth/publish calls.
- Green Studio: four deployed desktop/mobile scenarios pass (25.9 seconds), with isolated browser contexts and no changes to the user's browser draft.

Green acceptance deployment `edc2990f-a32e-4ae5-b786-6d208deed3f1`, image `sha256:3cdd0f7b82166e599555e48bc44eb73d433830429f189d5c99e5c206d551cdd0`, passed dependency health and all form/Studio scenarios. Each form run uploaded a generated PNG through the real presigned PUT flow, waited for `SAFE`, reloaded the saved draft, authenticated the synthetic client, published through the review UI, then read the persisted ten-room request and attachment back. EN request `e25cf331-ae42-4ea5-8ac7-ce44d40faf64`; RO request `95f55832-22db-49be-9394-4d8bcfa7ae76`. Both are synthetic records in Green only.

The run then exposed canonical Romanian workshop item names in the EN review. The follow-up correction uses existing localized answer metadata for customer presentation while preserving canonical request derivation, freeform names/quantities/notes, dimensions and material choices. Nine focused review tests, typecheck, lint and another full English UI journey pass. The deployed follow-up is verified below.

Final Green deployment: `0400bd6f-95e3-4bf6-abf7-ada129d204b4`; image `sha256:bbd6c6e62e8631c94b26c98ca2727218f58947812420e5788aa7d226ef01686b`. Production build passed and health reports all three dependencies up, `green/active`. Both complete desktop form journeys pass again on this exact deployment, now asserting localized summary content as well as real upload/save/reload/publish/read-back. EN request `5077a125-950d-455a-a3b4-1c54ce116bb4`; RO request `c66ff6e2-14d9-483c-b683-587b42084763`. Final artifacts are under `apps/frontend/test-results/green-final` and contain no authentication secrets or draft tokens.

The full English mobile journey also passes on the final deployment (48.8 seconds), including the updated responsive summary, real SAFE upload and published ten-room request `8eb21169-6f3d-4290-9a0a-ebe82e95c11a`. The mobile summary screenshot was visually checked for wrapping and readable controls. Artifacts: `apps/frontend/test-results/green-final-mobile`.

Blue remains at deployment `720549d5-233d-4917-8d85-dc356db0aead`; gateway `ACTIVE_UPSTREAM` remains `backend.railway.internal:3000`. Current Green variables were read back to verify isolated PostgreSQL/Redis/storage/mail, no Stripe key and `RUN_MIGRATIONS=false`. No public domain or production data was changed.

Question audit matrix (one of every room in the same request; all declared questions reached):

| Room | Flow version | Questions |
| --- | --- | --- |
| Kitchen | 2 | 15 |
| Dressing | 3 | 7 |
| Living | 3 | 24 |
| Bedroom | 2 | 27 |
| Office | 2 | 16 |
| Bathroom | 2 | 10 |
| Hallway | 1 | 18 |
| Laundry | 2 | 16 |
| Pantry | 2 | 9 |
| Balcony | 2 | 14 |
| **Total** | | **156** |

The UI journey selects the branches needed to reach island, custom-material, custom-mattress and mixed-storage questions. Every visible choice has a visual, every referenced image loads, and room answers validate before continuing. Static RO/EN checks additionally cover the ten current individual-piece flows and the freeform piece flow: titles, descriptions, information text, icons and dynamic dimension labels. All 498 current answer visuals resolve; each unique visual renders and its referenced PNG data decompresses. Historical flow definitions remain unchanged.

Corrected content includes the dishwasher Lucide alias, wall-mounted shelves, side bed drawers, under-worktop laundry, wardrobe LED lighting, custom mattress width/length, sliding-door versus drawer clearances, the Gola profile description and material-mixing instructions. These are generic construction illustrations, not manufacturer-specific hardware specifications.

## Security close

- PASS — No new application endpoints, authorization rules, financial mutations or critical audit paths; existing guards, ownership and idempotency remain in use.
- PASS — Existing signed-upload, file-size and scan controls remain unchanged. No public storage policy was added.
- PASS — Preview credentials live only in Railway variables; the seed script requires explicit opt-in and exact Green dependency identities, and logs no credentials. Preview has separate auth secrets, captured email and no Stripe key.
- PASS — Existing canonical errors, HTTP-only authentication cookies and exact-origin CORS remain in use. Bootstrap errors display localized safe copy.

No new product decisions. Source remains an uncommitted preview with `release.sha=unknown`; this verification does not authorize production promotion.

Suggested checkpoint after reviewing/staging this sprint's files: `git commit -m "fix(studio): enforce collisions and verify complete Green form"`.
