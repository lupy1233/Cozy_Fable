# Sarcina `e5-auth` — problema 25 (`f3`): sesiuni

Citește secțiunea „## 25.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md` și §3 din contract. Hotărârea PO (f3-1, finală): până la 5 dispozitive pe cont; al șaselea îl scoate pe cel mai vechi. Asta schimbă invarianta §3.13 din `docs/02` și decizia Î12 din `docs/07` — documentele le aduce la zi coordonatorul; tu scrii în raport textul nou propus.

## Ce ai de făcut — server
1. `token.service.ts` `issueNewFamily`: sub aceeași blocare pe rândul utilizatorului (`FOR UPDATE`), numără sesiunile active (familii cu cel puțin un token nerevocat și neexpirat). Dacă sunt deja `MAX_ACTIVE_SESSIONS` (5), revocă cele mai vechi familii (după primul token al familiei) până rămân 4, apoi emite familia nouă. Întoarce lista `sid`-urilor revocate.
2. `auth_expired` doar către socketurile sesiunilor revocate: `emitAuthExpired(userId, sids?)` — fără `sids` = toate (comportamentul de azi, păstrat pentru schimbarea parolei, deconectarea de peste tot, blocarea contului de către admin); cu `sids` = doar socketurile al căror `data.accessPayload.sid` e în listă. Login-ul trimite doar familiile scoase. Verifică toți apelanții (`auth.service.ts`, `admin.service.ts`).
3. Testele care fixau „o singură sesiune” (`token.service.integration.spec.ts`, `auth.service.spec.ts`, `access-session.spec.ts`, `events.gateway.spec.ts`) se aduc la zi: a 6-a autentificare revocă doar cea mai veche; două autentificări în paralel nu depășesc 5 sesiuni active; rotația și detecția de reutilizare rămân neschimbate (reutilizarea revocă doar familia ei).

## Ce ai de făcut — interfață
4. `lib/api.ts`: când reîmprospătarea sesiunii eșuează, se emite o singură dată un semnal global „sesiune pierdută” (chiar cu mai multe cereri simultane), iar eroarea se aruncă mai departe ca azi. Un modul mic nou (de ex. `lib/session-lost.ts`).
5. Un ascultător global (montat din `lib/providers.tsx`): golește datele contului din cache și duce omul la `/login?redirect=<pagina curentă>&reason=expired`, folosind funcția sigură de redirect existentă (`lib/safe-redirect.ts`). Doar de pe paginile care cer cont: fără redirect de pe paginile publice (prima pagină, inspirație, firme, pagini legale etc. — acolo doar se golește starea de cont), fără buclă pe paginile de autentificare, și doar dacă omul chiar avea o sesiune (un vizitator fără cont nu e trimis la login). Găsește în cod cum se deosebesc azi paginile cu cont de cele publice și refolosește acel mecanism.
6. `hooks/use-socket.ts`, ramura `auth_expired`: după reîmprospătarea eșuată apelează același semnal, ca deconectarea de pe alt dispozitiv să fie anunțată pe loc.
7. Pagina de login: cu `reason=expired` arată „Te-ai autentificat pe alt dispozitiv sau sesiunea a expirat. Intră din nou.” (RO / EN, fragment i18n `e5-auth`); după autentificare omul se întoarce la pagina de unde a plecat.
8. `marketplace/[id]/page.tsx` și `marketplace/claims/page.tsx`: 401 nu se mai arată ca „Nicio cerere disponibilă” / listă goală (stare de încărcare; ascultătorul global face restul). Paginile `requests/[id]/page.tsx` și `marketplace/claims/[claimSlotId]/page.tsx` sunt ale agentului `e5-exec-fe` — nu le atinge.

## Teste
- Unit `api.ts`: reîmprospătare eșuată → semnalul se emite o singură dată cu mai multe cereri simultane.
- Componentă: la semnal, de pe o pagină cu cont → `router.replace('/login?redirect=…&reason=expired')`; de pe o pagină publică și de pe `/login` → fără redirect.
- Backend: cele de la punctul 3. Testul de integrare îl scrii / îl aduci la zi, dar NU îl rula (Postgres e oprit acum; îl rulează coordonatorul).

## Reguli stricte
- Securitate: nu slăbi verificarea sesiunii (`assertActiveSession`), rotația tokenurilor sau detecția de reutilizare. O sesiune revocată nu mai trebuie să poată face nimic (REST și socket).
- `use-socket.ts` e al tău, dar alți doi agenți adaugă în el înregistrarea câte unui eveniment (`execution.stage_updated`, `request.no_coverage`): nu rescrie fișierul cu Write, editează punctual și recitește înainte de fiecare Edit.
- Nu e nevoie de migrare (o sesiune = o familie de tokenuri, există deja). Dacă ți se pare că e nevoie, oprește-te și scrie la „DECIZIE NECESARĂ”.

## Fișierele tale
Cele din tabelul contractului (rândul `e5-auth`) + `apps/backend/src/modules/admin/admin.service.ts` doar pentru apelul `emitAuthExpired` (Edit punctual).
