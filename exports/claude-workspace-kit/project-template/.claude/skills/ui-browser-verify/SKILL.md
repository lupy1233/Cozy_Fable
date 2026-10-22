---
name: ui-browser-verify
description: Use this skill when a UI, page, form, layout or user-facing copy change is about to be reported done, or when asked to check something in the browser ("verifica in browser", "uita-te pe pagina", "testeaza UI", "pe mobil", "screenshot", "check it on mobile", "does the page look right"). Covers starting the local stack, verifying in the embedded preview pane, Playwright desktop + phone runs with failure-path mocks, and the coverage report with an UNVERIFIED list.
---

# UI browser verify

A UI change is done only when it has been seen working in a browser at every required width and in every locale, and the gaps have been named. Code that merely exists is not done (QA-074). Rule IDs in parentheses refer to the workspace rule chapters.

## When to use
- After any change to a component, page, form, dialog, layout, style or visible string, before you say "done".
- When the user asks you to look at a page, test the UI, check mobile, or take screenshots.
- When you add or change Playwright e2e or resilience specs.
- Not for backend-only changes. For those, smoke-test the API with curl (QA-042, QA-043).

## Read first
- `CLAUDE.md` (commands, ports, supported locales) and `.claude/launch.json` (dev server entries).
- `docs/workspace-rules/05-quality-gates-and-verification.md`: "Verifying against the running stack" (QA-042…QA-048), "Browser verification of UI changes" (QA-050…QA-065) and "Acceptance checklists and honest reporting" (QA-072…QA-077, QA-105).
- `docs/workspace-rules/10-environment-gotchas.md`: "Next.js and dev servers" (ENV-033…ENV-038, when the frontend uses Next.js), both "Embedded browser pane" sections (ENV-042…ENV-057) and "Verification hygiene" (ENV-058…ENV-060).
- `<VERIFICATION_LEDGER>`: append this run to it (QA-105).
- `<SEED_SCENARIOS_DOC>` and the seed or fixture files, for test accounts and scenario scripts (ENV-007, QA-072).

## Procedure

### A. Local stack
1. Start servers with the preview tool (`preview_start` with a name from `.claude/launch.json`), not with Bash (QA-050). Run one dev server per build directory: an alternate-port entry is for when another project holds the dev port (ENV-033), never for a second instance of the same frontend, because two Next.js dev servers or builds must not share one `.next` (ENV-034).
2. If a port is busy, find the PID (on Windows `netstat -ano | findstr :<PORT>`) and confirm who owns it from its command line and working directory (`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`). Kill it only if it is this project's server that you or your subagent started: `taskkill /PID <pid> /F` in PowerShell, `taskkill //PID <pid> //F` in Git Bash (ENV-009, ENV-041). Otherwise add an alternate-port launch entry (ENV-033).
3. Poll the server log in a bounded loop (`preview_logs` with `search`) until you see `<BOOT_MARKER>` (e.g. `successfully started`, `Ready in`) or a failure signature (e.g. `error TS`, `Can't resolve`, a dependency-injection error) (QA-042). If `<SHARED_PKG>` changed, rebuild it and restart the backend first (ENV-027).
4. Smoke-test with curl: `curl.exe -s -o NUL -w "%{http_code} %{time_total}" --max-time 10 <API_BASE_URL><HEALTH_PATH>` must return 200 (in Windows PowerShell 5.1 plain `curl` is an alias for `Invoke-WebRequest`; in Git Bash use `curl -o /dev/null`). Check that the frontend root redirects to the default locale and that a locale route returns 200 (QA-043).

### B. Embedded preview pane
5. **Orient.** Run `({hidden: document.hidden, w: innerWidth, h: innerHeight})` in `javascript_tool`. Set an explicit width and height with `resize_window` before you measure anything (ENV-048). If `hidden` is true, rAF, CSS animations, IntersectionObserver and WebGL are frozen (ENV-042).
6. **Capture errors in the page.** After each load, install the hook below, then read `window.__errs` in a later call. Do not trust the pane's console buffer on its own, because it keeps old hot-reload errors across navigations (ENV-058). The hook misses errors thrown during the first load; Playwright's no-page-errors assertion catches those (QA-060).
   `window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rejection: '+e.reason));const _ce=console.error;console.error=(...a)=>{__errs.push(a.map(String).join(' '));_ce(...a)}`
7. **Read, do not look.** Prefer `read_page`, `get_page_text`, `find` and `javascript_tool` over screenshots. Click by `ref` from `read_page`/`find`, not by coordinates, which can land off-target (ENV-049). `innerText` leaves out `aria-label` and `title`, so query icon buttons by selector (ENV-057).
8. **Log in** by typing into the fields and pressing Enter; `form_input` does not submit (ENV-050). Use only test accounts from the seed or fixture files, or ones the user gave in chat, and only on a local dev host (ENV-007). If the app allows one active session per account, logging the same account in with curl ends the browser session; log in again, it is not a bug (ENV-059).
9. **One interaction per call.** Do one click or keystroke, then read the DOM in a separate call (ENV-051). Never dispatch several synthetic clicks in the same tick (ENV-052). Cap `browser_batch` at about 25 actions, an observed limit (ENV-050). Dispatch keyboard events on `document` (ENV-054). If a click seems to do nothing, check the state before retrying, because a missed click can press a real button (ENV-056).
10. **Unfreeze before you read.** Run `document.getAnimations().forEach(a=>a.finish())`, or reload each screen, before you screenshot or read animated content (ENV-042, ENV-043). Set `el.scrollTop`/`scrollLeft` directly instead of smooth scrolling (ENV-046). For rAF-driven code, swap `requestAnimationFrame` for a `setTimeout` shim and then dispatch `resize` (ENV-044).
11. **Events the pane will not fire.** For blur handlers, dispatch `new FocusEvent('focusout',{bubbles:true})`, not `new Event('blur')`; in React you can also call `onBlur` from the element's `__reactProps$…` key (ENV-053). For third-party widgets that ignore synthetic keys, get the widget instance (in React, from the input's fiber), stub the getter it reads, and fire the event through the library's own API (ENV-055).
12. **Canvas/WebGL.** Use a production-gated dev route that renders the feature's state as JSON, and assert on that JSON (QA-058). Force one frame, call `canvas.toDataURL()` and check that it is not blank (ENV-044). This is only a smoke check; visual sign-off goes on the UNVERIFIED list (ENV-045).
13. **Layout matrix.** Check 1280, 375 and 320 px plus at least one width between 640 and 1100 (e.g. 768), in every locale (switch through the locale route or the language toggle) (QA-051, QA-052, QA-054). At each size:
    `({doc: document.documentElement.scrollWidth - innerWidth, out: [...document.querySelectorAll('button,a,input,[role=button]')].filter(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.right>p.right+1||r.left<p.left-1}).length})`
    Both values must be 0 (exclude intentional horizontal scrollers such as carousels). Add the DOM assertions the change needs, such as column widths, an overlay covering the viewport, or Escape closing a dialog, and back layout-stability claims with a measured number (QA-056, QA-057). Check the minimum accessibility bar (QA-065).
14. **Timing.** Ignore the 5–10 s first compile of a route in dev (ENV-036). Time the API directly with curl `-w %{time_total}`. Before you report a failure, confirm the server still responds and rerun on a stable server (ENV-037).

### C. Playwright
15. Run the e2e suite serially (e.g. `pnpm -F <FRONTEND_PKG> test:e2e --workers=1`) on the desktop project and an emulated phone project (e.g. Pixel 7), in every locale (QA-053, QA-039). In specs, log in with `fetch(..., { credentials: 'include' })` rather than through the form (QA-059).
16. Add failure-path specs for every changed form or flow. Mock the API with `page.route`, seed storage with `addInitScript`, read expected strings from the locale JSON files, and assert no page errors (QA-060). Cover:
    - Slow or failed submit: exactly one outgoing mutation, a disabled submit button, a live-region announcement, focus moved to the error (e.g. `role=alert`), a working retry, and draft data left unchanged.
    - Storage errors: `setItem` throwing `QuotaExceededError`, and storage access denied.
    - Missing capability: stub `getContext('webgl')` to return `null`, expect a fallback message and no page errors (QA-062).
    - Dialogs: the focus trap holds, Escape closes the dialog, and focus is restored.
17. Run authenticated journeys against real services only through the gated runner (QA-063). Never auto-retry an uncertain mutation (QA-064).
18. Scroll to the top, finish animations, then take full-page screenshots. Open them, look at them, fix what you find and rerun (QA-055).

### D. Report
19. For each check, state its boundary: pane against the real local backend, Playwright with a mocked API, or the gated real-service run. Mocked runs prove nothing about backend health or auth (QA-076). Report counts faithfully, with gated suites listed separately (QA-075). Next to each acceptance item you exercised, put its evidence in parentheses (what the pane showed, or which spec covers it) (QA-072).
20. Write the `UNVERIFIED` list. Each item gives what was not checked, why, who must walk it in a real browser, and what covers it meanwhile (WM-031). List the remaining gaps too: other browsers, physical devices, screen readers, slow networks (QA-077). Append the run to `<VERIFICATION_LEDGER>` (QA-105).

## Rules
- MUST check every UI change at desktop and phone widths in every supported locale, with 0 horizontal overflow and 0 page errors in `window.__errs` (QA-051).
- MUST base the verdict on DOM and JS measurements. Screenshots are supporting evidence, never the overflow check (ENV-048).
- MUST find the root cause before fixing a UI symptom (QA-046). Pane artifacts are not app bugs unless the app's own flow depends on them (ENV-042).
- MUST label every result with its boundary and how it was established (QA-076, WM-032).
- MUST load fixtures only in an isolated browser context, never over the user's own local data (ENV-060).
- MUST NOT kill a process you have not confirmed belongs to this project (ENV-033, ENV-041).
- MUST NOT read secrets from `.env`, use production credentials, or edit `.env` files (ENV-007).
- MUST NOT diagnose close, scroll or exit-animation bugs from the pane alone: dialogs with exit animations stay mounted there after closing. Re-check them by eye in a real browser (ENV-047).
- MUST NOT present a canvas `toDataURL` smoke check as visual QA (ENV-045).
- MUST NOT silently download a missing browser engine; record it as a gap instead (QA-077).
- MUST NOT report first-compile latency or a failure seen during a hot reload as a finding (ENV-036, ENV-037).

## Done checklist
- [ ] Servers up, boot marker seen, health check 200, locale redirect OK.
- [ ] Every changed screen measured at 1280, 375 and 320 px plus one width between 640 and 1100, in every locale: overflow 0, controls inside their parents.
- [ ] `window.__errs` is empty after each changed flow.
- [ ] Each interaction checked by reading the DOM in a separate call.
- [ ] Accessibility minimum met: labels, visible focus, Esc and overlay close dialogs (QA-065).
- [ ] If copy changed, the locale files still parse and the parity check passes (QA-066, QA-067).
- [ ] Playwright green with `--workers=1` on desktop and phone in every locale, with failure-path specs for the changed forms.
- [ ] Fresh full-page screenshots inspected, and the issues found were fixed and rerun.
- [ ] Report written with the boundary of each check, the counts, the `UNVERIFIED` list and the gaps; ledger appended.

## Pitfalls
- An overlay that is offset or blank only in the pane is usually a frozen first keyframe. A real cause to rule out: an ancestor with a permanent `transform` or `filter` (e.g. left by an animation `fill-mode`) becomes the containing block for `position: fixed`. Portal the overlay to `body` (QA-046).
- After you clear size emulation, `innerWidth` can read 0 and the page switches to its mobile layout (ENV-048).
- React Fast Refresh reruns mount effects and can create phantom server records (ENV-038).
- Changed copy breaks Playwright selectors that match literal labels, so update them in the same commit (QA-067).
- Pane behaviour changes between versions, so re-verify the ENV-042…ENV-057 gotchas on a newer version before relying on them.
