# Environment & tooling gotchas

This chapter covers the local toolchain Claude works in: Claude Code workspace settings, the Windows shells (PowerShell 5.1 and Git Bash), git, Docker, pnpm monorepos, the Prisma and Next.js CLIs, test runners and the embedded browser/preview pane. Most entries are tagged `GOTCHA`. They describe traps that look like app bugs but come from the environment.
To adapt it to another project, keep the sections that match your stack, fill in the `<PLACEHOLDERS>` and delete the rules for tools you don't use. Add each new environment trap here as soon as it costs you time.

## Claude Code workspace setup

- **ENV-001** `SHOULD` In the user-level `~/.claude/settings.json`, set the default model to the 1M-context variant (the model id with the `[1m]` suffix) and set `effortLevel: "high"`.
- **ENV-002** `SHOULD` Enable these plugins at user level. The part after `@` in each `enabledPlugins` key must match a marketplace key, so use exactly these names:
  - `enabledPlugins`, all `true`: `code-review@claude-plugins-official`, `claude-code-setup@claude-plugins-official`, `frontend-design@claude-plugins-official`, `andrej-karpathy-skills@karpathy-skills`, `i-have-adhd@i-have-adhd`
  - `extraKnownMarketplaces`: `"karpathy-skills": { "source": { "source": "github", "repo": "forrestchang/andrej-karpathy-skills" } }` and `"i-have-adhd": { "source": { "source": "github", "repo": "ayghri/i-have-adhd" } }`
- **ENV-003** `SHOULD` Set `tui: "fullscreen"`, `autoUpdatesChannel: "latest"`, `inputNeededNotifEnabled: true`, `agentPushNotifEnabled: true` and `skipWorkflowUsageWarning: true`. — _why:_ long agent runs then notify you when they need input or finish.
- **ENV-004** `SHOULD` In `.claude/settings.local.json`, pre-allow narrowly scoped command families and pair them with deny rules. A wildcard over a whole CLI (`gh repo *`, `gh auth *`, `pnpm *`, `pnpm prisma *`) also grants its destructive subcommands: deleting or publishing a repo, printing the auth token, `pnpm dlx`/`publish`, `prisma migrate reset --force`.
  - `permissions.allow`: `Bash(gh --version)`, `Bash(gh auth status)`, `Bash(gh repo view:*)`, `Bash(git remote -v)`, `Bash(git ls-remote:*)`, `PowerShell(pnpm install*)`, `PowerShell(pnpm -F *)`, `Bash(docker compose:*)`, `Bash(docker ps:*)`, `Bash(docker port:*)`, `Bash(docker version*)`, `Bash(npx prisma:*)`, `curl` checks against localhost dev ports (e.g. `Bash(curl -s http://localhost:<DEV_PORT>/*)`), `Skill(run)`
  - `permissions.deny`: `Bash(gh repo delete:*)`, `Bash(gh repo edit:*)`, `Bash(gh auth token:*)`, `Bash(gh auth logout:*)`, `PowerShell(pnpm publish*)`, `PowerShell(pnpm dlx*)`, `Bash(npx prisma migrate reset:*)`, `Bash(npx prisma db push:*)`, `Read(./**/.env)`, `Read(./**/.env.local)`
  - `docker exec` and `docker stop` change state; keep them on prompt unless the project needs them. Do not pre-allow `Get-Content *` or `cat *`: they read `.env` secrets with no prompt (ENV-007).

  Deny rules match by prefix, so reordered variants (`pnpm -F <pkg> publish`, `docker compose -f <file> down -v`) slip past them. Treat the deny list as a guard rail, not a sandbox, and keep the allow list narrow.
- **ENV-005** `AVOID` Approving one-off literal commands that contain PIDs, temp-log paths or test emails. Allowlist command families with wildcard rules instead, e.g. `Bash(docker compose:*)`. — _why:_ a literal entry never matches again, so these entries pile up in the allowlist without reducing future prompts.
- **ENV-006** `SHOULD` Exclude noise and secrets with `permissions.deny` Read rules in `.claude/settings.json`: `Read(./**/node_modules/**)`, `Read(./**/.next/**)`, `Read(./**/dist/**)`, `Read(./**/build/**)`, `Read(./**/coverage/**)`, `Read(./pnpm-lock.yaml)`, `Read(./**/generated/**)`, `Read(./**/.prisma/**)`, `Read(./**/*.pdf)`, `Read(./**/*.docx)`, `Read(./<INFRA_DIR>/data/**)`, `Read(./**/.env)`. Claude Code does not read a `.claudeignore` file; keep one only as documentation, or if another tool in your setup reads it. The @-file picker follows `.gitignore` through the `respectGitignore` setting. — _why:_ keeps searches and context free of noise, huge generated files and secrets. These rules cover Claude's file tools only. They do not stop indirect reads such as `grep -r`, `cat` or scripts run through the shell.
- **ENV-007** `GOTCHA` Auto mode refuses to read secrets out of `.env` files and reports it as "credential materialization". For a local test or demo account, prefer credentials defined in the project's seed or fixture files, or ask the user to supply a local test password. Never ask for production secrets. Never edit any `.env` file yourself; use process-level env overrides instead (ENV-023). See OPS-100.
- **ENV-008** `SHOULD` Before you plan to use a tool (a formatter, image tools), check that it is actually installed. A bare Windows machine may have no sharp, ffmpeg or ImageMagick. There, process images with PowerShell and `System.Drawing`: crop to the bounding box of the non-transparent pixels using LockBits, then resize.

## Windows shells: PowerShell 5.1 and Git Bash

- **ENV-009** `GOTCHA` Git Bash (MSYS) rewrites arguments that look like POSIX paths: `/PID` and `/foo` become Windows paths. For the flags of native Windows commands, use doubled slashes (`taskkill //PID <pid> //F`) or prefix the command with `MSYS_NO_PATHCONV=1`. To find the process holding a port, use `netstat -ano`.
- **ENV-011** `MUST NOT` Never put prose that contains backticks or other shell metacharacters on a command line. This covers commit messages, doc edits and text echoed into files, especially double-quoted strings in Git Bash. It also covers PowerShell here-strings passed to `git commit -m`, which can be corrupted. Write the text to a file in the scratchpad first and pass the file, e.g. `git commit -F <file>`. — _why:_ shell command substitution on backticked text once ran a production deploy command by accident (if that ever happens, follow OPS-006).

## Git on Windows

- **ENV-015** `GOTCHA` For files with fixed line endings (e.g. locale or message JSON in CRLF), the index/HEAD endings are authoritative:
  - Check them with `git ls-files --eol <file>` (`i/` = index, `w/` = working tree).
  - Write edits with the index endings and keep the file's existing indentation. Scripts must emit `\r\n` explicitly: Python `open(..., newline='\r\n')`, Node `.replace(/\r?\n/g, '\r\n')`.
  - If the working tree has drifted (e.g. CRLF in HEAD, LF on disk, so the diff shows the whole file rewritten), normalize it back to the index endings before committing.
  - Check with `git -c core.whitespace=cr-at-eol diff --check`.

## Local infrastructure and Docker

- **ENV-017** `SHOULD` Run the local infrastructure (Postgres, Redis, S3-compatible storage, a mail catcher) with `docker compose -f <INFRA_COMPOSE_FILE> up -d`. Check that it is up with `docker ps --filter name=<PROJECT_PREFIX>`.
- **ENV-018** `GOTCHA` If Docker Desktop is simply not running (no Docker Desktop process, and `docker version` cannot reach the engine pipe), start it with `Start-Process` from the first of these paths that exists: `$env:ProgramFiles\Docker\Docker\Docker Desktop.exe`, `${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe`, `$env:LOCALAPPDATA\Docker\Docker Desktop.exe`. If it is running but the engine or WSL is failing, do not restart it; follow ENV-019.
- **ENV-019** `MUST NOT` When Docker or WSL fails, diagnose it read-only. Never factory-reset Docker, unregister WSL, delete or move the virtual disk, prune images or volumes broadly, change engine settings or restart unrelated services. Ask the user to restart Docker Desktop and to confirm the engine is running.
- **ENV-020** `MUST` Stop image builds and exports when free space on the system drive falls below `<FREE_SPACE_CUTOFF>` (default: about 2 GiB). Delete only cache entries you created and have verified, and ask the user to free space instead of pruning broadly.
- **ENV-022** `MUST NOT` Never restore a shared local database from a backup while other sessions may be writing to it: the restore also deletes every row they wrote since the backup was taken. Run destructive tests against a separate, disposable database so no restore is needed. If a restore is unavoidable, announce it first and report the window of lost writes.

Container image authoring (openssl before Prisma on Debian bookworm images): see OPS-017.

## Local networking

- **ENV-023** `GOTCHA` On Windows, `localhost` can resolve to `::1`. There the Docker/WSL relay accepts the connection and then resets it or lets it hang. This affects Postgres, Redis, S3/MinIO and SMTP/Mailpit. Use either of these fixes:
  - use `127.0.0.1` for test hosts, and set it as a process-level env override rather than by editing `.env`
  - start Node with `NODE_OPTIONS=--dns-result-order=ipv4first`

Redis/BullMQ clients on IPv6 private networking (password plus `family: 0`): see OPS-097.

## Monorepo, pnpm and configuration

- **ENV-025** `SHOULD` Commit a `.env.example` template for each app. Set up local config by copying it, e.g. `cp apps/backend/.env.example apps/backend/.env`.
- **ENV-026** `SHOULD` Use the Node version pinned in the repo's `.node-version`, which CI also reads via `node-version-file`. If the system Node is older, put a bundled runtime first on PATH instead of changing the system install.
- **ENV-027** `GOTCHA` The apps read the shared package's built `dist`, so follow the build order in STK-004: rebuild with `pnpm -F <SHARED_PKG> build` (or a root `pnpm build:shared` script), restart the backend dev server, which keeps the old dist in memory, then typecheck, build, start the apps or run a Docker build. If Jest's `moduleNameMapper` points the shared package at its `src`, passing unit tests do not prove that typecheck sees the new types.
- **ENV-028** `SHOULD` After pulling changes, apply pending migrations and regenerate the client. In agent shells, run `prisma migrate deploy` (it applies pending migrations only) and `prisma generate`. In an interactive human shell, `prisma migrate dev` is fine. Rebuild the shared package too, unless it is running in watch mode. Do the same before running tests after a new migration lands: an unapplied migration leaves the generated client out of sync with the database.
- **ENV-029** `GOTCHA` Code that reads `process.env` when a module is imported sees only the real process environment. It does not see the `.env` file that the config module loads later.

## Prisma CLI in agent shells

- **ENV-030** `GOTCHA` `prisma migrate dev` needs a TTY, so it fails in agent shells. Use this sequence in place of steps 1–3 of STK-024 (it replaces the `migrate dev` step and keeps validate and generate):
  1. Edit `schema.prisma` and run `prisma validate`.
  2. Check the newest existing migration (ENV-031), then create `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`.
  3. Generate its SQL with `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <SHADOW_DB_URL> --script` (preferred). Use `--from-schema-datasource` against the dev database only if `prisma migrate status` shows the dev database matches the applied migrations exactly; otherwise local drift ends up in the migration. Flag names change between Prisma versions, so check them with `prisma migrate diff --help`.
  4. Review the generated SQL and delete any DROP of hand-written objects such as partial unique indexes, CHECK constraints or triggers (STK-028).
  5. Apply it with `prisma migrate deploy`.
  6. Run `prisma generate`.
  7. A `migrate diff` from the database to the schema must come back empty (STK-028).
- **ENV-031** `GOTCHA` Check the newest existing migration before you name a new one. Parallel agents and branches have produced identical timestamps. If two collide, rename one when you merge.
- **ENV-032** `GOTCHA` On Windows, `prisma generate` fails with EPERM while `nest --watch` or any other running backend holds the query-engine DLL. The type files still regenerate and the engine itself is unchanged. For a clean result, stop the dev server and run `prisma generate` again.

## Next.js and dev servers

- **ENV-033** `SHOULD` If another project is using the dev port, add a separate launch configuration on another port instead of killing that project's process, e.g. `pnpm -F frontend exec next dev -p <ALT_PORT>`.
- **ENV-034** `MUST NOT` Never run two Next.js builds or dev servers against the same `.next` directory: only one build may use a build-output directory at a time (package installs and builds in a shared checkout: DEL-037). — _why:_ concurrent builds produce spurious generated-file failures that look like app defects.
- **ENV-035** `GOTCHA` On Windows, a local `next build` can compile and generate every page and still fail at the end, in one of two ways:
  - at the standalone-output copy step, when the user has no symlink rights (Developer Mode or admin)
  - with EPERM on `.next/trace`, while a dev server holds `.next`

  Stop the dev server and delete `.next` (or at least `.next/BUILD_ID`) before the build. Only a `BUILD_ID` created after the build started shows that compilation passed, so compare its mtime with the build start time; a file left by an earlier build proves nothing. Validate production builds in Docker/Linux, and do not report either failure as an application defect.
- **ENV-036** `GOTCHA` Next.js dev mode compiles each route on its first visit, so a 5–10 s first load is not a finding. Measure real latency directly against the API.
- **ENV-037** `GOTCHA` A dev server can time out while it compiles, and a concurrent hot reload can load empty initial state in the middle of a test. Before you report a failure or declare the server healthy, check again that it responds and rerun on a stable server.
- **ENV-038** `GOTCHA` React Fast Refresh remounts components with fresh refs. Mount effects can then run again in a page that is already open and create server records that seem to come from nowhere. If phantom rows appear in dev, check this first.

## Test runners and worktrees

- **ENV-039** `GOTCHA` Jest with AWS SDK v3 (the S3 client) needs `NODE_OPTIONS=--experimental-vm-modules`, because the SDK uses dynamic imports. Set it locally and in CI.
- **ENV-041** `GOTCHA` In git worktrees under `.claude/`, Jest finds 0 tests because the path contains `.claude`. Run `npx jest --testMatch "<TEST_GLOB>"` (e.g. `**/src/**/*.spec.ts`) instead. A dev server started in a worktree keeps the worktree locked. Stop only a dev server you or your subagent started in that worktree: confirm the PID's command line and working directory first (e.g. `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`), then `taskkill`, then remove the worktree. A PID listening on a port is not proof that the process belongs to that worktree (ENV-033).

jsdom selector recursion with popovers (`:popover-open`/`:modal`): see STK-116.

## Embedded browser pane: rendering and timing

_Observed in the Claude desktop browser pane, 2026. Pane and browser-tool behavior changes between versions, so re-verify the rules in this section and the next one on newer versions before relying on them._

- **ENV-042** `GOTCHA` The embedded preview pane runs as a hidden document: `document.hidden` is `true`, the viewport is effectively 0×0 and `requestAnimationFrame` is paused. Everything that waits for a frame stalls. Symptoms:
  - CSS animations freeze on their first keyframe (ENV-043).
  - Exit animations and smooth scrolling hang (ENV-046, ENV-047).
  - IntersectionObserver never fires.
  - Hooks that measure elements return nothing.
  - Screenshots can time out, and WebGL does not render (ENV-045).

  Verify by reloading each screen and reading the DOM with `get_page_text` or `javascript_tool`, do visual QA in a real browser, and report what the pane cannot show as unverified (WM-031). Before changing code for a symptom seen only in the pane, rule these artifacts out first; fixed overlays and animations in particular can look broken only there. — _why:_ these are artifacts of the pane, not app bugs, unless the app's own flow depends on them.
- **ENV-043** `GOTCHA` Screenshots below the fold come out blank because animations are frozen. Run `document.getAnimations().forEach(a => a.finish())` before you capture.
- **ENV-044** `GOTCHA` To make rAF-driven code run in the hidden pane, use `javascript_tool` to replace `requestAnimationFrame` with a `setTimeout` version, then dispatch a `resize` event. To capture a WebGL scene, call `gl.render()` and then `canvas.toDataURL()`. — _why:_ rendering just before the capture works without `preserveDrawingBuffer`.
- **ENV-045** `GOTCHA` WebGL canvases do not render on their own in the pane: the canvas stays at 300×150, raycasting does nothing even with synthetic PointerEvents, and screenshots can crash. Forcing a frame (ENV-044) produces a PNG that confirms the scene mounted and is not blank. That is a smoke check, not visual QA. Verify 3D logic through JS state on a dev-only route and with unit tests, and leave interactive and visual 3D sign-off to a real browser.
- **ENV-046** `GOTCHA` Smooth `scrollBy`/`scrollTo` never moves in the pane. To test scroll logic, assign `el.scrollLeft` and `el.scrollTop` directly.
- **ENV-047** `GOTCHA` In the pane, dialogs with exit animations (e.g. Radix) stay mounted after they close, and scroll-driven motion effects never change state. Do not diagnose close or scroll bugs from the pane alone; check them again by eye in a real browser.
- **ENV-048** `GOTCHA` The pane's viewport size is unreliable. After you clear size emulation (the desktop/"native" preset), `window.innerWidth` can read 0 and the page switches to its mobile layout. Set an explicit width and height before you measure anything. Check for overflow in JS by comparing `scrollWidth` with the viewport width, not by looking at screenshots.

## Embedded browser pane: synthetic input

- **ENV-049** `GOTCHA` Screenshot pixels and click coordinates have been observed to use different, non-uniform scale factors. If clicks land off-target, switch to element refs from `read_page` or `find` instead of coordinates.
- **ENV-050** `GOTCHA` `form_input` does not submit the form. Type the value and press Enter instead. Cap `browser_batch` calls at about 25 actions (an observed limit, not a documented one).
- **ENV-051** `GOTCHA` Reading the DOM in the same `javascript_tool` call that made a synthetic click returns the old state. Read the result in a separate call. — _why:_ React applies the update on a later tick.
- **ENV-052** `GOTCHA` Synthetic clicks dispatched in the same JS tick all see the same stale React closure. Only the last selection survives, so a "select, then Continue" sequence fails validation. Dispatch each click in its own tool call, or space them out with `setTimeout`.
- **ENV-053** `GOTCHA` In a hidden document, synthetic focus and blur events do not trigger React `onBlur`. Dispatch `new FocusEvent('focusout', { bubbles: true })` instead of `new Event('blur')`, or call the handler from the element's `__reactProps$…` key.
- **ENV-054** `GOTCHA` A `KeyboardEvent` dispatched on `window` does not reach listeners registered on `document`. Dispatch synthetic keyboard events on `document`.
- **ENV-055** `GOTCHA` Third-party widgets ignore synthetic key presses (e.g. the legacy Google Maps Places Autocomplete). To test one:
  1. Get the widget instance from the input's React fiber.
  2. Stub the getter it reads, e.g. `getPlace`.
  3. Fire the widget's event through the library's own API, e.g. `google.maps.event.trigger(instance, '<event>')`.
- **ENV-056** `GOTCHA` A synthetic click that misses its target can press a real button and change state without you noticing, e.g. by creating an extra empty record that later checks then find. Before you conclude that events stopped working, check the relevant state, such as the id of the active entity.
- **ENV-057** `GOTCHA` `document.body.innerText` does not include `title` or `aria-label` text. Check icon-only buttons with `querySelector('[title="…"]')` or an `[aria-label="…"]` selector.

## Verification hygiene

- **ENV-058** `GOTCHA` The pane keeps its console buffer across navigations, so old hot-reload errors show up on every read. Confirm that a bug reproduces with logging added to the page itself before you trust it.
- **ENV-059** `GOTCHA` If the app allows only one active session per account, logging in with curl ends the browser session for the same account, and open pages stay stuck loading. Expect this during API checks and log in again in the browser; it is not a bug.
- **ENV-060** `MUST` Load demo or test fixtures only in an isolated browser profile or test context. Never overwrite the user's existing local data to run a demonstration.

## Deploy CLI (Railway)

Railway CLI traps (per-worktree `railway link`, `railway up` from PowerShell only, `railway run` cannot reach private `*.railway.internal` hosts, classifier-blocked commands): see OPS-075, OPS-098 and OPS-100.

## Adapting to a new project

- Fill in `<INFRA_DIR>`, `<INFRA_COMPOSE_FILE>`, `<PROJECT_PREFIX>`, `<SHARED_PKG>`, `<DEV_PORT>`, `<ALT_PORT>`, `<SHADOW_DB_URL>` and `<TEST_GLOB>`, and decide `<FREE_SPACE_CUTOFF>` for the build machine.
- Apply the user-level settings (ENV-001…ENV-003) once per machine. Copy the `.claude/settings.local.json` allow and deny lists (ENV-004, ENV-005) and the Read deny list (ENV-006) into each repo, and adjust the globs to its layout.
- Delete the sections for tools the new stack does not use, such as Railway, Prisma, Next.js, Radix or WebGL. Keep the browser-pane sections whenever Claude checks UI in the embedded browser.
- Pin line endings in `.gitattributes` (e.g. `*.json text eol=crlf`) or list the files with fixed endings, so that ENV-015 covers the right files.
- Pin the Node version in `.node-version` and point CI at it (ENV-026). Commit a `.env.example` for each app (ENV-025).
- If the shared package is consumed through `dist`, add a root `build:shared` script and make it the first step of every typecheck (ENV-027, STK-004).
