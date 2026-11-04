---
name: ui-component
description: Use this skill when creating or modifying React components, pages, forms, hooks, or TanStack queries/mutations in apps/frontend for the marketplace-mobilier project.
---

# UI components — reguli

- Componente shadcn/ui + Tailwind; client components doar unde e nevoie de interactivitate; restul server components.
- Formulare: React Hook Form + zodResolver; schema Zod vine din packages/shared (aceeasi ca DTO-ul backend). Nu duplica scheme.
- Date din API: EXCLUSIV TanStack Query v5. Hook per resursa in features/<domeniu>/api/ (ex: useClaimRequest). Query keys: array structurat ['requests', id, 'quotes'].
- Mutatii critice (claim, accept): genereaza Idempotency-Key (UUID v4) per apasare de buton; buton disabled cat e pending; optimistic update cu onMutate/onError rollback.
- Erori API: mapeaza error.code pe mesaj localizat din next-intl; message din raspuns doar ca fallback. Niciun text hardcodat: orice string vizibil = cheie next-intl, populata in ro.json SI en.json in acelasi PR.
- Zustand doar UI pur (modale, filtre vizuale, theme, draft pre-submit). Daca simti nevoia sa pui date din API in Zustand → opreste-te si cere clarificare.
- Realtime: hook-urile de socket invalideaza query-urile TanStack la evenimente (message.created, quote.updated etc.), nu tin propriul state de date.
- Accesibilitate minima: label-uri pe inputuri, focus states, dialoguri shadcn cu esc/overlay close.
