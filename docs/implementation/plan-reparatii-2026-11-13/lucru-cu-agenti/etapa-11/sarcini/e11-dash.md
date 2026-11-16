# Sarcina `e11-dash` — problema 52 (`h1`), pasul 5: panoul firmei noi

Citește secțiunea „## 52.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-11.md` și contractul etapei. Skill: `ui-component`.

## Ce ai de făcut
1. Card „Pregătește-ți firma” pe panoul firmei, cu pașii și progresul („3 din 5”):
   - portofoliu (cel puțin o lucrare),
   - locații și rază (cel puțin o locație),
   - echipă (opțional: marcat „opțional”, nu ține progresul pe loc),
   - e-mail de facturare completat,
   - permisiunile ofertei văzute / setate.
   Fiecare pas are legătură directă spre secțiunea lui din pagina firmei. Cardul dispare (sau se strânge într-un rând) când pașii obligatorii sunt făcuți. Starea pașilor vine de la server (lărgește răspunsul panoului din `companies.service.ts` cu ce lipsește; nu ține starea în browser).
2. Înlocuiește „Nimic urgent acum” pentru firma care nu și-a terminat pregătirea: cardul e primul lucru văzut.
3. O frază clară despre proba gratuită: până când ține și ce se întâmplă după (fără reînnoire automată) — folosește mesajul unificat de abonament din etapele anterioare (caută cum afișează azi pagina portofelului starea abonamentului / probei și refolosește aceleași date și aceeași formulare; nu inventa reguli noi despre probă).
4. Texte RO / EN în fragmentul `e11-dash`.

## Reguli
- Doar proprietarul și managerii văd pașii pe care doar ei îi pot face; un angajat vede panoul lui obișnuit.
- Nu schimba ce înseamnă „firmă aprobată” sau ce are voie o firmă să facă; cardul doar îndrumă.
- Datele și numerele formatate după limba aplicației, ora României.

## Teste
- Backend: răspunsul panoului întoarce starea corectă a fiecărui pas (firmă nouă: 0 făcuți; firmă cu portofoliu și locație: 2).
- Frontend: cardul cu progres; legăturile; cardul dispare când totul e făcut; fraza despre probă pentru probă activă / fără probă.

## Fișierele tale
Rândul `e11-dash` din contract. Texte: fragmentul `e11-dash`.
