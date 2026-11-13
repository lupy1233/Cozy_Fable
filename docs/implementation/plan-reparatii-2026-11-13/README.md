# Planul reparațiilor după audit — 2026-11-13

Planul pentru cele 63 de probleme alese și ordonate de PO după auditul din 2026-11-12 (`../audit-2026-11-12/`). Fiecare problemă a fost căutată în cod înainte să intre aici (versiunea ef42664): 56 sunt ca în audit, 7 diferă parțial. Problemele `c8` și `l2` au fost lăsate deoparte de PO.

- Pagina cu planul și cu întrebările: https://claude.ai/artifact/N49VLfeGcexJuQzxh8aCWF (răspunsurile PO se salvează în baza paginii: colecția `plan`, documentul `raspunsuri`).
- Ordinea aleasă de PO: https://claude.ai/artifact/7DwBtqnmpxnQh3PeEkTmwi · raportul auditului: https://claude.ai/artifact/DXn5pzeLABtxTcQhWnoEfU
- Răspunsurile PO din 2026-11-13: `raspunsuri-po-2026-11-13.md`. Fișierele `etapa-NN.md` conțin pașii, locurile din cod, verificările și răspunsul la fiecare întrebare.
- Zilele sunt zile de lucru estimate (mărimea muncii), nu zile din calendar.

## Etapele

| Etapa | Ce cuprinde | Probleme (locul în ordinea PO) | Zile | Note |
|---|---|---|---|---|
| [—](etapa-00.md) | Înainte de orice | — | — |  |
| [1](etapa-01.md) | Opt reparații grave și scurte | 1, 2, 3, 4, 5, 6, 7, 8 | 12,75 |  |
| [2](etapa-02.md) | Ciorna, publicarea și contul | 18, 9, 10, 11, 12, 13, 14, 15 | 11 | schimbă baza de date |
| [3](etapa-03.md) | Bugetul și fișa firmei | 16, 17 | 6 |  |
| [4](etapa-04.md) | Ofertele: refuz, variante și comparație | 19, 29 | 9 | schimbă baza de date |
| [5](etapa-05.md) | Restul problemelor grave de mărime medie | 20, 21, 22, 23, 24, 25, 26 | 16,75 | schimbă baza de date |
| [6](etapa-06.md) | Formularul, prima versiune nouă: material și deschidere | 27, 28, 51, 53 | 18,5 | versiune nouă de formular |
| [7](etapa-07.md) | Probleme medii, mici ca efort | 30, 31, 32, 33, 34, 35, 36, 37 | 11,75 | schimbă baza de date |
| [8](etapa-08.md) | Formular și texte: afișare, validare, telefon | 38, 39, 40, 41, 42, 43 | 20,5 |  |
| [9](etapa-09.md) | 3D, notificări, portofel și ciorne vechi | 44, 45, 46, 47, 48 | 15,75 |  |
| [10](etapa-10.md) | Formularul, a doua versiune nouă: măsuri și întrebări lipsă | 49, 50 | 19,5 | versiune nouă de formular |
| [11](etapa-11.md) | Pornirea firmei noi | 52 | 6 |  |
| [12](etapa-12.md) | Mărunțișuri: texte, formate, curățenie | 54, 55, 56, 57, 58, 60, 61, 62, 63, 59 | 11,5 |  |

Total: 159 zile de lucru, 91 întrebări (91 cu răspuns).

## Cum lucrăm (hotărât de PO)

- De unde pornesc cu codul? → Unești tu întâi PR #20, apoi lucrez pe câte o ramură pentru fiecare etapă
- Cum ajunge fiecare etapă pe producție? → Îți arăt ce s-a schimbat și lansez când spui tu, etapă cu etapă
- Cine verifică pe producție părțile care cer cont? → Tu, după fiecare lansare, cu o listă scurtă de pași de la mine
- Mut problema 18 (editarea unei cereri publicate strică ciorna) înaintea problemelor 9, 10 și 11? → Da, o fac prima în etapa 2
- Lipesc problema 29 (tabelul de comparare) de problema 19 (refuzul ofertei și variantele)? → Da, le fac împreună în etapa 4
- În câte runde schimb întrebările formularului? → Două runde
- Salvez planul și rapoartele auditului în proiect? → Da, planul și rapoartele, fără capturi de ecran

## Întrebări rămase fără răspuns

Niciuna.

## Hotărâri ale PO care schimbă reguli scrise

Se trec în `docs/07-decisions-log.md` (și în `docs/02` / `docs/03`, unde e cazul) în etapa în care se aplică, cu data răspunsului (2026-11-13):

- **Cererea rămâne deschisă până se ocupă cele 3 locuri**, și după prima ofertă (`a1-1`). Schimbă invarianta 3.1 (lista stărilor în care se poate prelua) și regulile publice.
- **Fără întârziere pe plan**: toate planurile văd cererile imediat (`a1-2`, răspuns scris de PO). Înlocuiește decizia despre întârzierea pe plan; decizia despre tăcerea asupra ei rămâne fără obiect.
- **Până la 5 dispozitive pe cont** în același timp (`f3-1`). Schimbă invarianta 3.13 și decizia despre sesiunea unică.
- **Costul unei preluări: minim 1 credit, fără maxim** (`d3-3`). Închide hotărârea lipsă din `docs/03` despre plafon.
- **Raportarea unei probleme după finalizare** (`e2-2`), **etape de execuție bifate de firmă** și **„livrat” doar după un număr minim de zile** (`e1-2`, `e1-3`): reguli noi de produs.
- **Estimarea bugetului și costul în credite vor veni din aplicația de ofertare** (după dimensiuni și materiale), care se integrează ulterior (`b11-1`, `d3-1`). Nu face parte din acest plan; până atunci se aplică răspunsurile la întrebările noi `g0-9` și `g0-10`.
