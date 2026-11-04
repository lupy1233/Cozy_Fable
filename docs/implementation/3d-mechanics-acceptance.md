# 3D camera and furniture mechanics — 2026-09-16

## Scope and assumptions

Frontend modules: piece3d editor/viewer, studio room/house canvases. Shared module: derived piece3d geometry. Tables: none. Backend/API/realtime/auth/pricing/saved configuration: unchanged.

Existing hinged and drawer fronts are inset (`incadrate`); preserve this construction. Sliding fronts become inset as requested. Tracks, runners and moving-assembly metadata are derived visual geometry, not supplier specifications or a bill of materials. Existing user changes in this dirty workspace are preserved.

## Sprint 1 — preserve camera pose

- [x] Piece finish, dimension and configuration edits preserve position, target and zoom.
- [x] Room floor, dimensions, furniture and house layout edits preserve the camera.
- [x] First mount initializes an appropriate view, including narrow viewports. Bed drawer views reserve room for the open trays.

Orbit damping is explicitly disabled: releasing a drag stops camera motion immediately, independently of frame rate. House layout edits no longer remount the Canvas. Camera effects initialize once per camera/room, including React StrictMode.

## Sprint 2 — furniture construction and motion

- [x] Absolute-time animation covers doors, drawers, legacy tilt fronts and sliding fronts, including idle/reversal/reduced motion.
- [x] Sliding doors remain inside carcass and use visible tracks/guides; interiors clear the track depth. Flush pulls do not collide with the passing leaf.
- [x] Drawer trays/runners remain attached and plinth has side/back support. Inset shelves and desk fronts clear the carcass; normal handles have mounting posts.
- [x] Fixed runners mount to cabinet walls/bed separators with brackets; upper and lower sliding shoes physically contact their rail decks (explicit contact assertions).
- [x] Four bed drawers open as complete trays, with individual tray click targets and a keyboard-accessible open/close button.
- [x] Contact shadows use nearest-surface depth, stay aligned and include the final animated pose; decorative gap panels do not cast exterior shadows.

Configured full-travel durations: cabinet drawers 400 ms, legacy tilt 420 ms, bed drawers 480 ms, hinged doors 520 ms, sliding leaves 620 ms. Reversal begins at the current position and scales duration to remaining travel; reduced motion settles immediately. Sliding stages advance from actual rendered completion callbacks, not guessed timers. Internal drawers cannot open through an obstructing sliding leaf, and changing leaves closes drawers before moving a leaf. Dragging does not toggle a zone.

Lift-up beds remain a static closed preview. Realistic opening requires the intended linkage/translation geometry; no generic pivot animation was added that would pass bedding through the headboard. Tilt-out is a historical stored type: current normalization migrates it to drawers; retained tilt rendering has a real attached tray and geometry tests.

## Sprint 3 — acceptance

- [x] Shared and frontend regression suites; typecheck and lint.
- [x] Native browser captures reviewed for all ten families and ten finish/storage variants.
- [x] Desktop/mobile camera and interaction checks for bed, dresser, sliding wardrobe and hinged doors; no browser/WebGL exceptions.
- [x] Security-close review of this change and changelog updated.

Evidence: `screenshots/3d-mechanics-gallery/contact-sheet.png`, `screenshots/3d-mechanics-variants/contact-sheet.png`, and `screenshots/3d-mechanics/` native open/closed/mobile captures. `tools/verify-3d-mechanics.mjs` observes the real Three renderer without production debug globals, checks identical camera positions/quaternions through actual UI edits, samples intermediate/final motion, verifies the bed tray hit target, and asserts no room/house Canvas remount. All browser API calls use isolated synthetic guest fixtures.

Automated coverage: 246 shared tests (including 28 construction regressions), 130 frontend tests (camera lifecycle, animation lifecycle/idle/reversal/completion, sliding collision sequencing, shadow projection). Global typecheck/lint pass. CLI emits the existing Node 21 vs project Node >=22 engine warning; validation is local development, not a production/container build. A Three dual-module warning occurs in a unit test process; native browser runs show no page/WebGL errors. Physical-device performance and manufacturer-specific hardware fidelity are not established by these screenshots.

## Files and security close

- Shared: `packages/shared/src/questionnaire/piece3d/{model,furniture-model,drawer-model,index,construction.test,piece3d.test,furniture.test}.ts`.
- Frontend: `piece-canvas.tsx`, `piece-viewer.tsx`, `configurator3d-step.tsx`, `stable-orbit-camera.tsx`, `open-tween.ts`, `use-open-tween.ts`, `use-cabinet-fronts.ts`, `furniture-motion.tsx`, `showroom-panel.tsx`, `showroom-batches.tsx`, `showroom-contact-shadow.tsx`, related regression tests; studio room/house canvases and room viewer; RO/EN button labels.
- PASS: no new endpoints, money mutations, audit events, uploads, secrets, auth storage, ownership changes, cookie/CORS changes or external asset requests. The eight security-close checks have no new server-side surface to audit.
- PASS: derived geometry/motion metadata never enters saved configuration or pricing. UI animation state remains local. No deploy, commit or push performed.

After reviewing/staging only the intended changes (the workspace already contained unrelated work), suggested checkpoint: `git commit -m "fix(3d): preserve camera and correct furniture mechanics"`.

Manual review: rotate and zoom; change dimensions/finish/floor; verify angle stays fixed. Open/close after idle and reverse mid-animation. Inspect drawer trays from side/above, sliding rails with leaf open, bed storage and shadows at low orbit angles. Repeat on a narrow viewport.

Construction references: [Hettich inset sliding systems](https://shop.hettich.com/us_EN/Sliding-door-systems/Sliding-door-systems-for-inset-door-position/c/group5748370205184) places leaves between the cabinet top and bottom. [Blum runner overview](https://www.blum.com/us/en/products/runnersystems/overview/) distinguishes runner types and extension lengths; this generic preview does not claim a specific product fit.

Open decisions: no critical product decision blocks these rendering fixes. Exact workshop hardware and overlay variants require a separately specified product option before adding them to saved configuration.
