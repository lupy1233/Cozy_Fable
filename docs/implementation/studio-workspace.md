# Studio workspace — 2026-09-16

## Objective and scope

Make the room the primary workspace. Move furniture, room settings and house controls inside it, with minimize and hide actions. This sprint changes frontend components, RO/EN text and browser coverage. No tables, migrations, API contracts, realtime behavior or saved Studio format change. Existing workshop rules and authentication remain unchanged.

Design: full-width ivory canvas, a quiet top command bar, bottom tool dock and compact white floating panels using the existing walnut accents and DM Sans/Marcellus typography. One optional settings panel at a time; room and house share the same area. On phones secondary commands use labelled icons. Initial portrait framing fits the room; subsequent viewport changes preserve the user camera.

## Files

- `apps/frontend/src/app/[locale]/_components/public-shell.tsx` and `studio/page.tsx`: full-width Studio shell.
- `apps/frontend/src/components/studio/studio-page.tsx`: workspace, toolbar/dock, collapsible panels, tutorial placement, view switching.
- `apps/frontend/src/components/studio/house-editor.tsx` and `house-canvas.tsx`: full-size plan/3D view and collapsible house settings.
- `apps/frontend/src/components/studio/room-canvas.tsx`: reject palette drops over DOM panels.
- `apps/frontend/src/components/configurator/piece3d/stable-orbit-camera.tsx` and its test: initial portrait framing with stable subsequent orbit.
- `apps/frontend/src/messages/{ro,en}.json`: workspace labels.
- `apps/frontend/e2e/studio.spec.ts`, `studio-panels.spec.ts` and `studio-authenticated.spec.ts`: updated navigation and workspace regression coverage.

## Acceptance

- [x] Room canvas occupies over 90% of the browser width and over 70% of its height on desktop and Pixel 7.
- [x] Furniture and Room panels open inside the workspace and minimize with keyboard-accessible controls.
- [x] Hide tools leaves a Show tools control; canvas size and DOM identity stay unchanged.
- [x] House plan and 3D use the same workspace; house controls expand/minimize.
- [x] Returning from the house restores the still-mounted room canvas.
- [x] Floor edits, connected-door edits, undo and saved scenes survive reload.
- [x] Selection tools can minimize; room/house toolbar actions clear obsolete selection overlays.
- [x] Palette drops on an overlaid panel are rejected by visible-element hit testing.
- [x] Cancelled opening drags do not synthesize an add click; keyboard activation still works.
- [x] Dragged selection panels reclamp on expansion; fullscreen preserves canvas identity and restores its bounds on exit.
- [x] Desktop/mobile checks report no page errors or page-width overflow.
- [x] Global typecheck and lint pass. Frontend suite: 19 files / 130 tests before portrait change; focused camera suite: 7 passing after the change.
- [x] Four Playwright cases pass: workspace and panel/drag/fullscreen regressions on desktop and mobile. Real-login test navigation updated; the opt-in authenticated journey was not rerun for this UI-only change.
- [x] Green release health and remote Studio checked after deployment. Blue/gateway stay unchanged.

Local Node is v21.6.0 and emits the existing engines warning; Railway builds on the configured Node 22 image.

## Security close

PASS for all applicable checks. No endpoints, money/claim mutations, audit fields, ownership rules, file uploads, secrets, error formats, authentication storage, cookies or CORS changes. Workspace state is presentation-only. Hidden views are inert and excluded from accessibility navigation. No new credentials or sensitive logs.

## Manual review

Open Studio on desktop and phone. Orbit the room, open Furniture, minimize, open Room and change the floor. Verify the angle stays. Open House, expand tools, switch plan/3D, minimize and return. Select a piece, minimize its controls and drag the panel. Hide tools, restore them and enter/exit fullscreen. Existing furniture editors, drafts and request transfer remain available from the workspace.

Screenshots: `screenshots/studio-workspace-{desktop,mobile}.png` and `screenshots/house-workspace-{desktop,mobile}.png`.

No new product decisions required. Green remains a standby preview; account/server writes require an active slot or isolated staging. This preview does not authorize a public traffic switch.

## Deployed preview

- Green: `https://app-green-production-7958.up.railway.app/en/studio`.
- Final deployment: `f8c90028-e311-4085-a771-9738169956c5`, successful; image `sha256:f536b95c89c9c9ffd43ce97efd382f885babf1fee73635858fcd945d3cabe394`.
- Health verifies `green/standby`, PostgreSQL/Redis/storage up, RO/EN 200. Studio returns 200 with the new workspace markup; browser verifies rendered canvas and hide/show controls.
- Blue remains `720549d5-233d-4917-8d85-dc356db0aead`; gateway still targets `backend.railway.internal:3000`.
- Existing release limitation remains: source is uncommitted and health SHA is `unknown`. Promotion readiness is tracked in `blue-green-release.md`; this was a Green preview update only.

Suggested checkpoint, after reviewing the existing mixed worktree: `git commit -m "feat(studio): expand canvas and add collapsible workspace tools"`.
