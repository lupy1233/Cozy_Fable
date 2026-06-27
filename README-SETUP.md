# Starter pack context — marketplace-mobilier

Copiaza continutul acestui pachet in radacina monorepo-ului tau. Ce contine si de ce:

- `CLAUDE.md` (radacina, ~450 tokeni) — contractul global, incarcat la fiecare sesiune. Scurt intentionat.
- `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md` — se incarca DOAR cand agentul lucreaza in acel director.
- `docs/01..07-*.md` — Product Bible v6 spart pe sectiuni. Agentul citeste per sprint doar ce ii trebuie (1-4k tokeni in loc de ~15k).
- `.claude/skills/` — sprint-delivery (output contract) si nestjs-module (conventii backend), incarcate la cerere.
- `.claudeignore` — exclude node_modules, lockfiles, client Prisma generat, .docx.

## Flux recomandat per sprint
1. Sesiune noua (`/clear`). 2. Mesaj: "Implementeaza Sprint N conform docs/05". 3. Review checklist de acceptare. 4. Commit (checkpoint). 5. `/clear` si urmatorul sprint.

Pastreaza si `docs/PRODUCT_BIBLE_MASTER_V6.docx` in repo ca referinta umana — dar nu-l atasa in chat; agentul foloseste fisierele .md.

## Primul mesaj (Sprint 0)
"Citeste CLAUDE.md, docs/01, docs/02, docs/04 si docs/05. Livreaza Sprint 0 conform FIRST_ACTION din docs/05: arhitectura monorepo, schema DB conceptuala, STATE_CONVENTIONS.md, ERROR_CODES.md, seed scoring + campuri formular propuse. Fara cod."
