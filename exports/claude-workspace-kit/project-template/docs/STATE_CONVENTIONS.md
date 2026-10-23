<!-- Source of truth: frontend state boundaries (implements INV-6). Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# STATE_CONVENTIONS — frontend state boundaries (INV-6)

> **Template.** Produced in Sprint 0 (DEL-003) with five worked examples taken from the product's most important flows. Example 1 is a generic pattern you can keep; replace the slots 2–5 with your own flows. Touch this doc again only when caching, query keys or optimistic-update behaviour change (SOT-044). Delete the italic guidance once filled.

Absolute rules:
- **TanStack Query v5** = all data that comes from the API. Single source of truth for server state.
- **Zustand** = ONLY pure UI state: modals, sidebar, local pre-submit drafts, UI filters, theme. NEVER API data.
- **React Hook Form** = only the state of the form being filled in.
- **Optimistic updates** = only through TanStack `mutate` (`onMutate` / `onError` / `onSettled`), never through Zustand. For a set users can toggle quickly, roll back with the inverse operation on the affected item, not by restoring a snapshot (ENG-125).
- **Realtime** = one Socket.IO client singleton whose handlers only invalidate (or append to) TanStack query families; it never holds data (ENG-126).
- **Critical mutations** = sent through the idempotent runner with an `Idempotency-Key` kept per intent (INV-2).
- **Destructive client reconciliation** (pruning references to deleted server data) runs only against a list query that is `isSuccess` and not `isFetching` (ENG-129).
- If server state ever seems to need duplicating into Zustand → STOP and ask.

## Query keys

*One row per query family. Every mutation and socket event that can change the data is listed under "Invalidated by".*

| **Query family** | **Key** | **staleTime** | **Invalidated by** (mutations / socket events) |
| --- | --- | --- | --- |
| | | | |

## Example 1 — Multi-step creation wizard (generic)
- RHF: the fields of the current step only.
- Zustand: the current step and the local pre-submit draft (persisted locally with its server draft token, versioned format — INV-17).
- TanStack: `useMutation(createDraft)` / `useMutation(patchDraft)` / `useMutation(submit)`; after submit the local draft is cleared and the server becomes the source.
- If the stored draft token returns 404, drop it, create a new server draft, push local progress to it, and ask whether to continue or start over (ENG-128).

## Example 2 — <Capacity-limited action>
*Suggested content: list query, mutation with `Idempotency-Key`, optimistic decrement of remaining capacity in the cache with rollback in `onError`, invalidation in `onSettled`; Zustand holds only the filters and the confirmation-dialog state.*

## Example 3 — <Versioned document or form editing>
*Suggested content: RHF + Zod schema from `<SHARED_PKG>`; versions read through `useQuery`; the create-version mutation invalidates the document and any related thread; permissions come from the API and are applied as `disabled` in the form; Zustand holds nothing.*

## Example 4 — <Realtime feed or messaging>
*Suggested content: `useInfiniteQuery` for history; on the "created" socket event append to the cache (no separate store); optimistic send with a `sending` status and retry on failure; Zustand holds only composer UI state.*

## Example 5 — <Dashboard>
*Suggested content: parallel queries with differentiated `staleTime`; targeted `invalidateQueries` on socket events; Zustand holds sidebar, active tab, theme; no KPI or count from the API is ever copied into Zustand — badges read straight from the query cache.*
