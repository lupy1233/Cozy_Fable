---
name: security-close
description: Use this skill at the end of every sprint, before commit, or when the user asks for a security review / hardening pass on the marketplace-mobilier project. Runs a closing checklist over the sprint's diff.
---

# Security close — checklist de sfarsit de sprint

Ruleaza peste diff-ul sprintului si raporteaza PASS/FAIL pe fiecare punct, cu fix imediat unde e FAIL:

1. Fiecare endpoint nou are: AuthGuard + RolesGuard corecte; CompanyApprovedGuard/SubscriptionActiveGuard unde e flux de firma; DTO cu class-validator (whitelist activ); rate limit throttler unde e sensibil (login 5/min, claim 10/min, upload 30/min).
2. Mutatii pe bani/claim/accept au Idempotency-Key suportat si testat.
3. @Audit pe fiecare mutatie critica noua; niciun camp sensibil (parole, token-uri, continut mesaje) in audit sau loguri.
4. Ownership checks: orice :id din ruta e verificat ca apartine firmei/clientului curent (nu doar ca exista).
5. Fisiere: doar presigned URLs, status SAFE inainte de servire, limitele respectate: 25MB/fisier, 7 schite/camera + cap dinamic per cerere `maxAttachmentsForRequest` (decizie PO 2026-07-13, docs/12 S4), 5/mesaj chat.
6. Secrets doar in .env + validate in config.schema.ts; niciun secret in cod sau in seed.
7. Raspunsuri de eroare folosesc formatul unic + cod din ERROR_CODES; fara stack traces sau detalii interne in productie.
8. Cookies httpOnly Secure SameSite=Lax; nimic auth in localStorage; CORS doar pe originul declarat.

Output: lista scurta PASS/FAIL + patch-uri pentru FAIL. Nu rescrie cod care trece.
