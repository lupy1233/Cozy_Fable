# Worksheet PO — intrebarile si raspunsurile formularului (toate camerele si piesele)

> **Cum completezi:** pentru fiecare intrebare ai textul ACTUAL si campuri goale.
> Scrie doar unde vrei schimbari — ce lasi gol ramane cum e acum.
> - **Ordine noua**: pune numarul pozitiei dorite in cadrul camerei (1, 2, 3…).
>   Asa imi spui si cum vrei "asezate" intrebarile, nu doar textele.
> - **Text nou**: noul enunt al intrebarii / noua eticheta a raspunsului.
> - **Pastram?**: scrie NU daca intrebarea/optiunea trebuie sa dispara.
> - La finalul fiecarei camere ai sectiunea **Intrebari noi** pentru completari.
>
> Codurile dintre acolade (`layout`, `STRAIGHT`…) NU se schimba — sunt id-urile
> tehnice; le folosesc eu ca sa stiu exact la ce te referi.

_Generat automat din flow-urile curente la 2026-07-12._

---

## Bucatarie `KITCHEN` (flow v2)

### 1. „Ce forma are bucataria?”  `layout`

- Tip: **alegere unica**
- Subtitlu actual: „Alege configuratia care se potriveste spatiului tau.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `STRAIGHT` | Liniara | Corpuri pe un singur perete |  |  |
| 2 | `L_SHAPE` | In forma de L | Corpuri pe doi pereti alaturati |  |  |
| 3 | `U_SHAPE` | In forma de U | Corpuri pe trei pereti |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Vrei si o insula?”  `hasIsland`

- Tip: **Da / Nu**
- Subtitlu actual: „Insula adauga blat, depozitare si un loc de servire.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Cateva dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Masoara lungimea fronturilor si inaltimea camerei.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime latura A” (`runA`, 1–10 m) · „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce material pentru corpurile de baza?”  `frontMaterialBase`

- Tip: **alegere unica**
- Subtitlu actual: „Corpurile de jos — materialul influenteaza aspectul si pretul.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `frontMaterialBaseOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `frontMaterialBase` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ce material pentru corpurile suspendate?”  `frontMaterialWall`

- Tip: **alegere unica**
- Subtitlu actual: „Corpurile de sus pot avea alt material.”
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ce material ai in minte?”  `frontMaterialWallOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `frontMaterialWall` = "ALTUL"
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 8. „Ce material pentru insula?”  `frontMaterialIsland`

- Tip: **alegere unica**
- Subtitlu actual: „Insula poate iesi in evidenta cu materialul ei.”
- Apare doar daca: `hasIsland` = true
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Ce material ai in minte?”  `frontMaterialIslandOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `frontMaterialIsland` = "ALTUL"
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 10. „Ce sistem de deschidere pentru corpurile de baza?”  `openingSystemsBase`

- Tip: **alegere multipla**
- Subtitlu actual: „Poti alege mai multe.”
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GOLA` | Gola | Profil integrat, fara maner aplicat |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 11. „Ce sistem de deschidere pentru corpurile suspendate?”  `openingSystemsWall`

- Tip: **alegere multipla**
- Subtitlu actual: „Poti alege mai multe.”
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GOLA` | Gola | Profil integrat, fara maner aplicat |  |  |
| 4 | `AVENTOS` | Aventos (ridicare) | Frontul se ridica vertical, cu amortizare |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 12. „Ce sistem de deschidere pentru insula?”  `openingSystemsIsland`

- Tip: **alegere multipla**
- Subtitlu actual: „Poti alege mai multe.”
- Apare doar daca: `hasIsland` = true
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GOLA` | Gola | Profil integrat, fara maner aplicat |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 13. „Ce blat preferi?”  `countertop`

- Tip: **alegere unica**
- Subtitlu actual: „Optional — ajuta firma sa estimeze mai exact.”
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Blat laminat standard, cel mai accesibil |  |  |
| 2 | `HPL` | HPL | Laminat de inalta presiune, foarte rezistent |  |  |
| 3 | `QUARTZ` | Cuart compozit | Rezistent, aspect premium |  |  |
| 4 | `GRANITE` | Granit | Natural, foarte durabil |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 14. „Ce electrocasnice incorporezi?”  `appliances`

- Tip: **alegere multipla** · optionala
- Subtitlu actual: „Optional — ajuta la decupaje si nise.”
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `OVEN` | Cuptor |  |  |  |
| 2 | `HOB` | Plita |  |  |  |
| 3 | `HOOD` | Hota |  |  |  |
| 4 | `DISHWASHER` | Masina de spalat vase |  |  |  |
| 5 | `FRIDGE` | Frigider |  |  |  |
| 6 | `MICROWAVE` | Cuptor cu microunde |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 15. „Incarca proiectul sau schita ta”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — o schita sau un plan pentru aceasta bucatarie ajuta firmele sa oferteze precis.”
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Bucatarie

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Bucatarie

```
..............................................................
```

---

## Living `LIVING` (flow v2)

### 1. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru living.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `TV_UNIT` | Comoda TV | Sub televizor |  |  |
| 2 | `BOOKSHELF` | Biblioteca | Rafturi carti |  |  |
| 3 | `DISPLAY_CABINET` | Vitrina | Expunere |  |  |
| 4 | `COFFEE_TABLE` | Masuta cafea | Centru living |  |  |
| 5 | `WALL_SHELVES` | Rafturi suspendate | Montate pe perete |  |  |
| 6 | `OTHER` | Altceva | O piesa care nu e in lista |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce piesa ai in minte?”  `piecesOtherText`

- Tip: **text liber**
- Subtitlu actual: „Descrie pe scurt piesa care nu e in lista.”
- Apare doar daca: `piecesNeeded` ∈ {OTHER}
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 3. „Cum arata zona TV?”  `tvStyle`

- Tip: **alegere unica**
- Subtitlu actual: „Suspendata, pe pardoseala sau ansamblu complet cu dulapuri.”
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT}
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `FLOATING` | Comoda suspendata | Corp montat pe perete, pardoseala libera |  |  |
| 2 | `ON_FLOOR` | Comoda pe pardoseala | Corp asezat pe picioare sau soclu |  |  |
| 3 | `COMPLEX_UNIT` | Ansamblu cu dulapuri | Comoda + dulapuri in stanga/dreapta |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea peretelui si inaltimea.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 5. „Material — zona TV”  `materialTvUnit`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT}
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialTvUnitOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT} SI `materialTvUnit` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Ce sistem de deschidere?”  `systemsTvUnit`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT}
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 8. „Material — biblioteca”  `materialBookshelf`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF}
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Ce material ai in minte?”  `materialBookshelfOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF} SI `materialBookshelf` = "ALTUL"
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 10. „Ce sistem de deschidere?”  `systemsBookshelf`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF}
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 11. „Material — vitrina”  `materialDisplay`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {DISPLAY_CABINET}
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 12. „Ce material ai in minte?”  `materialDisplayOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {DISPLAY_CABINET} SI `materialDisplay` = "ALTUL"
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 13. „Ce sistem de deschidere?”  `systemsDisplay`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {DISPLAY_CABINET}
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 14. „Material — masuta”  `materialCoffeeTable`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {COFFEE_TABLE}
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 15. „Ce material ai in minte?”  `materialCoffeeTableOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {COFFEE_TABLE} SI `materialCoffeeTable` = "ALTUL"
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 16. „Ce sistem de deschidere?”  `systemsCoffeeTable`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {COFFEE_TABLE}
- Pozitia actuala: 16 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 17. „Material — rafturi”  `materialShelves`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES}
- Pozitia actuala: 17 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 18. „Ce material ai in minte?”  `materialShelvesOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES} SI `materialShelves` = "ALTUL"
- Pozitia actuala: 18 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 19. „Ce sistem de deschidere?”  `systemsShelves`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES}
- Pozitia actuala: 19 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 20. „Material — piesa ta”  `materialOtherPiece`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {OTHER}
- Pozitia actuala: 20 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 21. „Ce material ai in minte?”  `materialOtherPieceOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {OTHER} SI `materialOtherPiece` = "ALTUL"
- Pozitia actuala: 21 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 22. „Ce sistem de deschidere?”  `systemsOtherPiece`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {OTHER}
- Pozitia actuala: 22 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 23. „Iluminare LED in mobilier?”  `ledLighting`

- Tip: **Da / Nu** · optionala
- Subtitlu actual: „Banda LED in panouri sau corpuri.”
- Pozitia actuala: 23 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Raspunsuri: Da / Nu._

### 24. „Ai o schita a spatiului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — peretele cu TV-ul, cu dimensiuni si prize marcate.”
- Pozitia actuala: 24 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Living

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Living

```
..............................................................
```

---

## Dormitor `BEDROOM` (flow v2)

### 1. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru dormitor.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `WARDROBE` | Dulap | Depozitare haine |  |  |
| 2 | `BED_FRAME` | Cadru pat | Structura pat |  |  |
| 3 | `NIGHTSTANDS` | Noptiere | Langa pat |  |  |
| 4 | `DRESSER` | Comoda | Sertare |  |  |
| 5 | `TV_UNIT` | Comoda TV | Sub televizor |  |  |
| 6 | `VANITY` | Masuta toaleta | Cu oglinda si sertare |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce usi are dulapul?”  `wardrobeDoorType`

- Tip: **alegere unica**
- Subtitlu actual: „Alege sistemul de acces.”
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE}
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `SLIDING` | Glisante | Economisesc spatiu |  |  |
| 2 | `HINGED` | Batante | Clasice, acces total |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Ce dimensiune de saltea?”  `bedSize`

- Tip: **alegere unica**
- Subtitlu actual: „Patul se construieste in jurul saltelei.”
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME}
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `S_90` | 90 × 200 | O persoana |  |  |
| 2 | `M_140` | 140 × 200 | Compact, 2 persoane |  |  |
| 3 | `Q_160` | 160 × 200 | Matrimonial standard |  |  |
| 4 | `K_180` | 180 × 200 | King |  |  |
| 5 | `CUSTOM` | Dimensiuni custom | Introdu latimea si lungimea saltelei tale |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Dimensiunile saltelei tale”  `bedCustomSize`

- Tip: **dimensiuni (metri)**
- Apare doar daca: `bedSize` = "CUSTOM"
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Campuri de dimensiuni: „Latime saltea” (`bedCustomWidth`, 0.7–2.2 m) · „Lungime saltea” (`bedCustomLength`, 1.6–2.4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 5. „Depozitare sub pat?”  `bedStorage`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME}
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `NONE` | Fara |  |  |  |
| 2 | `LIFT_UP` | Lada rabatabila |  |  |  |
| 3 | `DRAWERS` | Sertare laterale |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Pat tapitat?”  `bedUpholstered`

- Tip: **Da / Nu**
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Raspunsuri: Da / Nu._

### 7. „Cate noptiere?”  `nightstandsCount`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {NIGHTSTANDS}
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `ONE` | Una |  |  |  |
| 2 | `TWO` | Pereche (2) |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 8. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Spatiul disponibil si inaltimea.”
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 9. „Material — dulap”  `materialWardrobe`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE}
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 10. „Ce material ai in minte?”  `materialWardrobeOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE} SI `materialWardrobe` = "ALTUL"
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 11. „Ce sistem de deschidere?”  `systemsWardrobe`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE}
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 12. „Material — pat”  `materialBed`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME}
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 13. „Ce material ai in minte?”  `materialBedOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME} SI `materialBed` = "ALTUL"
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 14. „Ce sistem de deschidere?”  `systemsBed`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {BED_FRAME}
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 15. „Material — noptiere”  `materialNightstands`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {NIGHTSTANDS}
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 16. „Ce material ai in minte?”  `materialNightstandsOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {NIGHTSTANDS} SI `materialNightstands` = "ALTUL"
- Pozitia actuala: 16 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 17. „Ce sistem de deschidere?”  `systemsNightstands`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {NIGHTSTANDS}
- Pozitia actuala: 17 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 18. „Material — comoda”  `materialDresser`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {DRESSER}
- Pozitia actuala: 18 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 19. „Ce material ai in minte?”  `materialDresserOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {DRESSER} SI `materialDresser` = "ALTUL"
- Pozitia actuala: 19 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 20. „Ce sistem de deschidere?”  `systemsDresser`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {DRESSER}
- Pozitia actuala: 20 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 21. „Material — comoda TV”  `materialTvUnit`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT}
- Pozitia actuala: 21 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 22. „Ce material ai in minte?”  `materialTvUnitOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT} SI `materialTvUnit` = "ALTUL"
- Pozitia actuala: 22 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 23. „Ce sistem de deschidere?”  `systemsTvUnit`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {TV_UNIT}
- Pozitia actuala: 23 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 24. „Material — masuta toaleta”  `materialVanity`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {VANITY}
- Pozitia actuala: 24 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 25. „Ce material ai in minte?”  `materialVanityOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {VANITY} SI `materialVanity` = "ALTUL"
- Pozitia actuala: 25 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 26. „Ce sistem de deschidere?”  `systemsVanity`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {VANITY}
- Pozitia actuala: 26 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 27. „Ai o schita a camerei?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — planul camerei cu pozitia patului si a dulapului.”
- Pozitia actuala: 27 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Dormitor

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Dormitor

```
..............................................................
```

---

## Dressing `DRESSING` (flow v2)

### 1. „Ce forma are dressingul?”  `layout`

- Tip: **alegere unica**
- Subtitlu actual: „Alege configuratia spatiului.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `LINEAR` | Liniar | Pe un perete |  |  |
| 2 | `L_SHAPE` | In L | Pe doi pereti |  |  |
| 3 | `U_SHAPE` | In U | Pe trei pereti |  |  |
| 4 | `WALK_IN` | Walk-in | Camera dedicata |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Dimensiuni dressing”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Lungimea fiecarei laturi si inaltimea dulapului — literele corespund schitei.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime latura A” (`runA`, 1–10 m) · „Inaltime dressing” (`wardrobeHeight`, 1.8–3.2 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 3. „Ce tip de usi?”  `doorType`

- Tip: **alegere unica**
- Subtitlu actual: „Alege sistemul de acces.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `SLIDING` | Glisante | Economisesc spatiu |  |  |
| 2 | `HINGED` | Batante | Clasice, acces total |  |  |
| 3 | `OPEN` | Fara usi | Module deschise |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce module interioare?”  `interiorModules`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege minim un modul — organizarea interiorului.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `HANGING_RODS` | Bare de agatat | Pentru camasi, rochii, sacouri |  |  |
| 2 | `SHELVES` | Rafturi | Haine impaturite, cutii, genti |  |  |
| 3 | `DRAWERS` | Sertare | Lenjerie, tricouri, accesorii mici |  |  |
| 4 | `SHOE_RACK` | Suport pantofi | Rafturi inclinate sau suporturi |  |  |
| 5 | `ACCESSORIES` | Accesorii | Pantalonar, suport curele/cravate |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Materialul modulelor.”
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Iluminare LED integrata?”  `lighting`

- Tip: **Da / Nu** · optionala
- Subtitlu actual: „Banda LED cu senzor la deschidere.”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Raspunsuri: Da / Nu._

### 8. „Ai o schita a spatiului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — o schita simpla cu dimensiuni ajuta firmele sa ofere un pret precis.”
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Dressing

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Dressing

```
..............................................................
```

---

## Birou `OFFICE` (flow v2)

### 1. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru birou.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `DESK` | Birou | Spatiu de lucru |  |  |
| 2 | `BOOKSHELF` | Biblioteca | Rafturi |  |  |
| 3 | `STORAGE` | Dulap depozitare | Documente si obiecte |  |  |
| 4 | `WALL_SHELVES` | Rafturi perete | Suspendate, deasupra biroului |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce forma are biroul?”  `deskShape`

- Tip: **alegere unica**
- Subtitlu actual: „Configuratia blatului de lucru.”
- Apare doar daca: `piecesNeeded` ∈ {DESK}
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `STRAIGHT` | Drept | Un singur blat |  |  |
| 2 | `L_SHAPE` | In L | Doua blaturi in colt |  |  |
| 3 | `U_SHAPE` | In U | Trei laturi de lucru |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Spatiul disponibil si biroul.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Material — birou”  `materialDesk`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {DESK}
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialDeskOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {DESK} SI `materialDesk` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ce sistem de deschidere?”  `systemsDesk`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {DESK}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Material — biblioteca”  `materialBookshelf`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF}
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 8. „Ce material ai in minte?”  `materialBookshelfOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF} SI `materialBookshelf` = "ALTUL"
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 9. „Ce sistem de deschidere?”  `systemsBookshelf`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {BOOKSHELF}
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 10. „Material — dulap”  `materialStorage`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {STORAGE}
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 11. „Ce material ai in minte?”  `materialStorageOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE} SI `materialStorage` = "ALTUL"
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 12. „Ce sistem de deschidere?”  `systemsStorage`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE}
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 13. „Material — rafturi”  `materialShelves`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES}
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 14. „Ce material ai in minte?”  `materialShelvesOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES} SI `materialShelves` = "ALTUL"
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 15. „Ce sistem de deschidere?”  `systemsShelves`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {WALL_SHELVES}
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 16. „Ai o schita a camerei?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — peretele de lucru, cu prize si fereastra marcate.”
- Pozitia actuala: 16 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Birou

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Birou

```
..............................................................
```

---

## Baie `BATHROOM` (flow v2)

### 1. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru baie.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `VANITY_UNIT` | Corp lavoar | Sub chiuveta |  |  |
| 2 | `MIRROR_CABINET` | Dulap oglinda | Cu depozitare |  |  |
| 3 | `TALL_STORAGE` | Coloana | Depozitare inalta |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea fiecarei piese selectate, plus inaltimea tavanului.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 3. „Baia este ventilata?”  `ventilation`

- Tip: **alegere unica**
- Subtitlu actual: „Ventilatia conteaza la alegerea materialelor.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `WINDOW` | Geam | Ventilatie naturala |  |  |
| 2 | `FAN` | Ventilator | Ventilatie mecanica |  |  |
| 3 | `NONE` | Neventilata | Fara geam sau ventilator |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce material pentru corpul de lavoar?”  `materialVanity`

- Tip: **alegere unica**
- Subtitlu actual: „Piesa cea mai expusa la apa.”
- Apare doar daca: `piecesNeeded` ∈ {VANITY_UNIT}
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialVanityOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {VANITY_UNIT} SI `materialVanity` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ce material pentru dulapul cu oglinda?”  `materialMirror`

- Tip: **alegere unica**
- Subtitlu actual: „Poate diferi de celelalte piese.”
- Apare doar daca: `piecesNeeded` ∈ {MIRROR_CABINET}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ce material ai in minte?”  `materialMirrorOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {MIRROR_CABINET} SI `materialMirror` = "ALTUL"
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 8. „Ce material pentru coloana?”  `materialTall`

- Tip: **alegere unica**
- Subtitlu actual: „Poate diferi de celelalte piese.”
- Apare doar daca: `piecesNeeded` ∈ {TALL_STORAGE}
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Ce material ai in minte?”  `materialTallOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {TALL_STORAGE} SI `materialTall` = "ALTUL"
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 10. „Incarca proiectul sau schita ta”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — o schita sau un plan pentru aceasta baie ajuta firmele sa oferteze precis.”
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Baie

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Baie

```
..............................................................
```

---

## Hol `HALLWAY` (flow v1)

### 1. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru hol.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `SHOE_CABINET` | Pantofar | Depozitare incaltaminte |  |  |
| 2 | `COAT_UNIT` | Cuier cu panou | Agatatori pe panou de perete |  |  |
| 3 | `WARDROBE` | Dulap de hol | Haine de sezon, aspirator |  |  |
| 4 | `BENCH` | Bancuta | Te incalti sezand |  |  |
| 5 | `MIRROR` | Oglinda cu polita | Rama + polita pentru chei |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea fiecarei piese selectate.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campurile de dimensiuni depind de raspunsurile anterioare (ex. layout-ul ales)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 3. „Material — pantofar”  `materialShoeCabinet`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {SHOE_CABINET}
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce material ai in minte?”  `materialShoeCabinetOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {SHOE_CABINET} SI `materialShoeCabinet` = "ALTUL"
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 5. „Ce sistem de deschidere?”  `systemsShoeCabinet`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {SHOE_CABINET}
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Material — cuier”  `materialCoatUnit`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {COAT_UNIT}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ce material ai in minte?”  `materialCoatUnitOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {COAT_UNIT} SI `materialCoatUnit` = "ALTUL"
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 8. „Ce sistem de deschidere?”  `systemsCoatUnit`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {COAT_UNIT}
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Material — dulap”  `materialWardrobe`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE}
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 10. „Ce material ai in minte?”  `materialWardrobeOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE} SI `materialWardrobe` = "ALTUL"
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 11. „Ce sistem de deschidere?”  `systemsWardrobe`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {WARDROBE}
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 12. „Material — bancuta”  `materialBench`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {BENCH}
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 13. „Ce material ai in minte?”  `materialBenchOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {BENCH} SI `materialBench` = "ALTUL"
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 14. „Ce sistem de deschidere?”  `systemsBench`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {BENCH}
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 15. „Material — oglinda”  `materialMirror`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {MIRROR}
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 16. „Ce material ai in minte?”  `materialMirrorOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {MIRROR} SI `materialMirror` = "ALTUL"
- Pozitia actuala: 16 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 17. „Ce sistem de deschidere?”  `systemsMirror`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {MIRROR}
- Pozitia actuala: 17 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 18. „Ai o schita a holului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — lungimea peretilor si pozitia usilor.”
- Pozitia actuala: 18 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Hol

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Hol

```
..............................................................
```

---

## Debara `PANTRY` (flow v2)

### 1. „Pe cati pereti montam?”  `wallsUsed`

- Tip: **alegere unica**
- Subtitlu actual: „Configuratia rafturilor in debara.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `ONE_WALL` | Un perete | Rafturi pe o latura |  |  |
| 2 | `L_SHAPE` | In L | Doua laturi |  |  |
| 3 | `U_SHAPE` | In U | Trei laturi |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Depozitare deschisa sau inchisa?”  `storageStyle`

- Tip: **alegere unica**
- Subtitlu actual: „Rafturi la vedere, dulapuri cu usi, sau mixt.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `OPEN_SHELVES` | Rafturi deschise | Acces rapid, la vedere |  |  |
| 2 | `CLOSED_CABINETS` | Dulapuri inchise | Protejat de praf |  |  |
| 3 | `MIXED` | Mixt | Rafturi sus, dulapuri jos |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Lungimea fiecarei laturi cu rafturi.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime latura A” (`runA`, 0.5–5 m) · „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Material pentru rafturile deschise”  `materialShelves`

- Tip: **alegere unica**
- Apare doar daca: `storageStyle` ∈ {OPEN_SHELVES, MIXED}
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialShelvesOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `storageStyle` ∈ {OPEN_SHELVES, MIXED} SI `materialShelves` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Material pentru dulapurile inchise”  `materialCabinets`

- Tip: **alegere unica**
- Apare doar daca: `storageStyle` ∈ {CLOSED_CABINETS, MIXED}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ce material ai in minte?”  `materialCabinetsOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `storageStyle` ∈ {CLOSED_CABINETS, MIXED} SI `materialCabinets` = "ALTUL"
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 8. „Ce sistem de deschidere?”  `systemsCabinets`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `storageStyle` ∈ {CLOSED_CABINETS, MIXED}
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Ai o schita a debaralei?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — dimensiunile peretilor si pozitia usii.”
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Debara

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Debara

```
..............................................................
```

---

## Spalatorie `LAUNDRY` (flow v2)

### 1. „Cum stau electrocasnicele?”  `applianceSetup`

- Tip: **alegere unica**
- Subtitlu actual: „Asezarea masinii de spalat si a uscatorului decide restul.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `WASHER_ONLY` | Doar masina de spalat | Fara uscator |  |  |
| 2 | `STACKED` | Coloana (suprapuse) | Uscator peste masina |  |  |
| 3 | `SIDE_BY_SIDE` | Alaturate sub blat | Blat continuu deasupra |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce mobilier ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege corpurile pentru spalatorie.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `APPLIANCE_HOUSING` | Dulap incastrare | Imbraca electrocasnicele |  |  |
| 2 | `STORAGE` | Dulapuri depozitare | Detergenti, cosuri, consumabile |  |  |
| 3 | `COUNTERTOP` | Blat de lucru | Sortat si impaturit rufe |  |  |
| 4 | `SINK_UNIT` | Corp cu cuva | Cuva tehnica pentru spalat manual |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Incaperea este ventilata?”  `ventilation`

- Tip: **alegere unica**
- Subtitlu actual: „Umiditatea din spalatorie conteaza la alegerea materialelor.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `WINDOW` | Geam | Ventilatie naturala |  |  |
| 2 | `FAN` | Ventilator | Ventilatie mecanica |  |  |
| 3 | `NONE` | Neventilata | Fara geam sau ventilator |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Peretele principal si inaltimea tavanului.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime perete principal” (`runA`, 0.8–6 m) · „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 5. „Material pentru dulapul de incastrare”  `materialApplianceHousing`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {APPLIANCE_HOUSING}
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialApplianceHousingOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {APPLIANCE_HOUSING} SI `materialApplianceHousing` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Ce sistem de deschidere?”  `systemsApplianceHousing`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {APPLIANCE_HOUSING}
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 8. „Material pentru dulapurile de depozitare”  `materialStorage`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {STORAGE}
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 9. „Ce material ai in minte?”  `materialStorageOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE} SI `materialStorage` = "ALTUL"
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 10. „Ce sistem de deschidere?”  `systemsStorage`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE}
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 11. „Material pentru blatul de lucru”  `materialCountertop`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {COUNTERTOP}
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 12. „Ce material ai in minte?”  `materialCountertopOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {COUNTERTOP} SI `materialCountertop` = "ALTUL"
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 13. „Material pentru corpul cu cuva”  `materialSinkUnit`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {SINK_UNIT}
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 14. „Ce material ai in minte?”  `materialSinkUnitOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {SINK_UNIT} SI `materialSinkUnit` = "ALTUL"
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 15. „Ce sistem de deschidere?”  `systemsSinkUnit`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {SINK_UNIT}
- Pozitia actuala: 15 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 16. „Ai o schita a spatiului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — pozitia racordurilor de apa si a prizelor ajuta mult.”
- Pozitia actuala: 16 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Spalatorie

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Spalatorie

```
..............................................................
```

---

## Balcon `BALCONY` (flow v2)

### 1. „Balconul este inchis?”  `enclosed`

- Tip: **alegere unica**
- Subtitlu actual: „Mobilierul de interior rezista doar in balcon inchis.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `ENCLOSED` | Inchis (termopan) | Protejat de intemperii |  |  |
| 2 | `OPEN` | Deschis | Expus la intemperii |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce piese ai nevoie?”  `piecesNeeded`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege mobilierul pentru balcon.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `STORAGE_BENCH` | Banca cu lada | Sezut + depozitare |  |  |
| 2 | `TALL_CABINET` | Dulap inalt | Scule, conserve, diverse |  |  |
| 3 | `WORKTOP` | Blat de lucru | Birou sau masa de plante |  |  |
| 4 | `SHELVES` | Rafturi | Depozitare deschisa |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Lungimea utila si adancimea libera a balconului.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime utila” (`balconyLength`, 0.8–8 m) · „Adancime libera” (`balconyDepth`, 0.4–2.5 m) · „Inaltime tavan” (`ceilingHeight`, 2–4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Material pentru banca cu lada”  `materialStorageBench`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {STORAGE_BENCH}
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialStorageBenchOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE_BENCH} SI `materialStorageBench` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ce sistem de deschidere?”  `systemsStorageBench`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {STORAGE_BENCH}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Material pentru dulapul inalt”  `materialTallCabinet`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {TALL_CABINET}
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 8. „Ce material ai in minte?”  `materialTallCabinetOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {TALL_CABINET} SI `materialTallCabinet` = "ALTUL"
- Pozitia actuala: 8 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 9. „Ce sistem de deschidere?”  `systemsTallCabinet`

- Tip: **alegere multipla**
- Subtitlu actual: „Pentru usile si sertarele acestei piese — poti alege mai multe.”
- Apare doar daca: `piecesNeeded` ∈ {TALL_CABINET}
- Pozitia actuala: 9 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 10. „Material pentru blatul de lucru”  `materialWorktop`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {WORKTOP}
- Pozitia actuala: 10 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 11. „Ce material ai in minte?”  `materialWorktopOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {WORKTOP} SI `materialWorktop` = "ALTUL"
- Pozitia actuala: 11 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 12. „Material pentru rafturi”  `materialShelves`

- Tip: **alegere unica**
- Apare doar daca: `piecesNeeded` ∈ {SHELVES}
- Pozitia actuala: 12 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 13. „Ce material ai in minte?”  `materialShelvesOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `piecesNeeded` ∈ {SHELVES} SI `materialShelves` = "ALTUL"
- Pozitia actuala: 13 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 14. „Ai o schita a balconului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — lungime, adancime si pozitia ferestrelor.”
- Pozitia actuala: 14 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Balcon

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Balcon

```
..............................................................
```

---

## Alta piesa (formular liber) `PIECES` (flow v1)

### 1. „Ce piese ai nevoie?”  `pieces`

- Tip: **lista de piese (cos)**
- Subtitlu actual: „Adauga fiecare piesa cu material si cantitate.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Cosul de piese al camerei: minim 1, maxim 10 piese._

### 2. „Incarca proiectul sau schita ta”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — o schita sau un plan ajuta firmele sa oferteze precis.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Alta piesa (formular liber)

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Alta piesa (formular liber)

```
..............................................................
```

---

## Piesa: Dulap `PIECE_WARDROBE` (flow v2)

### 1. „Ce usi are dulapul?”  `doorType`

- Tip: **alegere unica**
- Subtitlu actual: „Sistemul de acces schimba pretul si spatiul necesar.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `SLIDING` | Glisante | Economisesc spatiu |  |  |
| 2 | `HINGED` | Batante | Clasice, acces total |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Pana in tavan (tip dressing)?”  `toCeiling`

- Tip: **Da / Nu** · optionala
- Subtitlu actual: „Dulapul urca pana la tavan, ca un dressing incorporat.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea dulapului si inaltimea.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime dulap” (`width`, 0.6–6 m) · „Inaltime dulap” (`height`, 1.8–2.8 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce module interioare?”  `interiorModules`

- Tip: **alegere multipla**
- Subtitlu actual: „Alege minim un modul.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `HANGING_RODS` | Bare de agatat | Camasi, rochii, sacouri |  |  |
| 2 | `SHELVES` | Rafturi | Haine impaturite, cutii |  |  |
| 3 | `DRAWERS` | Sertare | Lenjerie, accesorii |  |  |
| 4 | `SHOE_RACK` | Suport pantofi | Rafturi inclinate |  |  |

_Selectie: minim 1._

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Materialul corpului si al fronturilor.”
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Ai o schita a peretelui?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — latimea peretelui si obstacolele (prize, calorifer, usa).”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Dulap

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Dulap

```
..............................................................
```

---

## Piesa: Comoda TV / perete media `PIECE_TV_UNIT` (flow v2)

### 1. „Comoda joasa sau perete media?”  `style`

- Tip: **alegere unica**
- Subtitlu actual: „De la un corp simplu la o compozitie pe tot peretele.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `LOW_UNIT` | Comoda joasa | Corp orizontal sub TV |  |  |
| 2 | `MEDIA_WALL` | Perete media | Panouri + corpuri pe tot peretele |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Unde sta TV-ul?”  `tvSetup`

- Tip: **alegere unica**
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `TV_ON_WALL` | Pe perete |  |  |  |
| 2 | `TV_ON_UNIT` | Pe comoda |  |  |  |
| 3 | `UNDECIDED` | Nu m-am decis |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea zonei TV.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 1–5 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Materialul corpurilor si al panourilor.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Sisteme de deschidere”  `openingSystems`

- Tip: **alegere multipla** · optionala
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ai o schita a peretelui?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — latimea peretelui si pozitia prizelor.”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Comoda TV / perete media

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Comoda TV / perete media

```
..............................................................
```

---

## Piesa: Biblioteca `PIECE_BOOKCASE` (flow v2)

### 1. „Ce stil de biblioteca?”  `style`

- Tip: **alegere unica**
- Subtitlu actual: „Deschisa, cu corpuri jos, sau cu usi de sticla.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `OPEN` | Rafturi deschise | Totul la vedere |  |  |
| 2 | `BASE_CABINETS` | Corpuri jos + rafturi sus | Depozitare inchisa la baza |  |  |
| 3 | `GLASS_DOORS` | Vitrina cu sticla | Protejat si elegant |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Pana in tavan?”  `toCeiling`

- Tip: **Da / Nu** · optionala
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea si inaltimea bibliotecii.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 0.4–4 m) · „Inaltime” (`height`, 0.8–2.8 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Rafturile late au nevoie de material rigid.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Sisteme de deschidere”  `openingSystems`

- Tip: **alegere multipla** · optionala
- Apare doar daca: `style` ∈ {BASE_CABINETS, GLASS_DOORS}
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 7. „Ai o schita a peretelui?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — latimea peretelui si inaltimea tavanului.”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Biblioteca

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Biblioteca

```
..............................................................
```

---

## Piesa: Birou (masa de lucru) `PIECE_DESK` (flow v2)

### 1. „Ce forma are biroul?”  `shape`

- Tip: **alegere unica**
- Subtitlu actual: „Drept pe un perete sau in L pe colt.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `STRAIGHT` | Drept | Pe un perete |  |  |
| 2 | `L_SHAPE` | In L (colt) | Doua laturi de lucru |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Canal pentru cabluri?”  `cableManagement`

- Tip: **Da / Nu** · optionala
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea blatului (si a doua latura daca e in L).”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime blat” (`widthA`, 0.8–3 m) · „Adancime blat” (`depth`, 0.5–0.9 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Depozitare la birou?”  `storage`

- Tip: **alegere multipla** · optionala
- Subtitlu actual: „Optional — corp de sertare sau etajera deasupra.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `DRAWER_UNIT` | Corp de sertare | Sub blat, fix sau mobil |  |  |
| 2 | `SHELF_ABOVE` | Etajera deasupra | Rafturi deasupra blatului |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Blatul de birou se zgarie primul — conteaza finisajul.”
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Ai o schita a spatiului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — peretele de lucru, cu prize si fereastra.”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Birou (masa de lucru)

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Birou (masa de lucru)

```
..............................................................
```

---

## Piesa: Pat `PIECE_BED` (flow v2)

### 1. „Ce dimensiune de saltea?”  `bedSize`

- Tip: **alegere unica**
- Subtitlu actual: „Patul se construieste in jurul saltelei.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `S_90` | 90 × 200 | O persoana |  |  |
| 2 | `M_140` | 140 × 200 | Compact, 2 persoane |  |  |
| 3 | `Q_160` | 160 × 200 | Matrimonial standard |  |  |
| 4 | `K_180` | 180 × 200 | King |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Pat tapitat?”  `upholstered`

- Tip: **Da / Nu** · optionala
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Depozitare sub pat?”  `storage`

- Tip: **alegere unica**
- Subtitlu actual: „Lada rabatabila sau sertare laterale.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `NONE` | Fara | Structura simpla |  |  |
| 2 | `LIFT_UP` | Lada rabatabila | Salteaua se ridica pe pistoane |  |  |
| 3 | `DRAWERS` | Sertare laterale | Acces fara sa ridici salteaua |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Materialul cadrului (la pat tapitat, structura interioara).”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ai o schita a camerei?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — pozitia patului in camera.”
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Pat

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Pat

```
..............................................................
```

---

## Piesa: Comoda `PIECE_DRESSER` (flow v2)

### 1. „Cum e impartita comoda?”  `configuration`

- Tip: **alegere unica**
- Subtitlu actual: „Sertare, usi, sau amandoua.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `DRAWERS_ONLY` | Doar sertare | 3–6 sertare |  |  |
| 2 | `MIXED` | Sertare + usi | Combinatie |  |  |
| 3 | `DOORS_ONLY` | Doar usi | Polite in spate |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea si inaltimea comodei.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 0.6–2.5 m) · „Inaltime” (`height`, 0.6–1.4 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 3. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Materialul corpului si al fronturilor.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 5. „Sisteme de deschidere”  `openingSystems`

- Tip: **alegere multipla** · optionala
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `MANER` | Maner | Manere aplicate, la alegere |  |  |
| 2 | `PUSH` | Push (fara manere) | Deschidere prin apasare |  |  |
| 3 | `GLISANTE` | Glisante | Usi sau sertare pe sine |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ai o schita?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — peretele unde va sta comoda.”
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Comoda

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Comoda

```
..............................................................
```

---

## Piesa: Masa `PIECE_TABLE` (flow v2)

### 1. „Ce fel de masa?”  `tableType`

- Tip: **alegere unica**
- Subtitlu actual: „Destinatia decide dimensiunile si inaltimea.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `DINING` | Masa dining | Pentru servit masa |  |  |
| 2 | `COFFEE` | Masuta de cafea | Joasa, langa canapea |  |  |
| 3 | `CONSOLE` | Consola | Ingusta, decorativa |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Ce forma?”  `shape`

- Tip: **alegere unica**
- Subtitlu actual: „Dreptunghiulara, rotunda sau extensibila.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `RECTANGULAR` | Dreptunghiulara | Clasica |  |  |
| 2 | `ROUND` | Rotunda | Fara colturi |  |  |
| 3 | `EXTENDABLE` | Extensibila _(doar daca `tableType` = "DINING")_ | Se mareste la nevoie |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Cate persoane?”  `seats`

- Tip: **alegere unica**
- Apare doar daca: `tableType` = "DINING"
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `FOUR` | 4 |  |  |  |
| 2 | `SIX` | 6 |  |  |  |
| 3 | `EIGHT_PLUS` | 8+ |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Dimensiunile blatului.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Lungime” (`length`, 1.2–3 m) · „Latime” (`width`, 0.4–1.2 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 5. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Blatul de masa munceste cel mai mult — lemnul masiv e favoritul aici.”
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 6. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 7. „Ai o schita?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — spatiul unde va sta masa.”
- Pozitia actuala: 7 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Masa

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Masa

```
..............................................................
```

---

## Piesa: Pantofar `PIECE_SHOE_CABINET` (flow v2)

### 1. „Ce tip de pantofar?”  `style`

- Tip: **alegere unica**
- Subtitlu actual: „Mecanismul decide adancimea si capacitatea.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `SLIM_TILT` | Slim rabatabil | Adancime 17–25 cm |  |  |
| 2 | `STANDARD` | Standard cu rafturi | Adancime ~35 cm |  |  |
| 3 | `WITH_SEAT` | Cu bancuta | Te incalti sezand |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea si inaltimea pantofarului.”
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 0.4–2 m) · „Inaltime” (`height`, 0.5–2 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 3. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Zona de trafic — fronturile rezistente conteaza.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 4. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 5. „Ai o schita a holului?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — spatiul disponibil pe hol.”
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Pantofar

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Pantofar

```
..............................................................
```

---

## Piesa: Noptiera `PIECE_NIGHTSTAND` (flow v2)

### 1. „Ce stil de noptiera?”  `style`

- Tip: **alegere unica**
- Subtitlu actual: „Cu sertare, raft deschis sau suspendata.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `DRAWERS` | Cu sertare | 1–2 sertare |  |  |
| 2 | `OPEN_SHELF` | Raft deschis | Polita la vedere |  |  |
| 3 | `SUSPENDED` | Suspendata | Montata pe perete |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Cate noptiere?”  `count`

- Tip: **alegere unica**
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `ONE` | Una |  |  |  |
| 2 | `TWO` | Pereche (2) |  |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea unei noptiere.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 0.35–0.8 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „De regula asortat cu patul sau dulapul.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ai o schita?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — spatiul disponibil langa pat.”
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Noptiera

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Noptiera

```
..............................................................
```

---

## Piesa: Bancuta `PIECE_BENCH` (flow v2)

### 1. „Ce tip de bancuta?”  `style`

- Tip: **alegere unica**
- Subtitlu actual: „Cu lada, cu spatiu de pantofi, sau simpla.”
- Pozitia actuala: 1 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `WITH_STORAGE` | Cu lada | Sezutul se ridica |  |  |
| 2 | `WITH_SHOE_SPACE` | Cu spatiu pantofi | Raft deschis dedesubt |  |  |
| 3 | `SIMPLE` | Simpla | Doar sezut |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 2. „Sezut tapitat?”  `upholsteredSeat`

- Tip: **Da / Nu** · optionala
- Pozitia actuala: 2 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`

_Raspunsuri: Da / Nu._

### 3. „Dimensiuni”  `dimensions`

- Tip: **dimensiuni (metri)**
- Subtitlu actual: „Latimea bancutei.”
- Pozitia actuala: 3 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Campuri de dimensiuni: „Latime” (`width`, 0.6–2 m)._

**Etichete noi pentru campuri (daca vrei):** `________________________________`

### 4. „Ce material?”  `material`

- Tip: **alegere unica**
- Subtitlu actual: „Structura bancutei.”
- Pozitia actuala: 4 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

| # | Cod | Raspuns actual | Descriere actuala | Text nou | Pastram? |
|---|-----|----------------|-------------------|----------|----------|
| 1 | `PAL` | PAL | Economic, rezistent, multe decoruri |  |  |
| 2 | `MDF_INFOLIAT` | MDF infoliat | Folie PVC pe fronturi frezate, intretinere usoara |  |  |
| 3 | `MDF_VOPSIT` | MDF vopsit | Vopsea in orice culoare, mat sau lucios |  |  |
| 4 | `MDF_FURNIR` | MDF furniruit | Furnir de lemn natural pe suport stabil |  |  |
| 5 | `LEMN_MASIV` | Lemn masiv | Natural, durabil, cel mai premium |  |  |
| 6 | `ALTUL` | Altul | Scrie mai jos materialul dorit |  |  |

**Raspunsuri noi de adaugat:** `________________________________________`

### 5. „Ce material ai in minte?”  `materialOther`

- Tip: **text liber**
- Subtitlu actual: „Scrie pe scurt materialul sau finisajul dorit — atelierul va confirma disponibilitatea.”
- Apare doar daca: `material` = "ALTUL"
- Pozitia actuala: 5 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Text liber, maxim 120 caractere._

### 6. „Ai o schita?”  `sketch`

- Tip: **incarcare fisiere** · optionala
- Subtitlu actual: „Optional — spatiul unde va sta bancuta.”
- Pozitia actuala: 6 → **Ordine noua:** `____` · **Pastram?** `____`
- **Text nou intrebare:** `________________________________________`
- **Subtitlu nou:** `________________________________________`

_Incarcare fisiere: maxim 3._

### Intrebari NOI pentru Piesa: Bancuta

```
1. Intrebare: ................................................
   Tip (alegere unica / multipla / Da-Nu / text / dimensiuni): ...
   Raspunsuri: ................................................
   Dupa ce intrebare apare: ...................................
2. ...
```

### Observatii generale pentru Piesa: Bancuta

```
..............................................................
```

