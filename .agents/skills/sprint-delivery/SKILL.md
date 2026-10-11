---
name: sprint-delivery
description: Use this skill whenever implementing, planning, or closing a sprint for the marketplace-mobilier project, or when the user says "sprint", "implementeaza sprintul", or asks for sprint deliverables. Enforces the output contract and acceptance flow from the Product Bible.
---

# Sprint delivery — output contract

Inainte de implementare:
1. Declara sprintul, modulele si tabelele afectate.
2. Listeaza presupunerile. Daca una schimba produsul sau o invarianta → STOP, cere confirmare.
3. Citeste DOAR sectiunile relevante: docs/02 (mereu), plus subsectiunile din docs/03 si docs/04 care ating sprintul. Nu citi tot Bible-ul.

Livrabilul de cod include, in ordine:
1. Obiectivul sprintului. 2. Impact: backend/frontend/DB/realtime/securitate/audit. 3. Fisiere cu path-uri. 4. Cod complet runabil fara ghicit. 5. Prisma schema/migration daca datele sunt afectate. 6. DTO-uri/guards/services/controllers (backend). 7. Componente/hooks/queries/Zod (frontend). 8. Test plan manual concret. 9. Checklist de acceptare verificabil. 10. DECIZIE NECESARA pentru lipsuri critice. 11. Update CHANGELOG.md.

Stil: concis, fara preambul si fara rezumate redundante. La final propune comanda de commit (checkpoint Git per sprint).
