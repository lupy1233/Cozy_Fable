# Frontend (Next.js 14 App Router) — reguli locale

Inainte de a scrie cod aici, citeste invarianta 3.6 din `docs/02-technical-invariants.md` si STATE_CONVENTIONS.md (dupa Sprint 0).

- Server state: EXCLUSIV TanStack Query v5 (requests, quotes, messages, notifications). Single source of truth.
- Zustand: DOAR UI state pur (modale, sidebar, filtre UI, theme, draft local pre-submit). NICIODATA date din API. Daca pare nevoie sa duplici server state in Zustand → opreste-te si cere clarificare.
- Formulare: React Hook Form + Zod (schemele comune vin din packages/shared).
- Optimistic updates: TanStack mutate onMutate/onError, nu Zustand.
- Auth: httpOnly cookies; NICIODATA JWT in localStorage. Socket.IO cu acelasi cookie; la auth_expired → refresh + reconectare.
- i18n: next-intl, string-uri key-based, ro.json + en.json populate ambele. Erorile API se mapeaza pe cod, nu pe message.
- UI: Tailwind + shadcn/ui, responsive, limba RO cu diacritice in texte.
