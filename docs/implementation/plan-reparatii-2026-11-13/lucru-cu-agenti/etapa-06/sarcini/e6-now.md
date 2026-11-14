# Sarcina `e6-now` — cele patru reparații ale etapei 6 care NU cer versiune nouă de formular

Citește din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-06.md` pasul 1 („Acum, fără versiune nouă”) de la problemele 27 (`c2`), 28 (`c1`), 51 (`c7`) și 53 (`c14`). Faci DOAR pașii 1; restul (versiunea nouă a formularului) îl proiectează acum un arhitect și îl vor scrie alți agenți — nu atinge `packages/shared/src/questionnaire/flows/**` (fluxurile sunt înghețate) și nu adăuga pași, opțiuni sau versiuni.

## Ce ai de făcut
1. **`c2` pasul 1** — textul de sub întrebarea de deschidere (`common.pieceSystems.subtitle`, RO + EN) devine: „Pentru ușile și sertarele piesei. Dacă piesa nu are, alege varianta cea mai apropiată sau scrie în detalii.” (EN echivalent). Caută unde mai e folosită cheia înainte să o schimbi.
2. **`c1` pasul 1** — corectează subtitlurile de material care se contrazic: dressingul („Materialul principal (corp și uși)” față de „Materialul modulelor interioare.”) și piesele ghidate cu „Confirmă materialul de execuție cu firma.” — fiecare subtitlu să spună limpede la ce parte a piesei se referă întrebarea AZI (citește fluxul ca să vezi ce se întreabă de fapt; nu schimba sensul întrebării, doar textul care îl descrie greșit). Peste tot în textele formularului, „lei/ml” devine „lei pe metru liniar” (RO; în EN „RON per linear metre” sau forma deja folosită în fișier — fii consecvent).
3. **`c7` pasul 1** — sub câmpul de text „Altul” (materialul scris de client, cel mult 120 de caractere) apare un contor „x / 120”, ca la celelalte câmpuri cu limită din formular (vezi cum a fost făcut contorul de la „Altă piesă” în etapa 5: `step-renderer.tsx`, rândul piesei). Doar interfața; limita din validare nu se schimbă.
4. **`c14` pasul 1** — ecranul de fronturi al bucătăriei (cel cu până la 9 întrebări) se împarte vizual pe zone — Bază / Suspendate / Insulă — DOAR din interfață: aceiași pași, aceleași id-uri, aceeași ordine de salvare, același număr de ecrane în ciornă; se schimbă doar gruparea vizuală în interiorul ecranului (titluri de zonă, spațiere). Citește propunerea din `E:\Cozy Fable\docs\implementation\form-redesign-2026-11-10.md` pentru cum arată zonele. Dacă împărțirea nu se poate face fără să schimbi numărul ecranului sau fluxul, NU o face: scrie la „DECIZIE NECESARĂ” de ce.

## Fișierele tale
- `apps/frontend/src/components/configurator/step-renderer.tsx` (+ testele lui) și, pentru punctul 4, componenta care desenează ecranul bucătăriei (găsește-o; dacă e `room-flow-runner.tsx` sau `room-screens.ts`, ai voie doar cu Edit punctual și spui în raport ce ai schimbat).
- Textele: doar prin fragment i18n (id `e6-now`).

## Teste
- Conținut: `common.pieceSystems.subtitle` are textul nou (RO + EN); niciun text din formular nu mai conține „lei/ml”.
- Componentă: contorul „x / 120” apare și numără; ecranul de fronturi al bucătăriei arată titlurile de zonă, iar ordinea și id-urile întrebărilor sunt neschimbate (compară cu lista pașilor din flux).
