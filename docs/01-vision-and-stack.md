<!-- Product Bible Master v6 — Viziune, actori, MVP, stack, monorepo. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 0. Instrucțiuni pentru agentul AI (citește întâi)

*Această secțiune definește CUM trebuie folosit documentul. Respect-o înainte de orice altceva.*

## 0.1 Statut și autoritate

- Acest document este SURSA UNICĂ DE ADEVĂR. Înlocuiește orice versiune anterioară (v3, v4, continuitate, v5, Document Master anterior).

- NU căuta context în alte fișiere, conversații sau documente. Tot ce ai nevoie e aici.

- NU inventa funcționalități, entități, reguli comerciale sau câmpuri. Orice lipsă critică se marchează explicit și te oprești (vezi 0.3).

## 0.2 Ierarhia regulilor la conflict

Când două reguli par să se contrazică, aplică această ordine de prioritate:

- INVARIANTE TEHNICE (Secțiunea 3) — cel mai mare nivel. Nu pot fi încălcate.

- DECISIONS LOG (Secțiunea 8) — deciziile sunt FINALE și au rationale.

- REGULI BUSINESS (Secțiunea 4).

- Preferințe de implementare / detalii lăsate la latitudinea ta.

**OPRIRE OBLIGATORIE: **Dacă o regulă business pare să intre în conflict cu o invariantă tehnică, OPREȘTE-TE și cere clarificare. Nu rezolva conflictul singur.

## 0.3 Reguli de comportament obligatorii

- **Nu ghici: **dacă o informație critică lipsește, marchează „DECIZIE NECESARĂ”, descrie opțiunile și OPREȘTE-TE.

- **Nu reintroduce reguli vechi: **dacă o decizie din Secțiunea 8 contrazice o regulă veche, decizia câștigă.

- **Respectă exact: **enum-urile, valorile, pragurile și numele de câmpuri din document se folosesc verbatim.

- **Înainte de fiecare sprint: **declară sprintul, modulele și tabelele afectate, și presupunerile. Dacă o presupunere schimbă produsul sau o invariantă, oprește-te și cere confirmare.

- **Niciun cod la primul răspuns: **primul răspuns este Sprint 0 (arhitectură + schema), revizuibil în 30 min.

## 0.4 Convenții de marcare

Începând cu v6, toate punctele [PROPUNERE v5] și [DECIZIE NECESARĂ] din versiunile anterioare au fost rezolvate și integrate ca reguli confirmate. Marcajele rămase în vigoare:

| **Marcaj** | **Semnificație** | **Ce faci** |
| --- | --- | --- |
| (text normal) | Regulă confirmată, obligatorie. | Implementezi ca atare. |
| DECIZIE NECESARĂ | Lipsă critică descoperită de tine la implementare. | NU procedezi. Ceri răspuns. |
| MUST / NEVER / ALWAYS | Limbaj normativ strict. | Fără excepții. |

## 0.5 Cum pornești

- Citește integral acest document o dată (Secțiunile 0–9).

- Folosește MASTER PROMPT (Secțiunea 6) ca prim mesaj operațional, cu acest document atașat.

- Livrează Sprint 0 conform <FIRST_ACTION>. Așteaptă revizuirea umană înainte de Sprint 1.

- Implementează pe sprinturi conform <IMPLEMENTATION_ORDER>, cu checklist de acceptare la fiecare.

## 0.6 Harta documentului

| **Secțiune** | **Conținut** |
| --- | --- |
| 0 | Instrucțiuni pentru agent (meta). |
| 1 | Viziune produs, actori, flux end-to-end, definiție MVP. |
| 2 | Stack tehnologic și strategie repo (fix). |
| 3 | Invariante tehnice (13) — non-negociabile. |
| 4 | Reguli business consolidate (toate deciziile integrate). |
| 5 | Model de date complet (entități, tabele, coloane, enum-uri, relații). |
| 6 | MASTER PROMPT — bloc copy-paste pentru chat-ul de implementare. |
| 7 | Seed scenarios pentru demo. |
| 8 | Decisions Log complet (10 tehnice + 6 business + 20 refinement + 14 finale v6). |
| 9 | Checklist uman: ce faci după ce primești acest document. |

# 1. Viziune produs și obiectiv

## 1.1 Ce construim

Un MVP tehnic demonstrabil (nelansat public, dar cu design modern și fluxuri end-to-end funcționale) pentru o platformă marketplace închisă unde clienții cer oferte de mobilier la comandă, iar firmele autorizate concurează pentru a le câștiga.

## 1.2 Actori

- **Client: **creează cereri structurate; poate începe ca draft anonim cu token.

- **Firmă: **entitate verificată cu echipă. Roluri membri: OWNER, MANAGER, EMPLOYEE_TRUSTED, EMPLOYEE_MANAGED.

- **Admin: **un singur rol ADMIN; gestionează firme, verificări, cereri, claim-uri, credite, abonamente, penalizări, dispute, audit, settings.

## 1.3 Fluxul end-to-end

- Clientul creează o cerere structurată; sistemul calculează automat mărimea proiectului (scoring).

- Cererea se publică în marketplace-ul închis, vizibilă firmelor eligibile (cu gating per plan).

- Maximum 3 firme pot da claim (tranzacțional, cu lock).

- După claim, firma intră în chat cu clientul (thread auto-creat).

- Firma trimite ofertă structurată în SLA; clientul poate cere modificări limitate (max 2 → max 3 versiuni).

- Clientul compară ofertele și acceptă una. Chat-urile firmelor nealese devin read-only imediat.

- După livrare confirmată de client → COMPLETED → review. Review sub 3 stele → DISPUTED automat.

- Adminul intervine în dispute și operațiuni administrative.

## 1.4 Definiția MVP și ce e mock

MVP-ul trebuie să arate și să funcționeze ca o aplicație reală. Integrările externe complexe pot fi mock, DAR modelul de date și arhitectura se proiectează astfel încât mock-urile să fie înlocuite ulterior fără refactor structural.

| **Componentă** | **Mock în MVP** | **Înlocuire ulterioară** |
| --- | --- | --- |
| Scanare fișiere | Job care marchează SAFE după 2s (BLOCKED dacă numele conține „malware”). | ClamAV / API extern. |
| Plată | Buton admin + webhook HMAC. | Stripe / Mollie / Netopia (schimbi endpoint-ul). |
| Facturare | PDF generat local. | API extern de facturare. |
| Email | Mailpit în Docker Compose. | SMTP real. |
| Google reviews | Semi-manual cu risk score. | API real. |
| Curs valutar | Fix 1 EUR = 5.2 RON, configurabil în Admin. | API curs. |

## 1.5 Inclus / exclus în MVP (CONFIRMAT)

**Inclus: **auth + roluri; onboarding & verificare firme; cereri client (draft anonim, formular generic, geocoding, upload mock); marketplace cu gating + filtre + claim; chat realtime; ofertare structurată cu versiuni + PDF; SLA + penalizări; livrare + review + dispute; abonamente + credite + facturare (mock); admin panel + audit + settings; seed demo.

**Exclus (mock sau post-MVP): **gateway de plată real, scanare AV reală, SMTP real, API Google reviews real, aplicații mobile native, analytics/BI avansat, white-label multi-tenant, video realtime. Lista este confirmată final (D-v6-3).

# 2. Stack tehnologic și strategie repo (fix — nu se schimbă)

- Backend: NestJS (latest stable). ORM: Prisma. DB: PostgreSQL 16+.

- Frontend: Next.js 14+ (App Router). UI: Tailwind CSS + shadcn/ui. Forms: React Hook Form + Zod.

- Server state: TanStack Query v5. UI/global state: Zustand. i18n: next-intl (RO + EN).

- Realtime: Socket.IO cu Redis adapter. Queues/jobs: BullMQ + Redis.

- Auth: access token + refresh token în httpOnly cookies (Secure, SameSite=Lax).

- API: REST sub /api/v1 pentru business; WebSocket doar pentru realtime.

- Storage: MinIO în Docker Compose (dev), S3-compatible în producție (@aws-sdk/client-s3).

- Email dev: Mailpit. PDF: pdfkit sau puppeteer (decide în Sprint 0 cu justificare).

## 2.1 Strategie repo: MONOREPO (D-v6-14, actualizează v4/v5)

**Decizie finală: **un singur monorepo cu structura apps/backend (NestJS) + apps/frontend (Next.js) + packages/shared (tipuri TS partajate, scheme Zod comune, constante de error codes). Tooling: pnpm workspaces (sau npm workspaces) + scripturi root pentru dev/build/test.

- Rationale: implementarea de către un agent AI e mult mai eficientă într-un singur workspace — migrații + tipuri partajate + testare end-to-end fără sincronizare între repo-uri.

- Separabil ulterior: structura apps/* permite extragerea în repo-uri separate fără refactor.

- Docker: docker-compose.yml în rădăcină (dev-infra) cu PostgreSQL, Redis, MinIO, Mailpit. Backend și frontend rulează local pentru hot-reload.

Naming: snake_case pentru DB, camelCase pentru TS, PascalCase pentru clase/componente. UI bilingv RO+EN; cod/tabele/endpoint-uri în engleză; comentarii în română fără diacritice, doar unde sunt utile.
