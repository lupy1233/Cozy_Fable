---
name: seed-scenarios
description: Use this skill when writing or modifying seed scripts, demo data, fixtures, or anything in Sprint 9 demo polish for the marketplace-mobilier project.
---

# Seed scenarios — reguli

Sursa: docs/06-seed-scenarios.md. Entitatile numite sunt OBLIGATORII si nu se inventeaza variatii:
- admin@demo.ro + 5 clienti numiti + 8 firme A–H exact in starile descrise (plan, credite, penalizari, statusuri) + echipele firmelor A si B.
- 15 cereri cu distributia exacta de statusuri (1 DRAFT anonim … 1 EXPIRED) si acoperirea de tipuri (5 bucatarii, 3 dressing, 2 living, 2 birou, 2 dormitor, 1 baie, 2 cu proiectare contra cost). Maparea tip↔status e libera, totalurile NU.
- Parola unica demo: Demo1234!.
- Minimum 50 audit entries + 30 notificari in-app; business_calendar_holidays RO 2025–2028 cu Paste Ortodox.

Reguli tehnice:
- Seed idempotent: rulabil repetat fara duplicate (upsert pe chei naturale: email, CUI).
- Datele deriva prin services reale unde e fezabil (claim prin ClaimsService) ca sa respecte invariantele; fallback la insert direct doar pentru istoric (audit/notificari) cu timestamps realiste in trecut.
- lat/lng hardcodate pentru orasele seed (fara apel Nominatim la seed).
- Fiecare scenariu numit = un script de test live pentru demo; nu sterge/redenumi firme sau clienti fara update in docs/06.
