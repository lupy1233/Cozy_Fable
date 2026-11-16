# Sarcina `e5-area` — problema 26 (`a6`): clientul fără nicio firmă în zonă

Citește secțiunea „## 26.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md` și §4 din contract. Hotărârile PO (finale): a6-1 doar avertisment când nu e nicio firmă (niciodată numărul de firme); a6-2 publicarea trece, cu avertisment, iar echipa Cozy Home e anunțată.

## Ce ai de făcut — server
1. O interogare care spune dacă există cel puțin o „firmă care acoperă” punctul aproximat al cererii (definiția din contract §4): aceeași formulă de distanță și aceeași grilă de rotunjire ca piața (`marketplace.service.ts`), aceleași condiții de aprobare și de abonament pe care le verifică azi gărzile `CompanyApprovedGuard` și `SubscriptionActiveGuard` (citește-le și exprimă-le în interogare; nu inventa alte condiții), fără excluderi și fără întârzierea pe plan. Întoarce doar da / nu (nu număr).
2. `GET requests/:id/visibility`: `RequestVisibilityDto.coverage: 'COVERED' | 'NONE' | 'UNKNOWN'` (în `packages/shared/src/request.schemas.ts`, fișier comun — Edit punctual). Are sens doar cât cererea e în piață; pentru cererile fără coordonate → `UNKNOWN`.
3. `POST requests/drafts/:token/coverage` → `{ coverage }`, pentru Sumar: primește adresa ciornei în aceeași formă în care o primește publicarea, o geocodează pe server (`geo.geocode`, ca la publicare) și răspunde. Aceleași verificări de acces ca celelalte rute de ciornă; cu limită de apeluri (folosește mecanismul de limitare existent în proiect); dacă geocodarea eșuează → `UNKNOWN` (nu eroare).
4. La publicarea unei cereri cu `coverage = 'NONE'`: eveniment prin outbox `request.no_coverage` către administratori (clopoțel + e-mail), în aceeași tranzacție cu publicarea. Model: `createReview` din `fulfillment.service.ts` (ia adminii și cheamă `outbox.record(...)` cu destinatari) + `EMAILED_EVENTS` / `recipientsFor` din `notification-emails.service.ts` (fișier comun — Edit punctual). E-mailul spune orașul / județul cererii și are legătură spre cererea din Admin. Publicarea NU se oprește și nu se schimbă altfel.

## Ce ai de făcut — interfață
5. Cardul „Cine vede cererea” (`request-visibility-card.tsx`): la `coverage = 'NONE'`, în locul textului „Cererea e vizibilă firmelor verificate din zona ta…” apare un avertisment cinstit: momentan nu avem firme partenere care lucrează în zona ta; echipa Cozy Home a fost anunțată și caută o firmă; cererea rămâne publicată. Fără niciun număr de firme.
6. Sumar (`review-step.tsx`, alimentat din `configurator-wizard.tsx`): când adresa e completată, întreabă `POST …/coverage`; la `NONE` arată același avertisment înainte de „Publică cererea” (publicarea rămâne posibilă). La `UNKNOWN` sau la eroare nu arată nimic.
7. Clopoțelul adminului: tipul `request.no_coverage` (iconiță, titlu, legătură spre cererea din Admin) în `notification-bell.tsx` și înregistrarea în `hooks/use-socket.ts` — fișiere comune, doar Edit punctual de adăugare.
8. Texte RO / EN (fragment i18n `e5-area`). Se spune „firmă”, niciodată „atelier”.

## Teste
- Integrare (`*.integration.spec.ts`; scrie-l, NU îl rula — Postgres e oprit acum, îl rulează coordonatorul): cerere în Cluj cu firme doar în București → `NONE`; în București → `COVERED`; firmă suspendată sau fără abonament activ nu se numără; locație cu rază care nu ajunge nu se numără.
- Unit: publicarea cu `NONE` scrie evenimentul către admini o singură dată; cu `COVERED` nu scrie nimic.
- Componentă: cardul și Sumarul arată avertismentul doar la `NONE`.

## Reguli stricte
- Nu dezvălui nimic despre firme clientului (nici număr, nici nume, nici distanțe).
- `requests.service.ts` e al tău, dar agentul `e5-size` adaugă în el un câmp pe camere (`approxLengthM`): editează punctual, recitește înainte de fiecare Edit, nu rescrie fișierul. La fel `review-step.tsx` (același agent poate adăuga un rând la rezumatul camerei).
- Pagina cererii (`requests/[id]/page.tsx`) e a agentului `e5-exec-fe`: avertismentul tău stă în cardul de vizibilitate, deci nu ai nevoie de ea.

## Fișierele tale
Cele din tabelul contractului (rândul `e5-area`).
