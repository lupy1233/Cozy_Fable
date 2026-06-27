<!-- Product Bible Master v6 — Seed scenarios pentru demo (Sprint 9). Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 7. Seed scenarios (Sprint 9)

Parole demo identice: Demo1234!

## 7.1 Useri și firme

- Admin: admin@demo.ro (ADMIN, 2FA off).

- 5 clienți: ana.popescu (București, 2 cereri: PUBLISHED + ACCEPTED-execuție); mihai.ionescu (Cluj, COMPLETED review 5★); elena.dumitru (Timișoara, CLAIMED_FULL cu 3 oferte în comparație); radu.stanescu (Iași, EXPIRED + 1 repost); ioana.marinescu (Brașov, doar draft anonim recuperat).

- 8 firme: A Mobila Premium (APPROVED Gold, 12 credite, 2 claim-uri, rating 4.8/5 reviews); B DesignWood (APPROVED Platinum, 25 credite, 0 penalizări, firma „model”); C CasaMea (APPROVED Silver, 3 credite, 3 puncte pe un employee); D Atelier Bucov (PENDING_VERIFICATION); E Lemn & Stil (PENDING cu risk flags: rating 3.2, 8 reviews, lipsă portofoliu); F FastFurniture (REJECTED acum 30 zile, mai are 2 luni blocaj); G MobMaster (APPROVED dar SUSPENDED, 12 puncte, 6 luni); H VintageHaus (APPROVED Gold, abonament expirat acum 1 lună, 8 credite valabile încă 2 luni).

- Toate locațiile firmelor seed au coverage_radius_km = 50 (default), cu excepția Firmei B (100 km, pentru demo de acoperire extinsă).

- Echipe: Firma A (owner Andrei, manager Bogdan, 2 trusted Cristina/Dan, 1 managed Elena); Firma B (owner Florin, manager Gina, 3 trusted); restul doar owner.

## 7.2 Cereri (15) și acoperire

- Statusuri: 1 DRAFT anonim, 3 PUBLISHED, 2 CLAIMED_PARTIAL, 2 CLAIMED_FULL, 1 OFFERS_RECEIVED, 1 NEGOTIATION (change_request pending), 2 ACCEPTED (1 IN_EXECUTION + 1 DELIVERED_BY_COMPANY), 1 COMPLETED review 5★, 1 COMPLETED review 2★ → DISPUTED, 1 EXPIRED (repost permis).

- Tipuri: 5 bucătării, 3 dressing, 2 living, 2 birou, 2 dormitor, 1 baie; + 2 proiectare contra cost (includes_paid_design=TRUE, cu design_fee pe ofertele aferente).

- Cel puțin o ofertă seed în EUR (pentru demo de dublă afișare RON/EUR).

- Maparea exactă tip ↔ status e la latitudinea agentului (păstrând entitățile și statusurile de mai sus).

## 7.3 Audit & calendar

- Minimum 50 entries audit log + 30 notificări in-app pentru istoric realist.

- business_calendar_holidays seed RO 2025–2028 (Paște Ortodox calculat/hardcodat); adminul poate adăuga.
