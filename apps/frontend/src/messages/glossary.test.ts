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
