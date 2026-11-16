# Înainte de orice

Șapte hotărâri care țin de felul în care lucrăm, la care ai răspuns pe 13 noiembrie, și șase întrebări noi, născute din răspunsurile în care ai scris altceva decât variantele mele. Trei dintre cele noi opresc câte o problemă (16, 18 și 21); etapa 1 nu depinde de niciuna.

## Întrebări generale

- **[g0-1] De unde pornesc cu codul?**
  - Context: Redesignul care e acum pe producție stă într-o cerere de îmbinare deschisă (PR #20), cu 7 modificări peste ramura principală. Reparațiile trebuie să pornească de la ce e pe producție.
  - Variante: 1) Unești tu întâi PR #20, apoi lucrez pe câte o ramură pentru fiecare etapă · 2) Continui pe ramura redesignului
  - **Răspunsul PO:** Unești tu întâi PR #20, apoi lucrez pe câte o ramură pentru fiecare etapă (recomandarea). Ramura principală devine egală cu producția. Fiecare etapă e o cerere de îmbinare mică, ușor de verificat și de dat înapoi.
- **[g0-2] Cum ajunge fiecare etapă pe producție?**
  - Context: Până acum mi-ai cerut de fiecare dată, separat, să pun schimbările pe producție. Unele etape schimbă baza de date sau costul în credite; pe acelea le anunț dinainte oricum.
  - Variante: 1) Îți arăt ce s-a schimbat și lansez când spui tu, etapă cu etapă · 2) Lansez singur după fiecare etapă, când trec testele · 3) Strâng două-trei etape și le lansez împreună, când spui tu
  - **Răspunsul PO:** Îți arăt ce s-a schimbat și lansez când spui tu, etapă cu etapă (recomandarea). Rămâne ca până acum. Fiecare lansare așteaptă un „da” de la tine.
- **[g0-3] Cine verifică pe producție părțile care cer cont?**
  - Context: Eu nu scriu parole pe site-ul de producție. Pot verifica acolo doar ce vede un vizitator; restul îl verific local, cu aceleași conturi demo.
  - Variante: 1) Tu, după fiecare lansare, cu o listă scurtă de pași de la mine · 2) Te autentifici tu în panoul de browser și conduc eu verificarea · 3) Rămâne doar verificarea mea locală
  - **Răspunsul PO:** Tu, după fiecare lansare, cu o listă scurtă de pași de la mine (recomandarea). Cinci până la zece minute pe etapă. Știm sigur că merge și pe producție.
- **[g0-4] Mut problema 18 (editarea unei cereri publicate strică ciorna) înaintea problemelor 9, 10 și 11?**
  - Context: Toate patru lucrează pe aceeași memorie a ciornei din browser. Dacă repar întâi 9–11, o parte din muncă se reface când ajung la 18.
  - Variante: 1) Da, o fac prima în etapa 2 · 2) Nu, rămâne pe locul 18
  - **Răspunsul PO:** Da, o fac prima în etapa 2 (recomandarea). Memoria ciornei se desparte o singură dată de cea a editării; restul se construiesc peste ea.
- **[g0-5] Lipesc problema 29 (tabelul de comparare) de problema 19 (refuzul ofertei și variantele)?**
  - Context: Amândouă schimbă aceeași parte a ofertei în baza de date și același formular de ofertă al firmei.
  - Variante: 1) Da, le fac împreună în etapa 4 · 2) Nu, 29 rămâne la locul ei
  - **Răspunsul PO:** Da, le fac împreună în etapa 4 (recomandarea). O singură schimbare a bazei de date și un singur formular nou de ofertă pentru firme.
- **[g0-6] În câte runde schimb întrebările formularului?**
  - Context: Întrebările publicate sunt înghețate: orice schimbare de întrebări sau opțiuni cere o versiune nouă a formularului, iar cea veche rămâne pentru cererile deja publicate. Fiecare rundă costă cam 3 zile, oricât de puțin schimbă. Problemele care cer versiune nouă sunt pe locurile 4, 20, 24, 27, 28, 49, 50, 51 și 53.
  - Variante: 1) Două runde · 2) O singură rundă, în etapa 6 · 3) Strict în ordinea ta
  - **Răspunsul PO:** Două runde (recomandarea). Prima, în etapa 6: material, deschidere, ușile dulapului, blat, „decide firma”, mai puține ecrane (51 și 53 urcă lângă 27 și 28). A doua, în etapa 10: ce se măsoară și întrebările care lipsesc (49 și 50, la locul lor). Cam 6 zile cost fix.
- **[g0-7] Salvez planul și rapoartele auditului în proiect?**
  - Context: Rapoartele agenților și planul pe pași stau acum într-un folder temporar al sesiunii, care se poate șterge. Paginile publicate rămân oricum.
  - Variante: 1) Da, planul și rapoartele, fără capturi de ecran · 2) Doar planul · 3) Nu, ajung paginile publicate
  - **Răspunsul PO:** Da, planul și rapoartele, fără capturi de ecran (recomandarea). Câteva fișiere text în `docs/implementation`. Orice sesiune viitoare le găsește acolo.
- **[g0-8] Ajutor doar la o cameră: cum îl cere clientul?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 18. Azi alegerea de la pornire („Știu ce vreau”, „Am deja un proiect”, „Am nevoie de ajutor”) e una singură pentru toată cererea. Tu ai scris că un client poate ști ce vrea în mare, dar să aibă nevoie de ajutor la o singură cameră.
  - Variante: 1) O bifă pe fiecare cameră din coș: „La camera asta am nevoie de ajutor” · 2) Fiecare cameră își alege singură unul dintre cele trei moduri · 3) Rămâne bifa „Include proiectare cu plată” de la Date generale
  - **Răspunsul PO:** O bifă pe fiecare cameră din coș: „La camera asta am nevoie de ajutor” (recomandarea). Camera bifată sare întrebările și pleacă la firme doar cu tipul ei, pozele și mesajul. „Am nevoie de ajutor” de la pornire le bifează pe toate. Bifa „Include proiectare cu plată” de la Date generale dispare: cererea e „cu proiectare” când măcar o cameră are bifa. Cam 2 zile în plus și o coloană nouă în baza de date.
- **[g0-9] Până vine estimarea din aplicația de ofertare, ce fac cu bugetul pe care formularul îl pune singur?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 16. Ai scris că estimarea va veni din aplicația de ofertare, după dimensiuni și materiale. Până atunci formularul pune singur minimul estimării de azi, iar firma îl vede ca „Bugetul clientului”.
  - Variante: 1) Repar acum partea mică: clientul alege o sumă sau „Prefer să nu spun” · 2) Nu ating bugetul până vine aplicația de ofertare · 3) Rămâne suma pusă de formular, dar la firmă scrie „neconfirmat de client”
  - **Răspunsul PO:** Repar acum partea mică: clientul alege o sumă sau „Prefer să nu spun” (recomandarea). Firma nu mai vede o sumă pe care clientul n-a ales-o. Estimarea de azi rămâne doar reper pe glisor, până o înlocuiește cea nouă. Intră și ce ai hotărât deja: glisorul coboară sub estimare cu avertisment, treptele dispar, firmele filtrează cu un glisor.
- **[g0-10] Până atunci, cât valorează în credite cele 7 piese care azi contează zero?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 21. Ai scris „am scris mai sus cum se calculează”; am înțeles că te referi la estimarea din aplicația de ofertare. Până vine ea, o canapea de 3 locuri costă 4 credite, iar o pereche de noptiere 5. Dacă am înțeles greșit, scrie regula la „Altceva”.
  - Variante: 1) Pun acum valorile propuse, ca provizorii · 2) Rămân zero până vine aplicația de ofertare
  - **Răspunsul PO:** Pun acum valorile propuse, ca provizorii (recomandarea). Canapea 3, bufet 2, mobilier de baie 2, mobilier de hol 2, corp suspendat 1, fotoliu 1, taburet 1. Se schimbă oricând din Admin → Mărime proiect, fără lansare. Cererile deja publicate nu se recalculează.
- **[g0-11] Proiectarea cu plată: cât construiesc acum din drumul descris de tine?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 42. Ai scris: fiecare firmă răspunde întâi cu prețul proiectării și ce include, apoi clientul alege firma cu care proiectează. Azi firma trimite o singură ofertă, în care prețul mobilierului e obligatoriu, iar prețul proiectării e o rubrică opțională.
  - Variante: 1) Acum: prețul proiectării și „ce include” devin obligatorii în oferta la cererile cu proiectare · 2) Drum nou în doi pași: întâi ofertă doar pentru proiectare, apoi, după proiect, ofertă pentru mobilier · 3) Doar textele, fără schimbări în ofertă
  - **Răspunsul PO:** Acum: prețul proiectării și „ce include” devin obligatorii în oferta la cererile cu proiectare (recomandarea). Clientul compară firmele după proiectare, iar textele spun drumul tău. Prețul mobilierului rămâne în aceeași ofertă, ca estimare. Cam o zi în plus, în etapa 4, odată cu formularul nou de ofertă.
- **[g0-12] Cum ajunge la firme o cerere cu montaj în altă țară?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 31. Lista de țări rămâne. Azi însă o firmă vede doar cererile aflate la cel mult atâția kilometri de sediul ei, deci o cerere din Germania nu ajunge la nimeni.
  - Variante: 1) Firma bifează în profil țările în care lucrează; cererile de acolo îi apar indiferent de distanță · 2) Cererile din afara României apar la toate firmele, cu eticheta țării · 3) Rămâne ca azi
  - **Răspunsul PO:** Firma bifează în profil țările în care lucrează; cererile de acolo îi apar indiferent de distanță (recomandarea). Clientul din altă țară ajunge doar la firmele care chiar merg acolo. Cam o zi și jumătate și o schimbare mică în baza de date.
- **[g0-13] Câte luni după finalizare poate clientul să apese „Raportează o problemă”?** *(întrebare nouă, din răspunsurile PO)*
  - Context: Întrebare nouă, din răspunsul tău la problema 6. Ai ales butonul; mai lipsește durata. Tot tu ai făcut garanția obligatorie în ofertă (problema 29).
  - Variante: 1) Cât ține garanția scrisă în ofertă, dar cel puțin 24 de luni · 2) 24 de luni pentru toate · 3) 12 luni pentru toate
  - **Răspunsul PO:** Cât ține garanția scrisă în ofertă, dar cel puțin 24 de luni (recomandarea). Fiecare comandă are termenul ei. 24 de luni e garanția legală de conformitate pentru consumatori.

