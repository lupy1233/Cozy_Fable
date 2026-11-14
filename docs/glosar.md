# Glosar — cuvintele pe care le folosim în aplicație

Un singur nume pentru un singur lucru. Folosește lista asta când scrii orice text nou (ecran, buton,
mesaj de eroare, e-mail, notificare), în română și în engleză. Stabilită la etapa 8 a reparațiilor
(problema 42, `i1`), după răspunsurile proprietarului produsului (i1-1, i1-2, i1-3).

Reguli generale:

- Româna se scrie cu diacritice. Textele sunt simple și directe, fără jargon și fără englezisme.
- Se spune **„firmă”**, niciodată „atelier” (nici „workshop” în engleză). Regulă permanentă.
- Se schimbă doar cuvintele, nu sensul: un text trebuie să spună adevărul despre ce face aplicația azi.
- Codurile rămân cum sunt: cheile JSON, valorile din baza de date (`IN_MARKETPLACE`, `SLA_EXPIRED`),
  adresele (`/marketplace`). Glosarul se aplică doar textului văzut de oameni.
- În afara glosarului: ecranele de administrare (`Admin*`, texte interne) și textele juridice
  (`Legal.*`: Termeni, Confidențialitate, Reguli pentru firme — se schimbă doar cu o versiune nouă a lor).

## Termenii

| Termenul ales (RO / EN) | Ce înseamnă | Nu se mai folosește |
|---|---|---|
| **cerere** / request | Ce publică clientul, până acceptă o ofertă. | „comandă” / „order” înainte de acceptare |
| **comandă** / order | Același lucru, DUPĂ ce clientul a acceptat o ofertă (a comandat). Ex.: „Comandă livrată”, „Comanda a fost anulată”. | „lucrare”, „proiect” (pentru lucrul acceptat), „job” |
| **plată** / payment | Ce plătește firma pentru credite sau abonament, în portofel și facturare. | „comandă” / „order” la plățile firmei |
| **Cerere nouă** / New request | Titlul formularului. Deasupra: „Mobilier la comandă” / „Custom furniture”. | „Configurează-ți proiectul”, „Comandă nouă” |
| **Am deja un proiect** / I already have a project | Modul în care clientul are deja proiectul tehnic. | „Am proiectul propriu”, „Proiect propriu” |
| **Mesaj pentru firme** / Message for companies | Câmpul liber din Date generale, citit de firme. | „Detaliile proiectului”, „Descriere” (pentru același câmp) |
| **Adresa montajului** / Installation address | Unde se montează mobilierul (titlul secțiunii și rândul de pe pagina cererii). Câmpul de completat din formular se numește „Stradă și număr” / „Street and number”. | „Locul montajului”, „Adresă” ca titlu |
| **Date generale** / General details | Ecranul cu buget, termen, adresă, contact, mesaj. | „Detalii generale”, „General info” |
| **Mărime** / Size | Mărimea cererii: mică, medie, mare. | „Dimensiune” (dimensiunile sunt măsurile fizice) |
| **lei** | Moneda, și în textele în engleză. | „RON” în texte |
| **Verifică și publică** / Review and publish | Ultimul pas al formularului. Butonul spre el: „Spre verificare” / „To review”. La editarea unei cereri publicate: „Verifică și salvează” / „Review and save”. | „Sumar” / „Summary” ca nume de pas |
| **Fișa cererii** / Request sheet | Rezumatul cererii de lângă formular și de pe pagina cererii. | „Fișa proiectului” |
| **Proiectare cu plată** / Paid design | Clientul plătește firma ca să proiecteze piesele împreună. Se spune și drumul: „Firmele îți trimit întâi prețul proiectării și ce include; apoi alegi firma cu care proiectezi piesele.” În mijlocul propoziției se scrie cu literă mică. Bifa și confirmările spun „proiectare cu plată”, ca omul să știe că plătește înainte să confirme. | „Proiectare plătită”, „Proiectare cu plată inclusă”, „Ajutor la proiectare”, „cer ajutor”, „bifa de ajutor”, „contra cost”, „Design help”, „ask for help” |
| **cu firma** / with the company | Cine stabilește detaliile la proiectarea cu plată. | „cu proiectantul”, „with the designer” |
| **Cereri disponibile** / Available requests | Ecranul (și meniul) firmei cu cererile pe care le poate prelua. | „Marketplace”, „Piață” |
| **cererea ajunge la firmele din zonă** | Ce i se spune clientului la publicare. Starea: „Disponibilă firmelor” / „Open to companies”. | „trimiți cererea în marketplace”, „În marketplace” |
| **Locuri ocupate {active} din {max}** / {active} of {max} places taken | Câte firme au preluat cererea din câte pot. Plin: „Toate locurile ocupate”. | „Sloturi”, „Slots” |
| **Termen de răspuns** / Response deadline | Timpul firmei pentru a trimite oferta după preluare. | „SLA”, „Termen ofertă (SLA)”, „SLA în pauză” |
| **Anulată: nu a fost atribuită la timp** / Cancelled: not assigned in time | Preluarea anulată pentru că nimeni din echipă nu a primit-o. | „Anulată (neatribuită)” |
| **Ce vrei să mobilezi?** / What do you want to furnish? | Titlul coșului; subtitlul pomenește camerele și piesele. | „Ce camere vrei să mobilezi?” |
| **Istoric credite** / Credit history | Secțiunea din portofel cu fiecare mișcare de credite a firmei (etapa 9). O mișcare fără nume cunoscut: „Altă mișcare” / „Other movement”. | — |
| **Anulează plata** / Cancel payment | Firma își anulează plata în așteptare, înainte de „Am plătit” (etapa 9). | „Anulează comanda” la plățile firmei |
| **Republică cu modificări** / Repost with changes | Clientul republică o cerere expirată, o singură dată, cu formularul schimbat; butonul de salvare: „Republică cu modificările” / „Repost with these changes” (etapa 9). | — |
| **Reîncadrează** / Reframe | Butonul din scena 3D care aduce piesa întreagă în cadru (etapa 9). | — |

Etichetele scurte din Sumar și din Fișă numesc întrebarea, nu un răspuns: „Tip de balcon: Deschis”,
nu „Balcon închis: Deschis”.

## Excepții (rămân așa)

- „Nu știu exact ce vreau — am nevoie de ajutor” — titlul cartonașului de pornire descrie situația
  clientului; insigna de sub el spune „Proiectare cu plată”.

- „mobilier **la comandă**” — înseamnă „făcut pe măsură”, nu comanda după acceptare.
- Referința din transferul bancar, **„Comanda {ref}”**, rămâne neschimbată: firma o scrie în
  ordinul de plată, iar echipa o caută în extrasul băncii.
- „in this order” în engleză (ordinea întrebărilor) — alt sens al cuvântului.
- „lucrare” cu alt sens: lucrările din portofoliul firmei, subtotalul manoperei din ofertă
  („Subtotal lucrare”), expresia „montajul e o lucrare în sine”.
- Textele pentru firmă generate din cod în `packages/shared` (descrierea camerelor) sunt înghețate;
  ele nu conțin termenii interziși.

## Verificare automată

Testul `apps/frontend/src/messages/glossary.test.ts` caută variantele vechi în `ro.json` și `en.json`
și pică dacă apar în afara excepțiilor de mai sus. Un termen nou în glosar = o regulă nouă în test.
