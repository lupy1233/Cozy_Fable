# Seven new configurable furniture types

User scope: add the previously proposed first batch (sideboard, wall cabinet, bathroom vanity, entryway unit), plus sofa, armchair and ottoman. Preserve resizing and keep rendering lightweight.

## Research reviewed on 2 October 2026

These are observed supplier choices, not evidence of market demand or promises that every workshop manufactures them.

| Piece | Primary source | Choices observed | Implemented subset |
|---|---|---|---|
| Sideboard | [Pickawood sideboards](https://www.pickawood.com/eu/sideboards) | Dimensions, materials, compartments, doors/drawers, feet and handles | Width/height/depth, columns and zones, shelves, doors/drawers/open bays, plinth/legs, handles/push, visual finish |
| Wall cabinet | [Pickawood hanging sideboards](https://www.pickawood.com/eu/sideboards/hanging-sideboard) | Dimensions, compartments, fronts, wall mounting, handles/push | Dimensions, shelves/open bays/doors, handles/push, finish, bottom mounting height |
| Vanity | [Paramount bespoke bathroom furniture](https://paramountbathrooms.co.uk/bespoke-build/) | Made-to-measure units, floor/wall mounting, drawers/cupboards/open storage, finishes and worktops | Dimensions, floor/wall mounting, single/double vessel-basin layout, drawers/doors/open bays, handles/push, light/dark top |
| Entryway | [Pickawood hallway storage](https://www.pickawood.com/eu/wardrobes/hallway-storage) and [Transform Bau fitted entryway](https://www.transformbau.de/en/projects/garderobe-mit-spiegel) | Made-to-measure storage, mirrors, hanging/shoe space; the fitted project combines mirror, shelf and coat hooks | Dimensions, bench, 2–6 hooks, optional mirror on either side, upper shelf, upholstered seat, open/closed shoe storage |
| Sofa | [BenchMade Modern OG sofa with chaise](https://benchmademodern.com/products/the-og-sofa-with-chaise) | Width, body depth, chaise length/orientation, upholstery and cushion filling | Width/height/body depth, 2–4 seats, straight/left/right chaise, chaise depth, slim/wide arms, split/bench cushion on straight sofa, texture/color, firmness preference and base |
| Armchair | [What A Room Daphne chair](https://whataroom.com/collections/custom-sofas-armchairs/products/daphne-chair) | Width/depth, fabric, cushions/firmness and legs | Width/height/depth, arms, texture/color, firmness preference, oak/walnut/black legs or recessed base |
| Ottoman | [BenchMade Modern Archie ottoman](https://benchmademodern.com/products/archie-ottoman) | Size, upholstery, cushion filling, leg finish | Width/height/depth, rectangular/round, upholstery preferences/base; optional storage with opening lid is an additional app choice |

The app's single/double basin layout, ottoman storage and preview dimension limits are product choices for this batch. They are not copied manufacturing guarantees. Upholstery firmness is recorded as a preference; actual fabric, filling, hardware, plumbing and mounting are confirmed with the maker. Frame material remains the separate authoritative material answer. No upholstery is silently priced as board material and no prices are inferred from meshes.

## Implementation contract

- Modules: shared piece configuration/model/validation and questionnaire flows; frontend controls, shaders, previews, room placement and request review; backend publication validation and RoomType enum.
- Storage: configurations remain JSON in `studio_drafts.data`, request answers and scene snapshots. Seven new `PIECE_*` values are added to the PostgreSQL `room_type` enum used by `request_rooms`. No new tables or columns.
- New flow versions start at 1; existing flow versions and old furniture configuration shapes remain available.
- Sofa `depthM` is its complete footprint including the chaise. `sofa.bodyDepthM` remains separate and appears in the summary. The planner reserves the complete rectangular footprint, including the empty corner beside a chaise.
- Mounting height is the gap between the floor and cabinet bottom. Physical height remains separate. Room/house/request rendering applies this offset once. Vertical collision checks allow cabinetry above floor furniture and reject ceiling overflow or newly introduced overlap.
- Current request publication rechecks placement after questionnaire edits. Reading historical drafts/snapshots stays recoverable.
- Furniture models use procedural boards/cushions and a few lathed profiles; no downloaded models or image textures. Detail and overview rendering share panel bounds and materials. Rendering remains on demand and geometry is disposed on replacement/unmount.
- The round storage ottoman uses a hinge at its rear edge; the opening sweep is checked against the shell. Vanity drawers keep a central plumbing channel and their trays are attached to moving fronts. Door panels clear fixed sides, bottoms and dividers.
- Wall attachment position is not automatically snapped to a wall. The mounting control changes elevation; users position the cabinet within the room.

## Release state

- Additive migration: `apps/backend/prisma/migrations/20261002160000_furniture_catalog_seven/migration.sql`.
- Prisma client generation is a local build step. No database migration, seed, deployment or commit is performed by this task.
- **DECIZIE NECESARA:** the user was asked whether the seven types should initially inherit the persisted `PIECES` base sizing weight or start at 0 for calibration. No new weights have been invented. Existing missing-weight behavior is 0; Admin currently edits existing rows only. Before enabling quotation in a migrated environment, initialize seven weight rows according to the user's answer without overwriting existing admin values.

## Acceptance checklist

- [x] Seven distinct catalog and request types, RO/EN labels, controls and previews.
- [x] Defaults, min/max normalization, variant bounds, option persistence and derived descriptions tested.
- [x] Mounting-height collision/ceiling rejection and undo atomicity tested.
- [x] Desktop and mobile controls exercised through real WebGL rendering.
- [x] Final desktop/mobile regression: all four browser tests pass for the seven additions and ten existing types.
- [x] Shared, frontend and backend TypeScript checks pass.
- [x] Mechanics and graphics-allocation results recorded below.
- [ ] Sizing initialization decision received and represented in release artifacts.
- [ ] Database migration applied by an explicitly approved release workflow.

User-facing screenshots and verification report are in the chat's `outputs/new-furniture/` directory. Performance results report draw calls, triangles, tracked GPU buffer uploads and idle draws; they do not claim a universal frame rate.

## Verification evidence

- Shared configuration/model/flow/placement suite: 627 tests passed.
- Focused frontend rendering, geometry, collision, transfer and translated-content suites: 215 tests passed. The lid sweep and camera-envelope checks also pass after final framing changes.
- Backend publication and sizing suites: 32 tests passed. New types preserve their exact configuration through publication; a cabinet raised through the ceiling after transfer is rejected with a configurator-step error.
- All four final Playwright tests pass: new catalog and existing ten-type controls on both desktop and mobile. All four new storage mechanics pass: vanity drawers, vanity doors, entryway doors and ottoman lid; camera remains stable through configuration edits, with intermediate and settled animation frames.
- Fourteen native application captures: seven defaults and seven customized examples. No page or WebGL errors.
- Repeated resizing of sofa, armchair and ottoman: three cycles each, stable buffers/bytes/textures, zero buffers after editor close. Renderer-owned context textures retire separately on context teardown.

| Default piece | Detail draw calls | Detail triangles | Room overview triangles | Idle GPU draws |
|---|---:|---:|---:|---:|
| Sideboard | 14 | 3,418 | 1,124 | 0 |
| Wall cabinet | 10 | 2,226 | 860 | 0 |
| Bathroom vanity | 14 | 4,250 | 2,204 | 0 |
| Entryway | 7 | 2,770 | 1,460 | 0 |
| Sofa | 3 | 6,010 | 3,036 | 0 |
| Armchair | 3 | 3,386 | 1,724 | 0 |
| Ottoman | 3 | 1,874 | 1,108 | 0 |

Additional large/storage cases: four-seat 340cm chaise sofa 3 calls / 8,258 triangles; 200cm double vanity with four drawers 26 calls / 8,866 triangles; 140cm round storage ottoman 7 calls / 2,342 triangles. Open and closed storage main counts match, and each settles to zero idle GPU draws. The open double-vanity capture recorded five additional shadow/blur passes during its orbit window; this is retained in raw evidence rather than presented as zero.

Measurements: local Next development server, desktop Chromium at 1440×1100 DPR1, SwiftShader software renderer, cached directional shadows, 700ms idle window. Counts include the scene. This is a geometry/resource-cost check, not a device frame-rate benchmark.
