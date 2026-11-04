# Frontend (Next.js App Router) — local rules

Before writing code here, read the frontend-state section of `docs/02-technical-invariants.md` and `docs/STATE_CONVENTIONS.md` (written before the first feature). Stack detail lives in `docs/STACK-RULES.md`. Skills: `ui-component` (components, pages, forms, hooks, queries), `i18n-copy-change` (any user-visible string), `ui-browser-verify` (proving a UI change works).

## State boundaries (non-negotiable)
- Server state: ONLY TanStack Query (v5) — the single source of truth. One hook per resource, hierarchical keys (`['entity', id, 'sub']`). After a mutation, invalidate every query family whose data could change.
- Zustand: ONLY pure UI state (modals, sidebar, UI filters, theme, local pre-submit draft). NEVER API data. If server state seems to need duplicating into Zustand → stop and ask.
- Forms: React Hook Form + `zodResolver` with schemas from `<SHARED_PKG>`. Never a frontend-only copy of a shared schema.
- Optimistic updates only through TanStack: `onMutate` (cancel, snapshot, `setQueryData`), `onError` (roll back), `onSettled` (invalidate). Never through Zustand.
- Critical mutations send an `Idempotency-Key` (UUID v4) created once per user intent and reused on retry, never per `mutate()` call.
- Socket handlers only invalidate queries; they never hold data.

## Auth, errors, i18n, UI
- Auth: httpOnly cookies. NEVER a JWT in localStorage/sessionStorage. Socket.IO authenticates with the same cookie; on an auth-expired error → refresh the session, then reconnect.
- All HTTP goes through one `api<T>()` wrapper (`credentials: 'include'`) that parses the error envelope into `ApiError(code, status, message, details)`.
- Errors map to localized text by `code` (`apiErrors.<CODE>`), never by the server `message`. Every code has text in every locale.
- i18n: next-intl, key-based only; no hard-coded UI text in TSX. Each key goes into ALL locale files (`<LOCALES>`) in the same change, with identical key trees. The product owner's terminology glossary applies to every new string.
- UI: Tailwind + shadcn/ui, responsive down to phone width, labelled controls. Server components by default; client components only where interactive.
- Every query consumer renders loading, error and empty states. Submit buttons disable while pending; failures focus a `role="alert"` message and keep the draft.
- Backend guards are the real enforcement; client-side route protection is UX only.

## Gotchas
- Next 15+: `params` (and `cookies()`/`headers()`) are async, so always `await` them. Pages using `useSearchParams` need a Suspense boundary.
- next-intl keys must not contain dots (`INVALID_KEY` on every page). Import `Link`/`useRouter` from the routing module, not `next/link`.
- The `api()` wrapper returns `null` for empty bodies (204, `void` handlers); TanStack v5 rejects `undefined`, so normalize nullable results with `?? null`.
- `z.coerce.number()` turns `''` into `0`; use `z.preprocess` to map `''` → `undefined`.
- Backend `forbidNonWhitelisted` rejects extra fields (e.g. `id` in a PATCH body) with 400: strip them and always surface save errors.
- Per-call `mutate(vars, { onSuccess })` callbacks are dropped when the component unmounts (StrictMode remount); use `mutateAsync().then(...)` for must-run follow-ups.
- Rebuild `<SHARED_PKG>` before typecheck. Animated components need a `requestAnimationFrame` polyfill in tests.
- Windows: local `next build` can fail at the standalone symlink step; verify in Docker/CI. Never run two Next processes on the same `.next`.
- The embedded preview pane is a hidden document: rAF and CSS animations freeze, WebGL doesn't render, synthetic blur doesn't fire React `onBlur`. Verify those through JS/state, not screenshots.
- Locale JSON files may have fixed line endings (CRLF); keep what the index has.
