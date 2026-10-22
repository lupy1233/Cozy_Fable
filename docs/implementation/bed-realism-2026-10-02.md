# Lightweight bed realism — 2026-10-02

Status: implemented locally; no commit or deployment.

## Scope and assumptions

Modules: shared BED visual geometry, frontend bed geometry and moving-assembly batching, rendering tests and measurement/capture tools. Database tables: none. Saved configurations, mattress choices, frame dimensions, quoted measurements, finishes and storage options remain authoritative and unchanged. Bedding is visual context, not a quoted item. The existing closed lift-up representation is retained.

## What changed

- One mattress form replaces the stacked mattress/topper silhouette; edge seams remain attached.
- Duvet and throw drape over the sides and foot, with broad folds and a turned upper edge. Both use the same physical-coordinate grid, so the throw follows the duvet at every mattress width and rendering tier.
- Pillows have a softer crown, slight compression, rounded corners and a seam generated from their actual perimeter.
- Existing upholstered headboard segments are convex padding rather than rounded boxes.
- Each moving drawer uses material batches under the existing animation/click group. Static room and house representations use the same geometry with lower tessellation.
- Geometry changes only when configuration changes. No cloth simulation, new image textures, extra lighting, postprocessing or permanent animation loop.

## Measured rendering cost

Same local Chromium fixture, viewport 1440 × 1100, DPR 1, before/after source changes. Counts below are the main scene render during steady orbit with directional shadows cached. They are not FPS measurements or total GPU memory. Upholstered fixture: K180/lift-up; wooden and drawer fixtures: Q160.

| Bed / view | Main draw calls before → after | Triangles before → after | Tracked buffer bytes before → after |
| --- | ---: | ---: | ---: |
| Wooden / detail | 7 → 7 | 8,450 → 8,114 | 1,419,544 → 1,363,096 |
| Upholstered / detail | 8 → 8 | 15,978 → 13,382 | 2,684,248 → 2,248,120 |
| Drawers / detail, closed or open | 35 → 23 | 22,830 → 22,494 | 3,230,584 → 3,778,936 |
| Wooden / room | 10 → 10 | 3,396 → 3,384 | 569,016 → 567,000 |
| Upholstered / room | 11 → 11 | 5,580 → 5,148 | 935,928 → 863,352 |
| Drawers / room | 11 → 11 | 8,496 → 8,484 | 1,425,816 → 1,423,800 |

The drawer editor trades approximately **0.52 MiB** of vertex buffers for **34% fewer main draw calls** because batching retains local texture coordinates. The other measured variants reduce buffer use. Texture counts are unchanged. Every case recorded zero idle renders and zero idle draws over the 700 ms idle sample. Contact-shadow recapture still runs briefly after animation/configuration changes; the open-drawer sample records five finishing shadow/blur passes.

This establishes geometry/submission cost, not a physical-phone frame-rate guarantee. No new heavy assets or extra rendering passes were introduced. The developer server and software/browser environment are not production-device performance evidence.

## Acceptance

- [x] All four mattress sizes retain bounded, finite geometry in detailed and overview rendering.
- [x] Hanging bedding stays above 0.37 m, clear of the frame/drawer fronts, and inside the configured footprint.
- [x] Runner and duvet remain aligned; permanent raycast tests check boundaries and side drapes with a consistent 4 mm gap.
- [x] Foot drape begins outside the mattress edge instead of cutting through it.
- [x] Bed geometry stays within the previous detailed/overview triangle budgets.
- [x] Shared suite: 473 tests pass. Frontend 3D suite: 115 tests pass. Frontend typecheck and lint pass, using bundled Node 24.19.0.
- [x] Desktop/mobile control tests pass: mattress, upholstery, finish and storage changes; snapshots and no horizontal overflow.
- [x] Existing drawer opening, reversing and tray-click closing pass; camera stays stable after edits and in room/house checks.
- [x] Two resize cycles (six size changes) return to exactly 118 buffers, 3,778,936 tracked buffer bytes and eight GPU textures in the open-drawer editor; closing releases all geometry buffers.
- [x] Native application screenshots inspected; no browser/WebGL errors in captures or measured cases.
- [x] No schema, pricing, backend, external-service, security or personal-data changes.

Repeat cost measurements with `node tools/measure-bed-performance.mjs <output.json>`, with the local dev server on port 3100. Optional `BED_COST_CASE=drawers` selects one fixture; `BED_COST_LIFECYCLE=1` adds repeated resizing and close/disposal checks. `tools/verify-3d-mechanics.mjs` accepts `MECHANICS_KIND=BED`. The gallery tool now honors `GALLERY_KINDS=BED` for both default and variant captures.

User-facing comparison images and raw before/after measurements are in this chat's `outputs/bed-realism` directory. Existing unrelated working-tree changes were preserved.
