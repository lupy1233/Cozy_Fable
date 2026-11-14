# Sarcina `e5-exec-fe` — problema 22 (`e1`), interfața

Citește secțiunea „## 22.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md` și §1 din contract. Serverul îl scrie în paralel agentul `e5-exec-be`, după același contract: lucrezi după numele din contract; până apar tipurile în `packages/shared` poți folosi o extensie locală de tip, pe care o scoți la final dacă tipul din shared există (verifică înainte de raport).

## Ce ai de făcut
1. **Fișa firmei** (`marketplace/claims/[claimSlotId]/page.tsx`, `claim-completion-card.tsx`): când oferta firmei e cea acceptată, insigna de sus și blocul de termen arată starea proiectului — Acceptată / Livrată — așteaptă confirmarea clientului (cu data finalizării automate, `autoCompleteAt`) / Finalizată — nu „Ofertă trimisă” / „Oferta a fost trimisă”. Bloc „Ce urmează” pentru firmă, cu cele 4 etape de bifat (Măsurători, Contract, Producție, Montaj): bifă + data și cine a bifat; se pot debifa; nu blochează livrarea. Doar cine are voie le poate bifa (la eroare de permisiune, mesaj clar).
2. **„Marchează ca livrată”**: dialogul spune ce urmează (clientul confirmă sau proiectul se finalizează automat la data X). Înainte de `earliestDeliveryAt` butonul e dezactivat, cu explicația „Poți marca livrarea începând cu <data>” (și eroarea `DELIVERY_TOO_EARLY` de la server are text).
3. **Pagina clientului** (`requests/[id]/page.tsx`): „Expiră” apare doar cât cererea e `IN_MARKETPLACE`; după acceptare apare „Acceptată pe <data>”.
4. **Panoul „Ce urmează” al clientului** (`client-fulfillment.tsx`, alimentat din `requests/[id]/offers/page.tsx`): contactul persoanei responsabile (nume, e-mail ca legătură `mailto:`, telefon ca `tel:` dacă există), datele firmei (nume, CUI, adresă), etapele cu data bifării (doar de citit). Hook nou în `hooks/use-fulfillment.ts` pentru `GET requests/:id/fulfillment` (normalizează cu `?? null`).
5. **Timp real**: evenimentul `execution.stage_updated` reîmprospătează datele clientului — înregistrarea în `hooks/use-socket.ts` și în `notification-bell.tsx` (iconiță, titlu, legătură spre cerere) sunt fișiere comune: doar Edit punctual de adăugare.
6. **Admin**: intrarea setării `delivery_min_days_after_accept` în `admin/settings/_components/setting-catalog.ts` (fișier comun, Edit punctual) + textele ei (etichetă și explicație, RO / EN).
7. **401**: pe cele două pagini ale tale (`requests/[id]/page.tsx`, `claims/[claimSlotId]/page.tsx`), o eroare `ApiError` cu `status === 401` nu se mai afișează ca „nu există” / „eroare”, ci ca încărcare (ascultătorul global al agentului `e5-auth` duce omul la login). NU schimba redirecționările existente spre `/login`.
8. Texte RO / EN pentru tot ce e nou (fragment i18n `e5-exec-fe`); datele se formatează după limba aplicației (vezi ghidul §5, lecțiile etapei 1).

## Teste
- Componentă: fișa firmei în stările Acceptată / Livrată / Finalizată arată insigna și textul corecte (nu „Ofertă trimisă”).
- Componentă: butonul de livrare dezactivat înainte de `earliestDeliveryAt`, activ după; dialogul arată data finalizării automate.
- Componentă: panoul clientului arată contactul și etapele doar când DTO-ul le are; fără ofertă acceptată nu arată nimic din ele.
- Componentă: „Expiră” ascuns în afara `IN_MARKETPLACE`; „Acceptată pe” după acceptare.

## Fișierele tale
Cele din tabelul contractului (rândul `e5-exec-fe`). `packages/shared` și `apps/backend` NU sunt ale tale. Alți agenți lucrează în paralel pe `use-socket.ts` (`e5-auth`) și pe `request-visibility-card.tsx` (`e5-area`, cardul „Cine vede cererea” de pe pagina cererii) — nu le atinge în afara adăugării evenimentului tău.
