# Furniture realism — 2026-10-02

Status: implemented locally; no commit or deployment.

## Scope and assumptions

Modules: shared visual furniture metadata; frontend board, table and seat geometry; showroom materials and batching; cabinet animation attachments; regression tests and capture/measurement tools. Database tables: none. Existing configuration normalization, sliders, furniture options, quoted dimensions, BOM and pricing remain authoritative. Geometry metadata is derived only. The earlier bed cloth, pillows, drawer behavior and hanging-rod hangers are preserved.

## Changes

- All seven cabinet families use restrained manufactured-board bevels with planar face centers. A compact factory tessellates only rounded edges and corners, retaining exact bounds and analytic normals. The same factory is used for static models, animated fronts and room door/window details, with an economical overview tier.
- Wood grain has a deterministic phase per board, remains in metric coordinates as dimensions change, maps correctly onto perpendicular edge faces and introduces subtle roughness variation. It remains fixed to moving fronts. Existing finish colors are retained.
- Drawer and tilt-tray interiors use a consistent light wood material independent of exterior finish. Fixed runners and moving trays are batched separately under the original motion and interaction groups.
- Rectangular tables and wooden bench seats have a flat top with a restrained reverse bevel underneath. Round tables use the same edge character. Extendable tops retain the existing 3 mm center join.
- Table and bench legs have rounded square sections, straight shoulders at the apron joints and tapered lower sections, within the original footprint and height.
- Bench upholstery has a flat supported underside, soft crown, metric corner radii and a continuous seam generated from the supporting perimeter. The seam is integrated into the cushion geometry.
- Overview and untextured batches omit unused local texture coordinates. Grain-axis material splits are retained only where used. Geometry is created on configuration changes, disposed on replacement/unmount and never rebuilt per animation frame.

## Measured costs

Same isolated guest fixtures before/after, local Chromium, 1440 × 1100, DPR 1. Main-scene counts during steady orbit with directional shadows cached and contact shadows settled. Buffer bytes are tracked vertex/index uploads, not total GPU memory. These are not device FPS measurements.
| Furniture | Main calls before → after | Triangles before → after | Tracked buffer bytes before → after |
| --- | ---: | ---: | ---: |
| Bookcase | 6 → 6 | 7986 → 4242 | 1339240 → 466312 |
| Wardrobe | 91 → 43 | 29426 → 10290 | 3251656 → 1111912 |
| TV unit | 5 → 5 | 3026 → 946 | 505960 → 123400 |
| Shoe cabinet | 11 → 9 | 5814 → 2902 | 932320 → 318112 |
| Dresser | 83 → 35 | 26426 → 8122 | 2752360 → 891784 |
| Nightstand | 18 → 10 | 6926 → 2142 | 880360 → 251464 |
| Desk | 43 → 19 | 13814 → 4246 | 1477120 → 470320 |
| Bed | 7 → 7 | 8114 → 6130 | 1363096 → 805864 |
| Table | 4 → 4 | 2122 → 910 | 356440 → 120136 |
| Bench | 4 → 4 | 2122 → 910 | 356440 → 120136 |
| bench-upholstered | 5 → 5 | 3578 → 1530 | 601048 → 198664 |
| table-round | 3 → 3 | 3362 → 2594 | 564760 → 342424 |
| bed-drawers | 23 → 23 | 22494 → 10318 | 3778936 → 1279192 |
All 27 detail/room measurements reported zero idle draws and no browser/WebGL errors. GPU texture counts were unchanged. The default ten models use 24–69% fewer triangles; all measured variants also improve. The new bench cushion costs 792 detail / 440 overview triangles, tabletop 160/96 and each tapered leg 72/48.

## Acceptance

- [x] Shared build and all 492 shared tests pass on Node 24.19.0.
- [x] Frontend 3D suite: 138 tests / 11 files pass, including geometry winding, closed topology, exact bounds, outward normals, cushion support/seam raycasts, batch parity, bed cloth contact and hanger regressions.
- [x] Frontend typecheck and lint pass; targeted `git diff --check` passes.
- [x] Desktop and mobile furniture control tests pass: all seven cabinet dimension extrema, handles and finish selection; bed sizes/upholstery/storage; table diameter and extension options; bench sizes and upholstery; snapshots and no horizontal overflow. The first concurrent mobile run hit the five-second initialization timeout; the startup wait was made explicit at 30 seconds and the isolated mobile run passed.
- [x] Browser mechanics checks pass for bed drawers including reversal/tray click, dresser drawers, sliding wardrobe fronts and hinged doors. Camera identity/pose stays stable after dimension/finish changes and in room/house views.
- [x] Two editor mount/unmount cycles with repeated finish/dimension edits plateau at 39 buffers/eight textures; all buffers and context resources release on close.
- [x] Dresser width min/max/return cycles follow the existing column reflow (six to nine drawers), then hold exactly 181 buffers / 1,288,960 uploaded bytes / eight textures across repeated equivalent layouts. Closing releases all geometry buffers.
- [x] Native application captures inspected for all ten defaults and ten finish/configuration variants, with no browser/WebGL errors.
- [x] Independent read-only reviews found no actionable geometry, shader, material-sharing or motion-transform defects.
- [x] No backend, schema, external-service, production, pricing or saved-config changes.

The existing cabinet rules may add/remove columns at extreme widths; resizing back to the original width does not necessarily restore the original column count. Resource checks must compare the same resulting layout, not assume a constant number of drawers. This behavior is unchanged.

## Reproduce

- `node tools/measure-furniture-performance.mjs <output.json>` measures all ten defaults plus upholstered bench, round table and bed drawers. `FURNITURE_COST_CASE=dresser` selects one case. `FURNITURE_COST_LIFECYCLE=1` checks repeated width changes and disposal for cabinet fixtures (or mattress sizes for bed).
- `node tools/capture-furniture-gallery.mjs`; optionally `GALLERY_VARIANTS=1`, `GALLERY_KINDS=...`, `GALLERY_OUTPUT=...`.
- `node tools/verify-3d-mechanics.mjs` and `node tools/showroom-rendering-check.mjs` verify live interaction and graphics resources using isolated fixtures.

User-facing review, captures and raw performance measurements are in this chat's `outputs/furniture-realism` directory. The review compares the actual immediately preceding local implementation with this pass; the bed already had its earlier refinement in the baseline. No new texture assets, physics simulation, extra lighting passes or permanent frame loop were added. Physical-device frame rate has not been benchmarked.

