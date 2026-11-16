# Raport M — coordonator: primul scenariu cap-coada (local), consola de admin (local), pagini publice (productie)

Scenariul S01, facut de mana in panoul de browser pe stiva locala (aceeasi versiune ca productia):
client Ana → „Nu stiu exact ce vreau — am nevoie de ajutor” → Bucatarie + Living → un fisier PNG → buget, termen, adresa → publicare →
firma A (proprietar) vede cererea, o preia (20 de credite), trimite oferta (21.900 lei, 6 saptamani, garantie 24 de luni) si doua mesaje →
clientul citeste oferta, raspunde in conversatie si cere o modificare.

## Constatari

### M-25 · P1 · produs · Dupa prima oferta primita, cererea se inchide pentru celelalte firme
- **Unde:** pagina cererii (client), `/ro/firm-rules` pe productie, setarea de admin `claims_open_after_first_offer`.
- **Ce se intampla:** dupa ce prima firma a trimis oferta (la 2 minute de la preluare), pagina clientului spune „Cererea nu mai apare in lista firmelor, deci firme noi nu o mai pot vedea”. Tabelul „Ofertele, una langa alta” are o singura coloana. Regulile publice de pe productie confirma: „Din momentul in care una dintre firmele care au preluat cererea trimite prima oferta, cererea nu mai poate fi preluata de alte firme, chiar daca nu s-au ocupat toate cele 3 locuri.” Valoarea implicita din cod e `false` (`apps/backend/prisma/seed.ts:167`, `src/common/settings/setting-defaults.ts:11`).
- **De ce conteaza:** prima pagina promite „Trei firme. Trei oferte. Una langa alta.” Cu regula asta, clientul primeste trei oferte doar daca trei firme preiau inainte ca vreuna sa oferteze. Prima firma are interesul sa trimita repede orice oferta, ca sa-si inchida concurenta.
- **Propunere:** fie cererea ramane deschisa pana se ocupa locurile sau pana trece un termen (de exemplu 48 de ore), fie promisiunea de pe prima pagina se schimba. E o decizie de produs.

### M-30 · P1 · produs · Planul de abonament intarzie cererile, iar regulile publice nu spun asta
- **Unde:** Admin → Setari → Planuri de abonament („Intarziere la cererile noi”); `/ro/marketplace` (firma); `/ro/firm-rules` (productie).
- **Ce se intampla:** local, firma pe GOLD a vazut cererea abia dupa ce am pus intarzierea pe 0 (valorile gasite: SILVER 60 de minute, GOLD 30, PLATINUM 0). Cat cererea era ascunsa, pagina firmei spunea doar „Nicio cerere disponibila momentan”. Clientului i se spune in acelasi timp „Cererea e vizibila firmelor verificate din zona ta”. Pagina publica de reguli de pe productie nu pomeneste intarzierea. Impreuna cu M-25: o firma PLATINUM poate prelua si oferta inainte ca firmele GOLD si SILVER sa vada cererea.
- **Propunere:** pe pagina goala a firmei: „Pe planul tau cererile noi apar dupa X minute”. In reguli: un paragraf despre intarziere. De verificat valorile de pe productie.

### M-08 · P1 · defect · Dupa „Publica cererea” formularul sare la pasul 1, cu avertisment, inainte sa apara pagina cererii
- **Unde:** `/ro/requests/new`, pasul Sumar, imediat dupa publicare.
- **Ce se intampla:** publicarea reuseste (201), dar timp de cateva secunde formularul arata din nou „Cum pornim cererea?” cu avertismentul galben „Ciorna salvata doar pe acest dispozitiv”. In retea: un `PATCH` pe ciorna tocmai publicata primeste 404. Abia apoi apare pagina cererii. Nu exista niciun mesaj „Cererea a fost publicata”.
- **De ce conteaza:** clientul poate crede ca publicarea a esuat si o ia de la capat.
- **Nota:** vazut local, in modul de dezvoltare, unde trecerea e mai lenta; cursa dintre salvarea automata si publicare e reala. De verificat durata pe productie.
- **Propunere:** opreste salvarea automata cand porneste publicarea; arata o stare „Se publica…” pana la redirectionare, apoi o confirmare.

### M-09 · P1 · defect · In modul „am nevoie de ajutor” cererea arata materiale pe care clientul nu le-a ales
- **Unde:** pagina cererii (client), pagina din piata si fisa de lucru (firma).
- **Ce se intampla:** clientul alege doar camerele, fara nicio intrebare. Totusi cererea arata „Bucatarie — Corpuri baza: PAL, Corpuri suspendate: PAL” si „Living — Mobilier living: PAL”. Sunt valori implicite, afisate ca alegerea clientului, fara diacritice.
- **Propunere:** pentru camerele fara raspunsuri, fisa sa arate doar „Detaliile se stabilesc cu firma”, fara piese si materiale.

### M-10 · P1 · defect · Firma nu vede fisierele cererii inainte de preluare (confirmat)
- **Unde:** `/ro/marketplace/<id>` ca firma, inainte de preluare.
- **Ce se intampla:** am incarcat un PNG la pasul Fisiere. Formularul spune „Fisierele sunt vizibile firmelor verificate din zona ta inainte de preluare”. Pe pagina din piata nu exista nicio sectiune de fisiere si nicio imagine. Confirma CS-03.

### M-11 · P1 · defect · Mesajul scris la „Date generale” se pierde la „Inapoi” (confirmat)
- **Unde:** `/ro/requests/new`, pasul Date generale.
- **Ce se intampla:** am scris mesajul pentru firme, am apasat „Inapoi”, apoi „Continua”: campul era gol. In antet scria in tot acest timp „Ciorna salvata la 20:42”. Confirma CS-04.

### M-14 · P1 · UX · Proprietarul preia cererea, dar ea ramane „Neatribuit” si se anuleaza singura intr-o ora
- **Unde:** `/ro/marketplace/claims/<id>` (fisa de lucru), imediat dupa preluare.
- **Ce se intampla:** fisa arata „Se ocupa: Neatribuit — Fara responsabil — preluarea se anuleaza automat in 59 de min”, desi tot acolo scrie „Preluata de Andrei A chiar acum”. Dialogul de preluare nu spune nimic despre atribuire. Dupa trimiterea ofertei ramane tot „Neatribuit”. Regula exista in pagina de reguli (60 de minute), dar cel care preia nu devine automat responsabil.
- **Propunere:** cel care preia devine responsabil; proprietarul sau managerul poate muta apoi cererea la un coleg.

### M-31 · P1 · productie · Pagina publica „Firme partenere” arata firmele demo ca firme verificate
- **Unde:** `https://backend-production-2813.up.railway.app/ro/partners`.
- **Ce se intampla:** pagina listeaza „A Mobila Premium”, „B DesignWood”, „C CasaMea”, „G MobMaster” si „H VintageHaus” cu eticheta „FIRMA VERIFICATA — Partener din iulie 2026”, alaturi de o singura firma reala.
- **De ce conteaza:** un vizitator le ia drept firme reale, verificate.
- **Propunere:** firmele demo ascunse de pe pagina publica (sau sterse) inainte de lansare.

### M-35 · P1 · defect · Sapte tipuri de piese nu au pondere de marime (confirmat in baza locala)
- **Unde:** tabelul `project_sizing_config`, cheia `ROOM_TYPE`; in aplicatie: Admin → Marime proiect.
- **Ce se intampla:** exista pondere pentru 21 de tipuri, dar nu pentru bufet, corp suspendat, masca de baie, mobilier de hol, canapea, fotoliu si taburet. Fara pondere, tipul conteaza ca zero, deci costul in credite iese prea mic. Confirma CP-03. De verificat pe productie.

### M-12 · P2 · defect · Un fisier de tip nepermis dispare fara niciun mesaj (confirmat)
- **Unde:** pasul Fisiere.
- **Ce se intampla:** am tras un `.txt` in zona de incarcare. Serverul a raspuns 400, interfata n-a spus nimic, fisierul n-a aparut. Confirma CS-05. In plus, pentru fisierul bun, apelul de confirmare a plecat de trei ori.

### M-13 · P2 · UX · Termenul de raspuns se afla abia dupa preluare
- **Unde:** panoul si dialogul „Preia cererea”.
- **Ce se intampla:** ambele spun „Daca nu trimiti oferta in termenul de raspuns, creditele se consuma”, fara sa spuna cat e termenul. Abia fisa de lucru arata „Mai sunt 5 zile si 3 ore — 17 nov. 2026, 23:59”.
- **Propunere:** termenul exact in panoul de preluare, inainte de confirmare.

### M-21 · P2 · UX · Bugetul e ales dinainte, iar treapta de sus e prea joasa
- **Unde:** pasul Date generale, „Buget”.
- **Ce se intampla:** in modul „am nevoie de ajutor” glisorul are trei trepte (sub 5.000, 5.000–15.000, peste 15.000 RON) si porneste pe prima. Daca clientul nu il atinge, cererea pleaca cu „Sub 5.000 RON”, iar bugetul intra in costul in credite al firmelor. Pentru o bucatarie cu living, „peste 15.000” e treapta maxima.

### M-18 · P2 · text · Aceeasi rubrica are alt nume in formular, in sumar si pe pagina cererii
- „Mesaj pentru firme” devine „Detaliile proiectului”; „Adresa” devine „Locul montajului”; „Preferinte de contact” devine „Canale de contact”; „Proiectare cu plata inclusa” devine „Include proiectare cu plata” plus „Ajutor pentru planificarea mobilierului” (doua randuri pentru acelasi lucru).
- Antetul formularului foloseste trei cuvinte pentru acelasi lucru: „COMANDA NOUA”, „Configureaza-ti proiectul”, „Cum pornim cererea?”.

### M-23 · P2 · UX · Formularul de oferta: TVA-ul nu e rubrica, iar termenul se poate contrazice cu data
- **Unde:** fisa de lucru, „Trimite oferta”.
- **Ce se intampla:** TVA-ul apare doar ca indemn in campul „Descriere”. Exista si „Termen de livrare” (saptamani sau zile lucratoare), si „Data livrarii”, fara legatura intre ele.

### M-26 · P2 · inconsecventa · Tabelul de comparare are alte rubrici decat exemplul de pe prima pagina
- **Ce se intampla:** tabelul real: Total, Termen, Garantie, Valabilitate. Exemplul de pe prima pagina: Pret, Termen, Garantie, cu „cel mai mic” si „cel mai rapid”. Subtitlul paginii repeta orasul: „Bucatarie + Living — București — București”.

### M-28 · P2 · UX · Clientului nu i se spune limpede ca firma ii vede deja datele de contact
- **Unde:** pagina cererii, „Cine vede cererea”.
- **Ce se intampla:** dupa preluare apare doar „A Mobila Premium — preluata pe 12 nov., 20:48”. Firma vede deja numele, e-mailul si adresa clientului si poate scrie in conversatie un telefon si un e-mail.

### M-20 · P2 · UX · Lista de tari de la adresa are 23 de tari
- **Ce se intampla:** se pot alege Germania, Spania, Finlanda si altele, desi firmele sunt in Romania si lucreaza pe raza in kilometri.

### M-02 · P2 · admin · „Ridica suspendarea” nu cere un motiv
- **Unde:** Admin → Firme → pagina firmei.
- **Ce se intampla:** respingerea unei firme cere un motiv de cel putin 3 caractere; ridicarea suspendarii, nu. Punctele de penalizare raman 12, egal cu pragul de suspendare.

### M-03 · P2 · date · Abonamentele expirate ca data raman cu starea „activ” in baza de date
- **Ce se intampla:** local, patru firme au abonamente cu data de expirare trecuta si starea `ACTIVE`. Tabloul de bord de admin numara corect dupa data („Abonamente active: 1”).

### M-16 · P3 · text · Jargon in interfata firmei
- „Sloturi 0/3”, „Termen pentru oferta (SLA)”, „termenul SLA”, „Termen SLA depasit”, „Anulata (neatribuita)”. In alte locuri acelasi lucru se numeste „Termen de raspuns depasit”.

### M-17 · P3 · UX · Nicio confirmare dupa preluare si dupa trimiterea ofertei
- Sub titlul cererii ramane „datele clientului si adresa exacta apar dupa preluare” si dupa ce firma a preluat-o. Nu apare niciun mesaj de reusita.

### M-32 · P3 · text · Regulile publice de pe productie: „primeste 0 puncte de penalizare”
- **Unde:** `/ro/firm-rules` pe productie, sectiunea 5.
- **Ce se intampla:** „…creditele rezervate se consuma si firma primeste 0 puncte de penalizare.” Propozitia ar trebui sa lipseasca atunci cand valoarea e 0. Tot acolo: „3 zile lucratoare pentru proiectele mici, 3 zile lucratoare pentru cele medii si 5 zile lucratoare pentru cele mari”. Dialogul de preluare (vazut local) spune totusi „creditele se consuma si firma primeste puncte de penalizare”.

### M-33 · P3 · productie · Adresa publica de contact e una personala
- Subsolul site-ului si pagina de reguli de pe productie trimit la o adresa de Yahoo.

### M-01 · P3 · admin · Codul intern al starii apare sub eticheta
- In listele de admin (firme, proiecte, utilizatori) apare „IN ASTEPTARE” si dedesubt `PENDING_VERIFICATION`, „APROBATA” si `APPROVED`, „Client” si `CLIENT`.

### M-04 · P3 · text · Meniul de admin spune „Proiecte”, restul aplicatiei spune „cereri”

### M-05 · P3 · admin · Verificarea unei firme nu arata niciun document
- Pagina de verificare arata CUI, numar de registru, adresa, membri si portofoliu. Nu exista certificat sau alt document incarcat de firma.

### M-19 · P3 · text · Adresa din sumar repeta orasul si adauga codul tarii
- „Bulevardul Unirii 10, București, București, RO”.

### M-22 · P3 · UX · „Fisa cererii” arata „Fisiere — optional” si dupa ce ai incarcat un fisier

### M-24 · P3 · UX · Panoul firmei: „12 puncte active din 12”, dar lista arata trei evenimente

### M-27 · P3 · UX · „Trimite” cu mesajul gol nu face nimic si nu spune nimic

### M-29 · P3 · UX · „Cere modificare” e un text liber, nelegat de rubricile ofertei
- Textul apare pe oferta ca „Modificare solicitata”, dar nu si in conversatie, si nu spune ce rubrica se schimba (pret, termen, material).

### M-06 · info · Mesajul la prea multe incercari de login e clar
- Dupa 5 incercari pe minut: „Prea multe incercari una dupa alta. Asteapta un minut si incearca din nou.” Limita e pe adresa de retea, deci un birou cu aceeasi adresa o poate atinge.

### M-34 · info · Pe productie, Termenii, Politica de confidentialitate si pagina 404 sunt in regula
- Texte complete, fara locuri goale; pagina 404 are linkuri utile; identitatea operatorului apare in subsol.

### M-36 · info · Consola de admin: setarile se schimba sigur
- La o valoare modificata apare o bara „1 modificare nesalvata: GOLD · Intarziere la cererile noi, 30 → 0 minute”, apoi o confirmare cu lista schimbarilor. Sub camp ramane „Salvat: 30”. Paginile de firme, plati, dispute, utilizatori, contacte detectate si joburi s-au incarcat fara erori.

### M-37 · info · Ciclul de plata prin transfer bancar merge cap-coada
- **Ce am facut:** firma D a comandat 10 credite prin transfer (121 lei cu TVA); din Admin → Plati am apasat „Confirma incasarea…”. Dialogul numeste firma si suma si avertizeaza ca factura nu se mai poate anula. Dupa confirmare: mesaj „Plata a fost confirmata — factura a fost emisa”, creditele firmei au urcat de la 210 la 220, iar firma a primit e-mailul „Plata a fost confirmata”.
- **De retinut:** in lista de plati, randurile se muta in timp ce pagina se reincarca, asa ca un clic poate nimeri alta comanda; dialogul cu numele firmei e cel care previne greseala.

### M-38 · P3 · e-mail · „Oferta ta a fost acceptata” pleaca la toti cei cinci membri ai firmei
- **Unde:** Mailpit, dupa ce clientul a acceptat oferta firmei A (scenariul SA-01).
- **Ce se intampla:** acelasi e-mail a ajuns la proprietar, manager si toti cei trei angajati, inclusiv la cei care nu lucreaza la cerere. De verificat daca asa a fost gandit.

### M-39 · P2 · date demo · „Firma noua nu poate trimite oferte” (SD-01) tine de datele demo, nu de firmele reale
- **Ce am verificat:** agentul SD a gasit ca firma D, aprobata azi, nu putea trimite oferte: nu avea niciun rand in matricea de permisiuni si proprietarul primea refuz. In cod, o firma reala primeste permisiunile implicite chiar la inscriere (`apps/backend/src/modules/companies/companies.service.ts:330`). Datele demo le creeaza doar pentru firmele care erau deja aprobate la incarcare (`apps/backend/prisma/seed-demo.ts`), deci lipsesc la firmele demo D si E.
- **Ce ramane de facut:** proprietarul sa poata edita oferta si cand matricea e goala; datele demo sa creeze permisiunile pentru toate firmele.

### M-40 · info · La final, setarile de admin locale sunt identice cu cele de la inceput
- Am comparat `system_settings`, `penalty_rules`, `project_sizing_config`, `subscription_plans` si `subscription_plan_features` cu copia luata inainte de teste (`audit\baseline\`): nicio diferenta. Singura setare schimbata pe parcurs (intarzierea planului GOLD, 30 → 0 → 30) a fost readusa din consola.
