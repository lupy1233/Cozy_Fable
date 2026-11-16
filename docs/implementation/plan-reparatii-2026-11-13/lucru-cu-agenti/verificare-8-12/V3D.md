# Verificator V3D — piesele 3D pe placa video (etapele 9 și 10) + 3D pe telefon (etapa 8)

Citește întâi `COMUN.md` din același folder. Folderul tău: `…\scratchpad\reparatii\verificare-8-12\v3d\`.

## Conturile tale (doar acestea)
- vizitator (fără cont) pentru formular; un client NOU al tău, `verif.v3d.1@example.test`, pentru publicare
- firma B, managerul: `mgr.b@demo.ro` (ca să vezi fișa cererii ca firmă; NU `owner.b`)
- NU folosi: admin, ana, mihai, firmele A / C / D / H.

## Înainte de toate
Confirmă o dată că browserul tău randează pe placa video: `WEBGL_debug_renderer_info` trebuie să numească „GeForce GTX 1070”. Scrie rezultatul în raport. Dacă nu — oprește-te și raportează.

## Surse
- CHANGELOG: „etapa 9” (rândurile 3D: reîncadrare, reguli de editare), „etapa 10” (rândul „De mână, 3D pe placa video”), „etapa 8” (3D pe telefon, comoda TV, bufet, insigna „orientative”).
- Rapoarte: `…\etapa-09\rapoarte\e9-3d.md`, `…\etapa-10\rapoarte\e10-3d.md`, `…\etapa-08\rapoarte\e8-3d.md` — „De verificat de mână”.
- Pagina de probă `/ro/dev/piece-3d` există, dar NU activează comenzile noi — piesele se verifică prin formular (`/ro/requests/new`, piesele din coș).

## Puncte (în ordine) — fiecare cu captură a scenei
1. **Dulap 600 × 280 × 80 cm și bibliotecă 400 × 280 × 50 cm**: după schimbarea dimensiunilor piesa încape toată în cadru (nicio margine tăiată); după rotire / zoom, butonul „Reîncadrează” readuce piesa în cadru. Bibliotecă: coloana nu trece de 80 cm; dulap: frontul de sertar nu trece de 50 cm înălțime (mesajele la valori peste).
2. **Telefon (375 × 812 și 390 × 844)**: scena 3D stă lipită sus, butonul „Reîncadrează” se vede, comenzile se pot derula sub ea, fără derulare orizontală; bara de jos lipită.
3. **Canapea** (formularul nou): extensibilă + ladă, 4 locuri, șezlong stânga, 280 cm → în Sumar chips „Extensibilă” / „Cu ladă de depozitare”; scena arată șezlongul pe stânga. Publică (`[VERIF V3D] Canapea`, titlu prin corpul `POST …/publish`); ca firmă (`mgr.b`; mută `published_at` cu 31 min în urmă dacă trebuie): „Extensibilă: da; Ladă de depozitare: da”; costul afișat (așteptat 13 credite în exemplul din proiect, dacă bugetul / restul răspunsurilor sunt ca în `DESIGN.md` §7 exemplul E — altfel notează costul și `size_score` și spune dacă se potrivește cu regula 0 / 1 / 2 locuri + 1 șezlong + 2 extensibilă).
4. **Pat „Altă mărime”**: 120 × 190 → adâncimea piesei 210 cm, sertarele / lada se deschid corect (nu trec prin cadru), pernele stau pe saltea; 200 × 240 la pat tapițat → scena se reîncadrează; alegerea „160 × 200” ascunde câmpurile de mărime.
5. **Masă de dining**: extensibilă 160 cm cu lungimea deschisă 220; schimbi lungimea închisă la 220 → cea deschisă urcă la 250; debifezi „Extensibilă” → câmpul dispare; rotundă: 80–160 cm (70 și 170 refuzate / aduse în interval, cu mesaj); 6 persoane la 120 cm → avertisment. Înălțimea: „Vreau altă înălțime (de obicei 75 cm)” → 72 cm coboară masa; trecerea pe „Măsuță de cafea” readuce 45 și debifează. Măsuța de cafea rotundă nu acceptă 180 cm (→ 100).
6. **Băncuță**: înălțimea 48 cm se vede în scenă și în Sumar.
7. **Comodă TV** (etapa 9 / 8): înălțimea minimă 35 cm; comoda TV nouă fără „Fronturi cu mâner” implicit; bufetul implicit pe „push”; insigna „orientative” doar la dimensiunile de pornire (dispare după ce schimbi o dimensiune).
8. **Ciornă veche**: o cerere / ciornă cu o piesă 3D de dinaintea versiunii noi (caută în bază una a contului tău — nu ai; atunci una în piață văzută ca `mgr.b` în vizualizatorul 3D „doar citire”): piesa se vede corect, fără comenzile noi, fără erori în consolă.
9. **Cadre pe secundă**: măsoară scurt (requestAnimationFrame, 3 s) pe o scenă cu dulapul mare, în timpul unei rotiri — notează valoarea (așteptat zeci de cadre, nu 1–2).
10. **Vizualizatorul firmei**: pe cererea ta publicată, butonul de vizualizare 3D al firmei arată aceeași piesă (dimensiuni, șezlong, culori) ca la client.

Scrieri directe permise: `published_at` pe cererile tale `[VERIF V3D]`.
