import { describe, expect, it } from 'vitest';
import en from './en.json';
import ro from './ro.json';

// Etapa 8, problema 42 (i1): glosarul de termeni (docs/glosar.md). Variantele vechi nu mai apar
// in textele pentru client si firma. In afara glosarului: Admin* (D7 — texte interne) si Legal.*
// (textele juridice sunt versionate si acceptate de utilizatori; se schimba doar cu o versiune noua).

type Flat = Record<string, string>;
function flatten(o: unknown, prefix = '', acc: Flat = {}): Flat {
  if (typeof o === 'string') acc[prefix] = o;
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}.${k}` : k, acc);
  }
  return acc;
}

const RO = flatten(ro);
const EN = flatten(en);
const OUTSIDE = /^(Admin[A-Za-z]*|Legal)\./;

// Dupa acceptare se spune „comandă” / „order” (PO i1-3); referinta de plata ramane „Comanda {ref}” (D6).
const AFTER_ACCEPTANCE = [
  /^Fulfillment\./,
  /^Requests\.(statusValue\.CANCELLED|next\.(line|title|body)\.(ACCEPTED|IN_EXECUTION|DELIVERED_BY_COMPANY|COMPLETED|DISPUTED|CANCELLED))$/,
  /^(Marketplace|Lifecycle)\.claimStatus\.CANCELLED_PROJECT$/,
  /^(Quotes|Marketplace)\.apiErrors\.PROJECT_/,
  /^Quotes\.workspace\.clientHiddenRetention$/,
  /^Notifications\.type\.(delivery\.|project\.|execution\.|claim\.withdrawn_PROJECT_CANCELLED$)/,
  /^Billing\.bankTransfer\.referenceValue$/,
];
// „order” cu alt sens: „in this order” (ordinea intrebarilor)
const ORDER_OTHER_MEANING = new Set(['Configurator.cart.basketNext']);

interface Rule {
  name: string;
  re: RegExp;
  allowed?: (key: string) => boolean;
  // textul se curata inainte de verificare (de ex. „mobilier la comandă” = facut pe masura)
  strip?: RegExp;
}

const isAfterAcceptance = (k: string) => AFTER_ACCEPTANCE.some((r) => r.test(k));

const RO_RULES: Rule[] = [
  { name: 'atelier', re: /atelier/i },
  { name: 'SLA', re: /\bSLA\b/ },
  { name: 'sloturi', re: /\bslot/i },
  { name: 'RON', re: /\bRON\b/ },
  { name: 'marketplace', re: /marketplace/i },
  { name: 'Anulată (neatribuită)', re: /\(neatribuit[ăa]\)/i },
  { name: 'comandă înainte de acceptare', re: /\bcomand/i, strip: /la comand[ăa]/gi, allowed: isAfterAcceptance },
  { name: 'lucrare (= comanda)', re: /\blucrare(a)?\b/i, allowed: (k) => LUCRARE_OTHER_MEANING.has(k) },
  {
    name: 'proiectare cu plată — alte nume',
    re: /proiectare plătită|proiectare cu plată inclusă|include proiectare cu plată|ajutor la proiectare|cu proiectantul|contra cost/i,
  },
  // „ajutor” ca al doilea nume pentru proiectarea cu plata (revizuire M1)
  { name: 'ajutor (= proiectare cu plată)', re: /cer(i)? ajutor|bifa de ajutor|debifezi ajutorul|am nevoie de ajutor”|camera asta am nevoie de ajutor/i },
  // dupa acceptare: „comandă”, nu „proiect” (revizuire M3); „proiectare” e alt cuvant
  { name: 'proiect (= comanda acceptată)', re: /\bproiect(ul|ului)?(?![a-zăâîșț])/i, allowed: (k) => !isAfterAcceptance(k) },
  { name: 'Detalii generale', re: /detalii generale/i },
  { name: 'Am proiectul propriu', re: /proiectul propriu|proiect propriu/i },
  { name: 'Detaliile proiectului', re: /detaliile proiectului/i },
  { name: 'Locul montajului', re: /locul montajului/i },
  { name: 'Configurează-ți proiectul', re: /configureaz[ăa]-[țt]i proiectul/i },
  { name: 'Comandă nouă', re: /comand[ăa] nou[ăa]/i },
  { name: 'Sumar (numele pasului)', re: /\bsumar(ul)?\b/i },
];

// „lucrare” cu alt sens decat comanda: lucrarile din portofoliu, manopera din oferta, o expresie
const LUCRARE_OTHER_MEANING = new Set([
  'Quotes.workSubtotal', // subtotalul manoperei in oferta (inainte de acceptare)
  'Configurator.flows.LIVING.tvStyle.options.COMPLEX_UNIT.info.cons1', // „montajul e o lucrare în sine”
]);

const EN_RULES: Rule[] = [
  { name: 'workshop / atelier', re: /workshop|atelier/i },
  { name: 'SLA', re: /\bSLA\b/ },
  { name: 'slots', re: /\bslots?\b/i },
  { name: 'RON', re: /\bRON\b/ },
  { name: 'marketplace', re: /marketplace/i },
  { name: 'Cancelled (unassigned)', re: /\(unassigned\)/i },
  {
    name: 'order before acceptance',
    re: /\border(s|ed)?\b/i,
    allowed: (k) => isAfterAcceptance(k) || ORDER_OTHER_MEANING.has(k),
  },
  { name: 'paid design — other names', re: /paid design included|design help|with the designer|for a fee/i },
  { name: 'help (= paid design)', re: /ask for help|help box|untick the help|“I need help”|I need help with/i },
  { name: 'project (= accepted order)', re: /\bproject\b/i, allowed: (k) => !isAfterAcceptance(k) },
  { name: 'General info', re: /general info\b/i },
  { name: 'I have my own project', re: /i have my own project|has own project/i },
  { name: 'Project details', re: /project details/i },
  { name: 'Installation location', re: /installation location/i },
  { name: 'Configure your project', re: /configure your project/i },
  { name: 'Summary (step name)', re: /\bSummary\b|to summary/ },
];

function violations(flat: Flat, rules: Rule[]): string[] {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(flat)) {
    if (OUTSIDE.test(key)) continue;
    for (const rule of rules) {
      const value = rule.strip ? raw.replace(rule.strip, '') : raw;
      if (!rule.re.test(value)) continue;
      if (rule.allowed?.(key)) continue;
      out.push(`[${rule.name}] ${key} = ${raw}`);
    }
  }
  return out;
}

describe('glosar (problema 42) — termeni interzisi', () => {
  it('RO: nicio varianta veche in afara exceptiilor', () => {
    expect(violations(RO, RO_RULES)).toEqual([]);
  });

  it('EN: nicio varianta veche in afara exceptiilor', () => {
    expect(violations(EN, EN_RULES)).toEqual([]);
  });

  it('„atelier” / „workshop” lipsesc peste tot, inclusiv in Admin si Legal', () => {
    const all = [...Object.values(RO), ...Object.values(EN)];
    expect(all.filter((v) => /atelier|workshop/i.test(v))).toEqual([]);
  });

  it('exceptiile declarate exista inca (altfel se scot din lista)', () => {
    for (const k of [...LUCRARE_OTHER_MEANING, ...ORDER_OTHER_MEANING]) {
      expect(RO[k] ?? EN[k], k).toBeTypeOf('string');
    }
  });
});

// Etapa 12, problema 55 (i2): anglicismele scoase din romana nu revin; engleza e una singura (britanica).
// Argumentele ICU ({draft}, {color}) nu sunt text vazut de om, deci se scot inainte de verificare.
const ICU_ARGS = /\{[A-Za-z0-9_]+\}/g;
const RO_ENGLISH_WORDS: Rule[] = [
  { name: 'draft (= ciornă)', re: /\bdraft/i, strip: ICU_ARGS },
  { name: 'custom', re: /\bcustom/i },
  { name: 'atelier', re: /atelier/i },
  { name: 'showroom', re: /showroom/i },
  { name: 'live', re: /\blive\b/i },
  { name: 'King', re: /\bking\b/i },
  { name: 'click (= clic)', re: /\bclick/i },
  { name: 'slim (= îngust)', re: /\bslim\b/i },
  { name: 'Configurează: X (= Creează X)', re: /Configurează:/ },
  { name: 'Bancuță fără diacritice', re: /bancuț/i },
  // „amortizarea merită” se putea citi ca amortizarea investitiei (plan i2)
  { name: 'Amortizarea merită', re: /amortizarea merită/i },
];
// „pantry” ramane doar la coloanele de bucatarie (camara din bucatarie), nu ca nume al debaralei
const PANTRY_KITCHEN = new Set(['Configurator.flows.KITCHEN.cabinetZones.options.TALL_PANTRY.label']);
const CLIENT_FACING = /^(Configurator|Requests|Studio|Inspiration|Notifications\.stageUpdated|Fulfillment\.client[A-Za-z]*)\./;
const FIRM_OTHER_MEANING = new Set(['Configurator.config3d.catalog.options.FIRM']); // fermitatea pernei
const EN_BRITISH: Rule[] = [
  { name: 'maker (= company)', re: /\bmakers?\b/i },
  { name: 'closet (= dressing room)', re: /\bclosets?\b/i },
  { name: 'color (= colour)', re: /\bcolor/i, strip: ICU_ARGS },
  { name: 'center (= centre)', re: /\bcenters?\b/i },
  { name: 'meter (= metre)', re: /\b(centi|milli)?meters?\b/i },
  { name: 'gray (= grey)', re: /\bgray\b/i },
  { name: '-ize (= -ise)', re: /\b(minimiz|maximiz|organiz|customiz|favorit)/i },
  { name: 'Pantry (= Storage room)', re: /\bpantry\b/i, allowed: (k) => PANTRY_KITCHEN.has(k) },
  // m13: in tot en.json (in afara Admin* / Legal.*), nu doar in Studio; si „hookup” (= connection)
  { name: 'outlet (= socket)', re: /\boutlets?\b/i },
  { name: 'hookup (= connection)', re: /\bhook-?ups?\b/i },
  // revizuire M2: in textele pentru client se spune „company”. „Firm” = fermitatea pernei ramane.
  // Textele pentru firme (Marketplace, Quotes, Lifecycle, Nav, Penalties...) folosesc inca „firm” —
  // trecere separata, de hotarat de PO; regula le lasa deocamdata in afara.
  {
    name: 'firm (= company) in textele pentru client',
    re: /\bfirms?\b|\bfirm['’]s\b/i,
    allowed: (k) => !CLIENT_FACING.test(k) || FIRM_OTHER_MEANING.has(k),
  },
];

describe('glosar (problema 55) — anglicisme in romana, o singura engleza', () => {
  it('RO: fara draft, custom, atelier, showroom, live, King, click, slim', () => {
    expect(violations(RO, RO_ENGLISH_WORDS)).toEqual([]);
  });

  it('EN: engleza britanica, „company” in loc de „maker”, „Storage room” pentru debara', () => {
    expect(violations(EN, EN_BRITISH)).toEqual([]);
    expect(en.Configurator.rooms.type.PANTRY).toBe('Storage room');
    expect(en.Requests.roomType.PANTRY).toBe('Storage room');
    expect(ro.Configurator.rooms.type.PANTRY).toBe('Debara');
  });

  it('Studio spune „ciornă”, ca restul aplicatiei', () => {
    const studio = Object.entries(RO).filter(([k]) => k.startsWith('Studio.'));
    expect(studio.filter(([, v]) => /ciorn/i.test(v)).length).toBeGreaterThan(5);
    expect(ro.Studio.myDrafts).toBe('Ciornele mele');
  });

  it('regula ICU nu ascunde un cuvant interzis scris in text', () => {
    expect(violations({ 'X.a': 'Continuă ciorna: {draft}' }, RO_ENGLISH_WORDS)).toEqual([]);
    expect(violations({ 'X.a': 'Draft salvat {draft}' }, RO_ENGLISH_WORDS)).toHaveLength(1);
  });

  it('regula „firm”: prinde „the firm”, nu „confirm” / „firmly”; „Firm” la perna e permis', () => {
    expect(violations({ 'Configurator.a': 'Not sure — the firm will measure it' }, EN_BRITISH)).toHaveLength(1);
    expect(violations({ 'Configurator.a': 'Please confirm; it holds firmly' }, EN_BRITISH)).toEqual([]);
    expect(violations({ 'Configurator.config3d.catalog.options.FIRM': 'Firm' }, EN_BRITISH)).toEqual([]);
    expect(en.Configurator.pieces.firmDecidesShort).toBe('Company decides');
  });
});

// Etapa 12, problema 62 (c11): glosarul de piese si sablonul unic de titlu
describe('glosar de piese (problema 62)', () => {
  const C = ro.Configurator;
  it('o eticheta pe fiecare piesa (RO + EN), aceeasi in optiune si in titluri', () => {
    expect(C.rooms.type.PIECES).toBe('Altă piesă');
    expect(en.Configurator.rooms.type.PIECES).toBe('Other piece');
    expect(ro.Requests.roomType.PIECES).toBe('Altă piesă');
    // PO c11-1: camera „Birou”, piesa „Birou de lucru”
    expect(C.rooms.type.OFFICE).toBe('Birou');
    expect(C.rooms.type.PIECE_DESK).toBe('Birou de lucru');
    expect(C.flows.OFFICE.piecesNeeded.options.DESK.label).toBe('Birou de lucru');
    expect(C.rooms.type.PIECE_NIGHTSTAND).toBe('Noptieră');
    expect(C.flows.LIVING.piecesNeeded.options.TV_UNIT.label).toBe('Comodă TV');
    expect(C.flows.LIVING.materialTvUnit.title).toBe('Material — comodă TV');
    expect(en.Configurator.flows.LIVING.piecesNeeded.options.BOOKSHELF.label).toBe('Bookcase');
    expect(C.flows.LIVING.piecesNeeded.options.WALL_SHELVES.label).toBe('Rafturi de perete');
    expect(C.flows.OFFICE.piecesNeeded.options.WALL_SHELVES.label).toBe('Rafturi de perete');
    expect(C.flows.OFFICE.piecesNeeded.options.STORAGE.label).toBe('Dulap de depozitare');
    expect(C.flows.HALLWAY.piecesNeeded.options.BENCH.label).toBe('Băncuță');
    expect(C.flows.LIVING.piecesNeeded.options.OTHER.label).toBe('Altă piesă');
    for (const v of [C.flows.KITCHEN.layout.options.STRAIGHT.label, C.flows.DRESSING.layout.options.LINEAR.label, C.flows.PANTRY.wallsUsed.options.ONE_WALL.label]) {
      expect(v).toBe('Pe un perete');
    }
  });

  it('titlurile de material si deschidere au o singura forma: „Material — X”, „Material pentru fronturi — X”, „Deschidere — X”', () => {
    const titles = Object.entries(RO).filter(([k]) => /^Configurator\.flows\.[A-Z_]+\.(v\d+\.)?(material|systems|frontMaterial|openingSystems)[A-Za-z]*\.title$/.test(k));
    expect(titles.length).toBeGreaterThan(100);
    // formele vechi nu mai apar
    const old = titles.filter(([, v]) => /^(Ce material|Din ce material|Ce sistem|Ce sisteme|Sisteme de deschidere)|^Material pentru (?!fronturi|cadru|ramă)|^Deschidere pentru|Material pentru fronturile /.test(v));
    expect(old).toEqual([]);
  });

  it('o singura intrebare pentru piese si pentru schita camerei; titlurile 3D „Creează …”', () => {
    for (const room of ['BEDROOM', 'LIVING', 'OFFICE', 'BATHROOM', 'HALLWAY', 'LAUNDRY', 'BALCONY'] as const) {
      expect(C.flows[room].piecesNeeded.title, room).toBe('Ce piese îți trebuie?');
    }
    expect(C.flows.HALLWAY.sketch.title).toBe('Ai o schiță a holului?');
    const titles3d = Object.entries(RO).filter(([k]) => /^Configurator\.flows\.PIECE_[A-Z_]+\.config3d\.title$/.test(k));
    expect(titles3d.length).toBe(17);
    expect(titles3d.filter(([, v]) => !v.startsWith('Creează '))).toEqual([]);
  });
});

describe('glosar (problema 42) — termenii alesi', () => {
  it('formularul: titlul, modul, mesajul, adresa, datele generale, marimea, ultimul pas', () => {
    expect(ro.Configurator.title).toBe('Cerere nouă');
    expect(en.Configurator.title).toBe('New request');
    expect(ro.Configurator.kicker).toBe('Mobilier la comandă');
    expect(ro.Requests.field.hasOwnProject).toBe('Am deja un proiect');
    expect(ro.Configurator.start.OWN_PROJECT.title).toBe('Am deja un proiect');
    expect(ro.Requests.field.message).toBe('Mesaj pentru firme');
    expect(ro.Configurator.review.facts.description).toBe('Mesaj pentru firme');
    expect(ro.Configurator.review.facts.location).toBe('Adresa montajului');
    expect(ro.Requests.sectionAddress).toBe('Adresa montajului');
    expect(ro.Requests.sectionGeneral).toBe('Date generale');
    expect(ro.Configurator.phases.details).toBe('Date generale');
    expect(en.Configurator.phases.details).toBe('General details');
    expect(ro.Requests.size).toBe('Mărime');
    expect(ro.Configurator.phases.review).toBe('Verifică și publică');
    expect(ro.Configurator.review.title).toBe('Verifică și publică');
    expect(en.Configurator.phases.review).toBe('Review and publish');
  });

  it('proiectarea cu plata: un singur nume, cu drumul spus (firmele trimit intai pretul proiectarii)', () => {
    expect(ro.Configurator.start.DESIGN_HELP.badge).toBe('Proiectare cu plată');
    expect(ro.Configurator.cart.designHelpLegend).toBe('Proiectare cu plată');
    expect(ro.Marketplace.includesPaidDesign).toBe('Proiectare cu plată');
    expect(en.Marketplace.includesPaidDesign).toBe('Paid design');
    for (const v of [ro.Configurator.start.DESIGN_HELP.desc, ro.Configurator.cart.designHelpHint, ro.Requests.designHelpIncludedHint]) {
      expect(v).toContain('prețul proiectării');
    }
    expect(ro.Configurator.sheet.withDesigner).toBe('cu firma');
    // revizuire M1: dialogul de comutare spune limpede ca serviciul e cu plata, inainte de confirmare
    expect(ro.Configurator.designHelpSwitch.confirm).toBe('Da, cer proiectare cu plată');
    expect(ro.Configurator.designHelpSwitch.titleRoom).toContain('proiectare cu plată');
    expect(ro.Configurator.designHelpSwitch.body).toContain('prețul proiectării');
    expect(ro.Configurator.cart.designHelpRoom).toBe('Proiectare cu plată pentru camera asta');
  });

  it('revizuire: eticheta scurta nu contine un raspuns (M2), plural corect (m4), campul de strada (m2)', () => {
    expect(ro.Configurator.flows.BALCONY.enclosed.summaryLabel).toBe('Tip de balcon');
    expect(en.Configurator.flows.BALCONY.enclosed.summaryLabel).toBe('Balcony type');
    expect(ro.Configurator.pieces.quantityMax).toContain('other {Cel mult # de bucăți.}');
    expect(ro.Requests.field.street).toBe('Stradă și număr');
    expect(ro.Requests.field.addressText).toBe('Adresa montajului');
  });

  it('firma: „Cereri disponibile”, „Locuri ocupate”, „Termen de răspuns”', () => {
    expect(ro.Nav.marketplace).toBe('Cereri disponibile');
    expect(en.Nav.marketplace).toBe('Available requests');
    expect(ro.Marketplace.title).toBe('Cereri disponibile');
    expect(ro.Marketplace.slots).toBe('Locuri ocupate {active} din {max}');
    expect(en.Marketplace.slots).toBe('{active} of {max} places taken');
    expect(ro.Marketplace.full).toBe('Toate locurile ocupate');
    expect(ro.Quotes.workspace.slaLabel).toBe('Termen de răspuns');
    expect(ro.Marketplace.claimStatus.CANCELLED_UNASSIGNED).toBe('Anulată: nu a fost atribuită la timp');
    expect(ro.Requests.statusValue.IN_MARKETPLACE).toBe('Disponibilă firmelor');
    expect(en.Requests.statusValue.IN_MARKETPLACE).toBe('Open to companies');
  });

  it('plati: „plată”, dar referinta din transfer ramane „Comanda {ref}” (D6); „lei” si in engleza (D10)', () => {
    expect(ro.Billing.orders).toBe('Plăți și facturi');
    expect(ro.Billing.bankTransfer.referenceValue).toBe('Comanda {ref}');
    expect(en.Common.money).toBe('{amount} lei');
  });
});
