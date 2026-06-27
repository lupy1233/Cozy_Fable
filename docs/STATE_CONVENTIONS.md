# STATE_CONVENTIONS — frontend state boundaries (invarianta 3.6)

Reguli absolute:
- **TanStack Query v5** = orice date care vin din API. Single source of truth pentru server state.
- **Zustand** = DOAR UI state pur: modale, sidebar, draft local pre-submit, filtre UI, theme. NICIODATA date din API.
- **React Hook Form** = doar state-ul formularului in completare.
- **Optimistic updates** = exclusiv prin TanStack `mutate` (onMutate/onError/onSettled). Niciodata prin Zustand.
- Daca apare nevoia de a duplica server state in Zustand → STOP, cere clarificare.

## Exemplul 1 — Creare cerere (wizard multi-step)
- RHF: campurile pasului curent (title, rooms, items).
- Zustand: pasul curent al wizardului, draft local pre-submit (persist in localStorage pentru draft anonim + token).
- TanStack: `useMutation(createDraft)` / `useMutation(publishRequest)`; dupa submit, draftul local se goleste — serverul devine sursa.

## Exemplul 2 — Claim din marketplace
- TanStack: `useQuery(['marketplace','requests',filters])` pentru lista; `useMutation(claimRequest)` cu Idempotency-Key generat in `onMutate`.
- Optimistic: `onMutate` decrementeaza vizual sloturile ramase in cache (`setQueryData`); `onError` face rollback la snapshot; `onSettled` invalidateaza query-ul.
- Zustand: doar filtrele UI (judet, marime, sortare) si starea modalului de confirmare claim.

## Exemplul 3 — Oferta (creare/versiuni)
- RHF + Zod (schema din packages/shared): price, delivery, warranty, description, design_fee.
- TanStack: `useQuery(['quote',id])` pentru versiuni; `useMutation(createVersion)` invalidateaza `['quote',id]` si `['thread',threadId]`.
- Zustand: nimic (formularul e RHF, datele sunt server state). Permisiunile pe campuri (matrice) vin din API → TanStack, aplicate ca `disabled` in form.

## Exemplul 4 — Chat realtime
- TanStack: `useInfiniteQuery(['thread',id,'messages'])` pentru istoric.
- Socket.IO: la `message.created` → `queryClient.setQueryData` append in cache (nu store separat).
- Optimistic send: `onMutate` adauga mesajul cu status `sending`; `onError` il marcheaza failed cu retry.
- Zustand: starea UI a composer-ului (attachment picker deschis), NU lista de mesaje.

## Exemplul 5 — Dashboard firma
- TanStack: query-uri paralele `['claims','active']`, `['wallet']`, `['notifications']` cu `staleTime` diferentiat; evenimentele socket (`claim.created`, `sla.expiring_soon`) fac `invalidateQueries` tintit.
- Zustand: sidebar collapsed, tab activ, theme.
- Niciun KPI/numar din API nu se copiaza in Zustand — badge-urile citesc direct din query cache.
