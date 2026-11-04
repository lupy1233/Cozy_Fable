# Feedback PO runda 6 — 2026-07-15 (sprinturi W1–W5, partea de firme)

Cerintele PO: atribuirea claim-ului unui angajat direct din UI, rearanjarea paginii
post-claim (/design), snapshotul 3D vizibil firmelor, numele + contactul clientului
dupa claim, pagina separata de mesagerie, chat intern de firma, criptarea mesajelor.

## W1 — Context post-claim complet (backend)

`GET /quotes/by-claim/:id` (ClaimQuoteContextDto) intoarce acum TOT ce are nevoie
fisa de lucru dintr-un singur apel:
- `detail`: descriere, buget (bucket + suma aleasa), termen dorit, adresa COMPLETA
  (doar cat timp slotul e ocupant), camerele cu answers (spec-carduri + viewer 3D),
  atasamentele cu URL-uri presigned (schite + snapshotul PNG al pieselor 3D),
  pozele de inspiratie;
- `client`: numele + caile de contact (email/telefon) alese in cerere — DOAR cat
  timp claim-ul e ocupant (ACTIVE/OFFER_SENT/COMPLETED); anulat/retras → null;
- `assignment`: cine a preluat, cine lucreaza, termenul de auto-anulare (1h).

`MarketplaceDetailDto` primeste `attachments` (pre-claim): schitele si snapshotul
3D sunt continut de proiect care ajuta decizia de claim — NU date de contact (4.2).

**Decizie (inlocuieste gatingul granular 4.2 cu 5 optiuni):** contactele furnizate
de client in cerere devin vizibile firmelor cu claim ocupant. Modelul curent al
configuratorului nu mai are optiunile 1–5 din D-v6-1; emailul contului e garantat
ca prim contact (r5). PO a cerut explicit vizibilitatea post-claim.

## W2 — Fisa de lucru a claim-ului (redesign /design) + atribuire

`marketplace/claims/[claimSlotId]` rescrisa ca „fisa de atelier":
- **Bara de lucru** (3 celule): ATRIBUIRE — select cu membrii firmei (owner/manager;
  angajatii vad doar numele), avertisment chihlimbar + termenul de auto-anulare cand
  e neatribuit; SLA — termenul + relativ + pauza; BUGET — suma/bucket + termen dorit.
- **Dreapta (pe mobil primele):** cardul clientului (monogram, nume, mailto/tel,
  adresa cu pin), oferta (builder/card + livrare), chatul cererii, panoul de
  clarificari/retragere.
- **Stanga:** mesajul clientului + etichete, camerele (RoomSpecCard cu snapshot 3D
  + viewer read-only — acum primesc atasamentele), fisierele generale (nereferite
  de camere), inspiratia.
- Dupa „Revendica" ajungi DIRECT in fisa de lucru (inainte: portofel).
- Atribuirea foloseste POST /claims/:id/assign existent (4.9: 1-claim-activ,
  penalizari, doar owner/manager) cu erorile mapate in UI.

## W3 — Mesagerie firma (`/marketplace/messages`)

Master-detail: lista conversatiilor (titlu cerere, preview ultimul mesaj cu
Client/Noi, necitite, doar-citire) + conversatia aleasa cu link spre fisa de lucru.
Pe mobil, lista si conversatia sunt ecrane succesive. Link nou „Mesaje" in nav-ul
firmei; notificarile de mesaj duc acum aici (inainte: lista de claims).

## W4 — Chat intern de firma (tab „Echipa firmei")

- **Migrare** `20260713170000_chat_team_threads`: `chat_threads.thread_type`
  (enum `chat_thread_type`: CLAIM/TEAM, default CLAIM), `claim_slot_id` devine
  nullable, `company_id` nou (nullable, UNIQUE — un singur thread de echipa per
  firma, FK cascade). Mesajele/citirile/upload-urile refolosesc `messages`,
  `chat_thread_reads` si fluxul presigned existent.
- `GET /company/chat/team` — intoarce threadul TEAM (upsert la prima accesare);
  mesajele merg pe rutele `threads/:id` existente, autorizarea generalizata:
  TEAM = doar membrii firmei (client → 403, alta firma → 403, verificat).
- Realtime: `message.created` tintit DOAR catre membri; emailul de „mesaj nou"
  NU pleaca pentru mesajele de echipa (nu exista client); notificarile in-app
  merg la ceilalti membri.
- FE: tab „Echipa firmei" in mesagerie, cu punct de necitite si acelasi ChatPanel.

## W5 — Criptarea mesajelor: at-rest, NU end-to-end (decizie argumentata)

**Ce am implementat:** TOATE corpurile de mesaje (client↔firma si echipa) se
stocheaza criptate AES-256-GCM (`MessageCryptoService`), format
`enc.v1.<iv>.<ciphertext+tag>`, cheia in env (`MESSAGE_ENCRYPTION_KEY`, 32 bytes
hex, validata la boot). Dual-read: mesajele istorice in clar raman citibile fara
backfill. Fara cheie (dev) → clar + warning la boot. Verificat: DB contine
`enc.v1.…`, API-ul intoarce clarul, teste unit 7/7.

**De ce NU end-to-end (PO a delegat: „daca consideri ok"):** e2e real inseamna
chei DOAR pe device-urile utilizatorilor, deci:
1. regula 4.18 (adminul intra in chat la DISPUTE) devine imposibila — platforma
   nu ar mai putea arbitra conflicte client-firma, functie de baza a produsului;
2. conversatiile s-ar pierde la schimbarea telefonului/browserului (nu exista
   infrastructura de key-backup, iar utilizatorii nu sunt tehnici);
3. chatul de echipa ruleaza tot pe serverul nostru — e2e ar proteja doar
   impotriva NOASTRA, celelalte riscuri (device compromis, phishing) raman.
Criptarea at-rest + TLS acopera riscurile reale ale MVP-ului (dump de baza de
date, backup furat) fara sa rupa dispute-urile. Daca PO vrea totusi e2e pe chatul
intern, e o discutie separata (protocol de chei, multi-device, recovery).

## Impact tehnic

- Backend: quotes (context extins), marketplace (+attachments, +UploadsModule),
  chat (threaduri TEAM + criptare + `MessageCryptoService`), config.schema
  (+MESSAGE_ENCRYPTION_KEY), migrare Prisma noua.
- Frontend: fisa de lucru rescrisa, pagina noua `/marketplace/messages`, nav +
  notificari, hooks (`useTeamThread`, `useAssignClaim` invalidare quotes),
  `marketplace/[id]` (atasamente + redirect post-claim), i18n RO+EN.
- Fara schimbari la invariante; datele de contact raman gate-uite la nivel API
  (post-claim, slot ocupant).

## Test plan manual

1. Firma (owner/manager): Marketplace → Revendica → aterizezi in fisa de lucru;
   selectul „Lucrează" atribuie unui membru; ca angajat vezi doar numele.
2. Fisa de lucru arata: clientul (nume + email/telefon clicabile + adresa),
   mesajul, camerele cu snapshot 3D (cerere cu piesa 3D) + viewer, oferta, chat.
3. Retrage claim-ul → cardul clientului dispare („nu mai e vizibil").
4. „Mesaje" in nav → lista conversatiilor cu preview/necitite; tab „Echipa firmei"
   → mesaj intern vizibil celorlalti membri, INVIZIBIL clientului/altei firme.
5. In DB, `messages.body` incepe cu `enc.v1.`; in aplicatie mesajele apar normal;
   mesajele vechi (dinainte de criptare) raman citibile.
6. Notificare de mesaj (firma) → duce la /marketplace/messages.

## Checklist acceptare

- [ ] Dupa claim exista select de atribuire (owner/manager) si functioneaza cu
      regulile 4.9 (ocupat → eroare clara; blocat penalizari → eroare clara).
- [ ] Numele si contactele clientului apar DOAR dupa claim si dispar la retragere.
- [ ] Snapshotul PNG al pieselor 3D apare firmei (detaliu marketplace + fisa).
- [ ] Pagina Mesaje: conversatii cu clientii + tab echipa; echipa e izolata.
- [ ] Mesajele sunt criptate in DB (enc.v1) si lizibile in aplicatie.

## Pasi prod (dupa acord PO)

1. Seteaza `MESSAGE_ENCRYPTION_KEY` (openssl rand -hex 32) pe serviciul backend
   in Railway INAINTE de deploy (fara ea mesajele noi raman in clar).
2. `railway up --service backend` — migratia `chat_team_threads` se aplica la boot.
