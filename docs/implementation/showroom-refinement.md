# Showroom refinement — 2026-09-16

Status: visual refinement and automated rendering verification complete; final production packaging blocked by the unavailable Docker engine. Requested by the user after reviewing the first implementation.

## Scope and visual direction

Modules: shared derived furniture geometry and tests; frontend material/geometry rendering, studio lighting and camera framing; acceptance harnesses. No database tables, saved configuration schema, quotation quantities or pricing rules change in this visual pass.

Keep the approved clean showroom direction and existing UI identity. The furniture, not new interface decoration, carries the change. Existing typography and layout remain unchanged.

- Palette: paper `#f7f3ec`, natural oak `#b9956e`, oak fronts `#c3a27d`, walnut `#71513c`, linen `#afa594`, bedding `#f4f1e9`.
- Material principle: understated grain following board direction, matte/satin finishes, restrained brass, soft textile highlights. No external texture/HDR downloads.
- Shape principle: plausible furniture construction inside the existing authoritative dimensions; cushioned forms for upholstery, not rounded blocks everywhere.
- Presentation: three-quarter view with stronger canvas occupancy and breathing room; floor-contact shading and local studio reflections. Same materials in piece editing, room placement and firm viewing.

Review against brief: no unrelated typography, brand palette, page redesign, decorative animation or objects not included in the configuration. Preserve functional diagrams and physical configuration choices. Wood texture should not resemble vertical fluting; bedding should not resemble stone slabs.

## Ownership

Root: frontend materials/lighting/camera, visual comparison, integration and final evidence. Furniture agent: derived panel metadata and bounded shared geometry, all-family/variant tests. Acceptance agent: saved-data/storage/WebGL/browser failure paths. Packaging agent: runtime image layout and final-image checks. Only root approves a final serialized build after source freeze.

## Acceptance

- [x] Capture and inspect all ten default families against the preserved `screenshots/furniture-gallery` baseline.
- [x] Inspect upholstered/storage bed, round/extendable table, shoe/storage bench, walnut/dark/painted and handled cabinet variants.
- [x] Verify visual geometry stays inside the declared bounds and costs do not gain visual bedding entries.
- [x] Verify room/company viewer shares the overview renderer/material tier in code; native room/house captures pass. Fresh authenticated firm-browser acceptance remains blocked with the backend.
- [x] Rerun named small/large software-render fixtures; report real changes rather than implying hardware FPS.
- [x] Rerun regular tests and global typecheck/lint: 553 tests pass.
- [x] Repeated editor edits/reopens settle at the same resource counts; all buffers disposed and remaining renderer textures released on context close.
- [ ] Final production packaging and browser/PDF smoke: Docker/WSL unavailable; preserve the 2 GiB system-drive cutoff when resuming.

## Technical references

Detailed piece-editor reflections use Three.js's built-in room scene and PMREM filtering, not a remote asset: [Three.js RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html), [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html). Each detailed canvas owns and disposes its environment render target. Ground shading is captured when the piece configuration changes, with bounded recapture during existing door animation; no permanent animation loop is introduced.

First material/camera review: `screenshots/showroom-refinement-pass1` contains native WebGL captures of bookcase, bed and table, with zero page errors. Review found over-lightened timber and tight bed framing; lighting/framing were adjusted before the complete geometry/variant pass. These are iteration evidence, not final acceptance screenshots.

## Independent review corrections

- Round tops now bake real metric dimensions into their vertex positions instead of stretching a unit-cylinder shader; rounded lathed rims remain inside the declared dimensions.
- Camera framing solves all eight bounding-box corners and expands the orbit limit accordingly; extreme widths no longer get clamped into cropping on narrow canvases.
- Finish/grain-mode changes explicitly replace the material program, preventing a stale wood shader after switching to paint.
- Replaced third-party contact-shadow use with an owned pass that disposes off-tree GPU targets/materials, excludes invisible hit areas, and restores renderer state even if capture fails.
- Static room/house panels batch by compatible material while retaining piece/selection boundaries and local grain coordinates.

## Performance decisions

The first richer-renderer measurement failed the existing software-render budget: small-scene p95 about 100 ms despite fewer draw calls. Limiting reflections to furniture and removing unnecessary physical-material effects reduced it to 66.8 ms. Whole-house overview materials without microscopic weave/reflections reduced it to 33.4 ms, but the larger full-tessellation scene still failed at 166.7 ms. These rejected iterations remain in the performance JSON reports; they are not final performance claims.

The implemented quality split is deliberate: the close-up piece editor retains fine roundovers, upholstery, grain, local reflections and ground-contact shading; room/house overviews use lower-cost lighting and tessellation of the same bounded furniture parts. No parts, storage options, dimensions or quotation entries are removed.

The frozen-renderer edit/close/reopen probe found no growth: eight textures and 61 buffers per editor context after repeated finish/dimension edits, complete release on context close, and no shader/page errors or duplicate-Three browser warnings. Final results are in `screenshots/rendering-regression/results.json`; allocation versus context-release details are in `browser-verification.md`.

Final overview run: all four small/large desktop/mobile-emulation samples pass the unchanged software budgets. Small/large draw calls are 31/255; p95 ranges 33.3-83.4 ms. Detailed/overview geometry tests verify every part is retained and bounds are unchanged; overview vertex counts are below 65% of detailed counts for all ten defaults. See `performance/README.md` for rejected iterations, the memory trade-off and explicit limits.

Final native galleries: `screenshots/showroom-refinement-defaults/contact-sheet.png` and `screenshots/showroom-refinement-variants/contact-sheet.png`. Root inspected all 20 captures: no missing parts or clipping; wood, painted, upholstery and bedding remain visually distinct. These are actual application WebGL captures, not generated concept images. User visual review and physical-device acceptance remain separate.
