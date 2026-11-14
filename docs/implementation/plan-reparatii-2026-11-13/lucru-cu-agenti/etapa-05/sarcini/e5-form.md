# Sarcina `e5-form` — problemele 20 (`c10`) și 24 (`c3`)

Citește secțiunile „## 20.” și „## 24.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md`. Faci DOAR partea marcată „Acum, fără versiune nouă”; dimensiunile la „Altă piesă” și întrebarea unică despre uși vin în etapa 6 — nu le începe.

## Ce ai de făcut
1. `c10` pasul 1 — rescrie (RO + EN) cele patru descrieri din coș care promit opțiuni inexistente (comodă TV, bibliotecă, birou, pantofar) și subtitlul 3D al pantofarului, ca să spună doar ce se poate alege azi în configuratorul 3D (verifică în `packages/shared/src/questionnaire/piece3d` ce opțiuni există cu adevărat). Fără „pe colț”, „perete media”, „vitrine”, „rabatabil”.
2. `c10` pasul 2 — pe fiecare rând din „Altă piesă”: câmp „Detalii” legat de descrierea care există deja în datele piesei (până la 2000 de caractere, cu contor) și limita vizibilă de 150 de caractere la nume.
3. `c10` pasul 3 — lista de material arată doar materialele oferite azi (fără MDF-ul vechi); pentru „Altul” clientul scrie în „Detalii”. Lista de deschidere arată doar Mâner / Push / Uși glisante. Validarea din shared acceptă în continuare valorile vechi (ciornele și cererile vechi nu se strică; o valoare veche deja aleasă rămâne vizibilă și selectată pe rândul ei).
4. `c3` — în lista de deschidere, „Glisante” devine „Uși glisante (culisante)” (RO; EN echivalent) și descrierea ei nu mai pomenește sertarele. Textul e folosit în toate fluxurile: caută toate locurile unde apare cheia înainte să o schimbi.

## Fișierele tale
- `apps/frontend/src/components/configurator/step-renderer.tsx` și testele lui (dacă nu există test pentru rândul „Altă piesă”, creezi unul lângă).
- Textele: doar prin fragment i18n (id `e5-form`).
- NU atinge `packages/shared/src/questionnaire/flows/**` (fluxurile sunt înghețate) și nici `room-spec-card.tsx` (e al lui `e5-size`). Dacă descrierea piesei nu ajunge deja pe fișa firmei, NU repara acolo: scrie la „De făcut de coordonator”.

## Teste (din „Cum se verifică”)
- Test de componentă: rândul are „Detalii”, iar textul ajunge în descrierea piesei (în valoarea trimisă mai departe).
- Test de conținut: descrierile din coș nu mai conțin „pe colț”, „perete media”, „vitrine”, „rabatabil” (RO) și echivalentele EN.
- Listele de material și de deschidere arată doar opțiunile de azi; o valoare veche deja salvată rămâne afișată.
