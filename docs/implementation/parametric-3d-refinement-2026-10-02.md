# Parametric 3D refinement — 2026-10-02

Status: implemented and verified locally. Changes are uncommitted. The existing working tree contains other work, which was preserved.

## Scope

Modules: shared derived furniture geometry; frontend piece, room, house and request-viewer rendering; static previews; browser verification tools. Tables: none. Saved configuration, dimension limits, manufacturing quantities, pricing and backend behavior are unchanged.

The existing configuration is the authority for geometry. Added parts are derived visual details rather than new product or construction choices. Existing lift-up bed and storage bench modes remain closed visual representations; this change does not introduce an extension length or new lift animation.

## Changes by object

| Object | Refinement |
| --- | --- |
| Bookcase | Subtler directional timber grain, rounded material highlights, shelf support pins attached to actual shelves. |
| Wardrobe | Rod end sockets, shelf supports, mounted handles and compact hinge details; recessed pulls for sliding fronts and drawers behind them. |
| TV unit | Improved timber finish, shelf supports and the same front hardware when configured. |
| Shoe cabinet | Improved finish and mounted pulls; hinges sized to each hinged leaf and kept clear of shelves. |
| Dresser | Brass pulls with contacting mounting posts that travel with each drawer; improved timber/paint finish. |
| Nightstand | Matching compact drawer hardware and shelf details, including narrow configurations. |
| Desk | Consistent cabinet and drawer hardware, material/grain improvements and existing open leg space. |
| Bed | Less bulky duvet, pillows and throw; continuous attached stitching on bedding; fabric follows the selected finish. Existing complete drawer trays and motion are retained. |
| Table | Sculpted round pedestal; two correctly separated halves for extendable tops; improved finish on all shapes. |
| Bench | Tailored cushion with attached stitching, visible storage grip, supported slatted shoe shelf. |
| Room openings | Refined door/window frames, mounted door fittings, window sills/sashes and size-relative outlet details. |

Handles derive from the same helper in the piece editor and room scenes. Animation parents carry their own hardware. Static geometry is batched; overview materials use the lower-cost renderer, including house openings and request-viewer walls. Seam meshes follow the cushion perimeter at both detail levels and preserve the declared dimensions.

## Acceptance

- [x] All ten furniture kinds produce finite, bounded geometry at mixed minimum/maximum dimensions.
- [x] Handles match between editor and static scenes; posts contact the front; recessed sliding handles keep their shallow clearance.
- [x] Hinges fit small leaves and stay inside the existing shelf clearance.
- [x] Mattress and cushion seams remain attached and exposed, checked by raycasts at both detail levels.
- [x] All seven cabinet families respond to minimum/maximum width, height and depth sliders in desktop and mobile browser tests.
- [x] Bed mattress/upholstery/drawer options, round-table diameter and extendable choice, bench width/storage/upholstery and snapshots respond to the controls.
- [x] Hinged doors, sliding wardrobe, dresser drawers and bed drawer trays retain intermediate and settled animation, reversal/click interaction and camera position after configuration edits.
- [x] Existing room and studio panel flows pass desktop/mobile browser tests.
- [x] Room and house camera objects/poses remain stable after floor, room dimension and house-position edits in the refreshed mechanics harness.
- [x] Twenty default/variant application WebGL captures were inspected; no page/WebGL errors were captured.
- [x] Repeated finish/dimension changes and two editor mount/unmount cycles settle at eight textures and 57 buffers per editor, with resources released on context close.
- [x] Frontend typecheck and lint pass. Shared build and shared 473-test suite pass. Frontend 419-test suite passes.
- [x] No database/auth/network mutations, new external assets or saved configuration changes introduced.

## Verification and limits

Commands: `pnpm -F shared build`, shared/frontend unit suites, frontend typecheck/lint, Playwright `studio.spec.ts`, `studio-panels.spec.ts`, `furniture-quality.spec.ts`, `tools/verify-3d-mechanics.mjs`, `tools/showroom-rendering-check.mjs` and `tools/capture-furniture-gallery.mjs` (defaults and variants).

Shared/build/typecheck/lint/browser checks used bundled Node 24.19.0. The complete frontend unit suite passes on installed Node 21.6.0. Under Node 24 the unrelated existing API download test fails because its test Blob lacks `.text()`; the API test also passes independently under Node 21. The repository requires Node >=22.22.2, so the complete supported-runtime unit suite is not claimed green. No unrelated runtime/test change was made.

Browser checks use local Chromium desktop/mobile emulation with isolated guest fixtures and intercepted APIs. They do not establish physical-device performance or fresh authenticated company-viewer acceptance. No new whole-house frame-time benchmark was run; the resource check establishes disposal/plateau behavior rather than an FPS claim.

User-facing captures and review are saved in the current chat's `outputs/` directory. Supporting repository diagnostics are under `docs/implementation/screenshots/3d-mechanics` and `docs/implementation/screenshots/rendering-regression`.
