#!/usr/bin/env node
// „Cosmetizeaza” datele demo din DB-ul LOCAL ca ecranele filmate sa arate ca un
// marketplace real: nume de firme/oameni, titluri cu diacritice, cereri cu titluri
// si descrieri naturale, oferte diferite (Versiunea 2 la Atelier Nord), chat criptat
// ca in productie, recenzii, notificari, portofolii, fisiere atasate, 3 cereri noi
// langa Bucuresti pentru feed-ul lui owner.a. NU atinge fisiere din repo.
//
// Se ruleaza pe starea de dupa setup (snapshot-base): ./reset-db.sh --base && node tools/polish-data.mjs
// Idempotent (update-uri pe ID-uri fixe, insert-uri cu ID-uri fixe).
import { createRequire } from 'node:module';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(REPO, 'apps/backend/package.json'));
process.env.DATABASE_URL ||= 'postgresql://marketplace:marketplace@localhost:5432/marketplace';
const { PrismaClient, Prisma } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const prisma = new PrismaClient();

// ---------- utilitare ----------
const H = 3600e3;
const D = 24 * H;
const ago = (ms) => new Date(Date.now() - ms);
const ahead = (ms) => new Date(Date.now() + ms);
const env = Object.fromEntries(
  readFileSync(join(REPO, 'apps/backend/.env'), 'utf8').split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const KEY = env.MESSAGE_ENCRYPTION_KEY ? Buffer.from(env.MESSAGE_ENCRYPTION_KEY, 'hex') : null;
// acelasi format ca MessageCryptoService: enc.v1.<iv b64url>.<ciphertext+tag b64url>
function encrypt(plain) {
  if (!KEY) return plain;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final(), c.getAuthTag()]);
  return `enc.v1.${iv.toString('base64url')}.${enc.toString('base64url')}`;
}
const log = (...a) => console.log('[polish]', ...a);

// ---------- 1. firme ----------
const COMPANIES = [
  { old: 'A Mobila Premium', name: 'Atelier Nord', cui: 'RO38471205', reg: 'J40/11842/2017', addr: 'Str. Fabrica de Glucoză 21, Sector 2', city: 'București', county: 'București', lat: 44.4745, lng: 26.118, since: '2023-04-12' },
  { old: 'B DesignWood', name: 'DesignWood Studio', cui: 'RO36120984', reg: 'J40/5521/2016', addr: 'Bd. Timișoara 104, Sector 6', city: 'București', county: 'București', lat: 44.425, lng: 26.013, since: '2022-10-03' },
  { old: 'C CasaMea', name: 'CasaMea Mobilier', cui: 'RO40218877', reg: 'J12/3390/2019', addr: 'Str. Fabricii 46', city: 'Cluj-Napoca', county: 'Cluj', lat: 46.78, lng: 23.562, since: '2024-02-19' },
  { old: 'D Atelier Bucov', name: 'Atelier Bucov', cui: 'RO45790213', reg: 'J40/7719/2022', addr: 'Șos. Berceni 96, Sector 4', city: 'București', county: 'București', lat: 44.386, lng: 26.12, since: '2026-09-14' },
  { old: 'E Lemn & Stil', name: 'Lemn & Stil', cui: 'RO43125570', reg: 'J08/1502/2021', addr: 'Str. Zizinului 110', city: 'Brașov', county: 'Brașov', lat: 45.642, lng: 25.619, since: '2026-09-18' },
  { old: 'F FastFurniture', name: 'FastFurniture', cui: 'RO44310982', reg: 'J22/2877/2021', addr: 'Str. Păcurari 138', city: 'Iași', county: 'Iași', lat: 47.17, lng: 27.557, since: '2026-07-20' },
  { old: 'G MobMaster', name: 'MobMaster', cui: 'RO39904417', reg: 'J35/4120/2018', addr: 'Calea Aradului 58', city: 'Timișoara', county: 'Timiș', lat: 45.772, lng: 21.224, since: '2024-05-02' },
  { old: 'H VintageHaus', name: 'VintageHaus', cui: 'RO37755102', reg: 'J40/9930/2017', addr: 'Str. Maria Rosetti 32, Sector 2', city: 'București', county: 'București', lat: 44.441, lng: 26.106, since: '2023-09-01' },
  // sursa pozelor de inspiratie din seed — fara numele real nicaieri
  { old: 'Mobila Unicat', name: 'Atelier Stejar', cui: 'RO41877350', reg: 'J23/2204/2020', addr: 'Str. Nufărului 7', city: 'Otopeni', county: 'Ilfov', lat: 44.55, lng: 26.0706, since: '2024-06-10' },
];
const co = {}; // cheie scurta (A..H, S) → id
for (const c of COMPANIES) {
  const row = await prisma.company.findFirst({ where: { name: { in: [c.old, c.name] } } });
  if (!row) throw new Error(`firma lipsa: ${c.old}`);
  co[c.old === 'Mobila Unicat' ? 'S' : c.old[0]] = row.id;
  await prisma.company.update({
    where: { id: row.id },
    data: { name: c.name, cui: c.cui, regComNumber: c.reg, addressText: c.addr, city: c.city, county: c.county, lat: c.lat, lng: c.lng, createdAt: new Date(`${c.since}T09:00:00Z`) },
  });
  await prisma.companyLocation.updateMany({
    where: { companyId: row.id },
    data: { addressText: c.addr, city: c.city, county: c.county, lat: c.lat, lng: c.lng },
  });
}
log('firme redenumite');

// ---------- 2. oameni ----------
const NAMES = {
  'admin@demo.ro': 'Administrator', 'radu.stanescu@demo.ro': 'Radu Stănescu',
  'owner.a@demo.ro': 'Andrei Albu', 'mgr.a@demo.ro': 'Bogdan Anghel', 'trusted1.a@demo.ro': 'Cristina Vlad',
  'trusted2.a@demo.ro': 'Dan Mocanu', 'managed.a@demo.ro': 'Elena Stoica',
  'owner.b@demo.ro': 'Florin Barbu', 'mgr.b@demo.ro': 'Gina Bratu', 'trusted1.b@demo.ro': 'Sorin Toma',
  'trusted2.b@demo.ro': 'Irina Pop', 'trusted3.b@demo.ro': 'Victor Neagu',
  'owner.c@demo.ro': 'Călin Chirilă', 'owner.d@demo.ro': 'Doru Dinu', 'owner.e@demo.ro': 'Emil Enache',
  'owner.f@demo.ro': 'Fănel Florea', 'owner.g@demo.ro': 'Gelu Georgescu', 'owner.h@demo.ro': 'Horia Hodoș',
};
const PHONES = {
  'ana.popescu@demo.ro': '0722 481 305', 'elena.dumitru@demo.ro': '0745 219 876', 'mihai.ionescu@demo.ro': '0733 902 114',
  'radu.stanescu@demo.ro': '0756 330 478', 'ioana.marinescu@demo.ro': '0726 118 590',
  'andreea.stan@demo.ro': '0741 552 903', 'mihnea.pavel@demo.ro': '0731 264 718', 'sorina.matei@demo.ro': '0768 410 295',
  'owner.a@demo.ro': '0721 300 417', 'owner.b@demo.ro': '0744 610 285', 'owner.c@demo.ro': '0752 118 904',
};
for (const [email, name] of Object.entries(NAMES)) await prisma.user.update({ where: { email }, data: { name } });

// clienti noi pentru cererile din feed-ul lui owner.a (aceeasi parola ca restul conturilor demo)
const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana.popescu@demo.ro' } });
const NEW_CLIENTS = [
  { id: '370563b7-2156-4a0b-ba20-82862d70313d', email: 'andreea.stan@demo.ro', name: 'Andreea Stan' },
  { id: 'f9d76b94-1786-4952-bef7-615b584f3c1e', email: 'mihnea.pavel@demo.ro', name: 'Mihnea Pavel' },
  { id: '6d4574bc-31a8-4517-9212-0f1babd5b3d3', email: 'sorina.matei@demo.ro', name: 'Sorina Matei' },
];
for (const c of NEW_CLIENTS) {
  await prisma.user.upsert({
    where: { email: c.email },
    update: { name: c.name },
    create: { id: c.id, email: c.email, name: c.name, role: 'CLIENT', passwordHash: ana.passwordHash, emailVerifiedAt: ago(40 * D), createdAt: ago(40 * D) },
  });
}
const U = Object.fromEntries((await prisma.user.findMany({ where: { email: { endsWith: '@demo.ro' } } })).map((u) => [u.email, u]));
for (const [email, phone] of Object.entries(PHONES)) await prisma.user.update({ where: { email }, data: { phone } });
log('oameni redenumiti, clienti noi:', NEW_CLIENTS.map((c) => c.email).join(', '));

// ---------- 3. cereri ----------
const BUC = { city: 'București', county: 'București' };
const TM = { city: 'Timișoara', county: 'Timiș', lat: 45.757, lng: 21.229, addr: 'Str. Mărășești 12, ap. 5' };
const CJ = { city: 'Cluj-Napoca', county: 'Cluj', lat: 46.758, lng: 23.598, addr: 'Str. Observatorului 34, ap. 22' };
const IS = { city: 'Iași', county: 'Iași', lat: 47.164, lng: 27.581, addr: 'Bd. Ștefan cel Mare și Sfânt 8, ap. 14' };
const it = (name, material, systems, quantity = 1, description = null) => ({ name, material, systems, quantity, description });

// id → continut. size/score/cost doar pentru cererile publicate (PO r5: 1 credit = 1.000 lei din bugetul minim)
const REQ = {
  // R1 DRAFT (ioana)
  'c6e5d0d9-f252-47c6-b6b6-7bcd10b9e4d6': {
    title: 'Dressing pe colț · Brașov', client: 'ioana.marinescu@demo.ro',
    description: 'Vreau un dressing în L în camera mică de lângă dormitor: bară de haine pe două niveluri, sertare pentru lenjerie și un colț pentru pantofi.',
    budget: 'FROM_5K_TO_15K', est: 9000, deadline: 'THREE_TO_SIX_MONTHS', addr: 'Str. Lungă 204, ap. 3', city: 'Brașov', county: 'Brașov', lat: 45.648, lng: 25.6,
    room: [2.4, 1.8, 2.55], items: [it('Modul cu bară de haine dublă', 'PAL', [], 2), it('Corp cu sertare pentru lenjerie', 'PAL', ['PUSH']), it('Raft pentru pantofi', 'PAL', [])],
  },
  // R2 IN_MARKETPLACE (ana) — feed owner.a: Mare · 25 credite
  'ce41d9a4-f5fe-4995-b733-c3a812dff6cc': {
    title: 'Bucătărie în L cu insulă · București', client: 'ana.popescu@demo.ro',
    description: 'Bucătărie în L de 3,6 × 2,4 m, cu insulă de 120 cm pentru micul dejun. Fronturi albe mate fără mânere (profil Gola), blat de stejar; electrocasnicele încorporabile le am deja.',
    budget: 'OVER_15K', est: 28000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Brașov 23, bl. C4, ap. 18, Sector 6', ...BUC, lat: 44.423, lng: 26.033,
    size: 'LARGE', score: 34, cost: 25, published: 2 * D, expires: 4 * D,
    room: [3.6, 2.4, 2.6], items: [it('Corpuri inferioare', 'MDF_VOPSIT', ['GOLA'], 6), it('Corpuri superioare', 'MDF_VOPSIT', ['PUSH', 'AVENTOS'], 4), it('Insulă cu sertare, 120 cm', 'MDF_VOPSIT', ['GOLA']), it('Coloană cuptor + frigider', 'MDF_VOPSIT', ['PUSH'], 2)],
  },
  // R3 IN_MARKETPLACE (radu)
  'acdab62e-4422-4a98-adbc-facbe7189b96': {
    title: 'Perete TV cu bibliotecă · Iași', client: 'radu.stanescu@demo.ro',
    description: 'Perete TV de 3,2 m cu comodă suspendată, nișă iluminată pentru televizor și bibliotecă deschisă pe o parte. Finisaj stejar natural combinat cu alb.',
    budget: 'FROM_5K_TO_15K', est: 11000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Păcurari 71, ap. 9', city: 'Iași', county: 'Iași', lat: 47.169, lng: 27.568,
    size: 'MEDIUM', score: 20, cost: 11, published: 3 * D, expires: 3 * D,
    room: [4.2, 3.6, 2.7], items: [it('Comodă TV suspendată, 240 cm', 'MDF_FURNIR', ['PUSH']), it('Panou riflat pentru TV', 'MDF_FURNIR', []), it('Bibliotecă laterală', 'PAL', [])],
  },
  // R4 IN_MARKETPLACE (elena)
  'cd6ae90b-a4b7-4b69-b919-97d90ddda1f9': {
    title: 'Birou acasă cu rafturi · Timișoara', client: 'elena.dumitru@demo.ro',
    description: 'Birou de 160 cm sub fereastră, cu casetieră pe rotile și rafturi deasupra pentru dosare și cărți. Culori deschise, fără mânere vizibile.',
    budget: 'FROM_5K_TO_15K', est: 6500, deadline: 'FLEXIBLE', addr: TM.addr, city: TM.city, county: TM.county, lat: TM.lat, lng: TM.lng,
    size: 'SMALL', score: 12, cost: 6, published: 4 * D, expires: 2 * D,
    room: [3.0, 2.6, 2.6], items: [it('Blat de birou, 160 cm', 'PAL', []), it('Casetieră cu 3 sertare, pe rotile', 'PAL', ['PUSH']), it('Rafturi suspendate', 'PAL', [], 3)],
  },
  // R5 CLAIMED_PARTIAL (ana) — fisa de lucru a lui owner.a (claim 861163e7), FARA oferta
  'acb6df7f-372d-4184-ac80-4b564fcd62af': {
    title: 'Dormitor: dulap și noptiere · București', client: 'ana.popescu@demo.ro',
    description: 'Dulap de 240 cm până în tavan, cu uși glisante albe mate, bară de haine și sertare interioare, plus două noptiere suspendate asortate. Am atașat schița camerei cu cotele și o poză cu modelul care îmi place.',
    budget: 'FROM_5K_TO_15K', est: 12000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Ion Câmpineanu 18, ap. 12, Sector 1', ...BUC, lat: 44.438, lng: 26.0985,
    size: 'MEDIUM', score: 18, cost: 12, published: 5 * D, expires: 2 * D,
    room: [3.8, 3.2, 2.6], items: [it('Dulap cu uși glisante, 240 × 260 cm', 'MDF_VOPSIT', ['GLISANTE'], 1, 'Interior: bară de haine pe 2/3 din lățime, rafturi și 3 sertare pe 1/3'), it('Noptieră suspendată cu sertar', 'MDF_VOPSIT', ['PUSH'], 2)],
  },
  // R6 CLAIMED_PARTIAL (mihai)
  '550fa730-217b-4d31-8e1f-1446c6ad5112': {
    title: 'Bucătărie dreaptă cu blat de lemn · Cluj-Napoca', client: 'mihai.ionescu@demo.ro',
    description: 'Bucătărie dreaptă de 3,2 m pentru un apartament nou: fronturi verde salvie, blat din lemn masiv de stejar și corpuri superioare până în tavan.',
    budget: 'OVER_15K', est: 17000, deadline: 'THREE_TO_SIX_MONTHS', addr: 'Str. Bucium 5, ap. 31', city: CJ.city, county: CJ.county, lat: 46.748, lng: 23.575,
    size: 'LARGE', score: 32, cost: 17, published: 4 * D, expires: 2 * D,
    room: [3.2, 2.4, 2.7], items: [it('Corpuri inferioare', 'MDF_VOPSIT', ['MANER'], 5), it('Corpuri superioare până în tavan', 'MDF_VOPSIT', ['MANER'], 5), it('Blat stejar masiv, 320 cm', 'LEMN_MASIV', [])],
  },
  // R7 CLAIMED_FULL (radu)
  'e540bd37-8980-4a66-a2f0-09b7fc29351d': {
    title: 'Dressing walk-in · Iași', client: 'radu.stanescu@demo.ro',
    description: 'Cameră de 2,2 × 2,6 m transformată în dressing walk-in: bare de haine pe trei pereți, insulă cu sertare și oglindă, iluminare LED pe profil.',
    budget: 'OVER_15K', est: 16000, deadline: 'ONE_TO_THREE_MONTHS', addr: IS.addr, city: IS.city, county: IS.county, lat: IS.lat, lng: IS.lng,
    size: 'MEDIUM', score: 26, cost: 16, published: 5 * D, expires: 3 * D,
    room: [2.6, 2.2, 2.6], items: [it('Module cu bară de haine', 'PAL', [], 4), it('Insulă cu sertare', 'MDF_VOPSIT', ['PUSH']), it('Oglindă cu ramă', 'ALTUL', [])],
  },
  // R8 CLAIMED_FULL (elena)
  'c2d8ccd7-1061-448c-92db-99520fb91fb3': {
    title: 'Bucătărie în U, fronturi mate · Timișoara', client: 'elena.dumitru@demo.ro',
    description: 'Bucătărie în U pentru casă, 4,2 m desfășurat: fronturi antracit mate, profil Gola, blat din compozit alb și o coloană de cămară.',
    budget: 'OVER_15K', est: 30000, deadline: 'THREE_TO_SIX_MONTHS', addr: 'Str. Liviu Rebreanu 45', city: TM.city, county: TM.county, lat: 45.739, lng: 21.241,
    size: 'LARGE', score: 38, cost: 30, published: 5 * D, expires: 3 * D,
    room: [4.2, 3.0, 2.7], items: [it('Corpuri inferioare', 'MDF_VOPSIT', ['GOLA'], 8), it('Corpuri superioare', 'MDF_VOPSIT', ['AVENTOS'], 5), it('Coloană cămară', 'MDF_VOPSIT', ['PUSH'])],
  },
  // R9 OFFERS_RECEIVED (elena) — comparatia cu 3 oferte
  '1d02bcae-ce2d-4ce6-9793-40f2652b146c': {
    title: 'Mobilier baie suspendat · Timișoara', client: 'elena.dumitru@demo.ro',
    description: 'Mobilier pentru baia principală: corp suspendat de 120 cm sub lavoar, dulap-coloană pentru prosoape și oglindă cu iluminare. Aș vrea și proiectarea 3D înainte de execuție.',
    budget: 'FROM_5K_TO_15K', est: 9500, deadline: 'ONE_TO_THREE_MONTHS', addr: TM.addr, city: TM.city, county: TM.county, lat: TM.lat, lng: TM.lng,
    size: 'SMALL', score: 13, cost: 9, published: 7 * D, expires: 2 * D,
    room: [2.4, 1.9, 2.5], items: [it('Corp suspendat sub lavoar, 120 cm', 'MDF_VOPSIT', ['PUSH']), it('Dulap-coloană pentru prosoape', 'MDF_VOPSIT', ['PUSH']), it('Oglindă cu iluminare LED', 'ALTUL', [])],
  },
  // R10 NEGOTIATION (mihai)
  '80afad85-9640-418b-bf79-0d82e2447f75': {
    title: 'Living cu perete TV riflat · Cluj-Napoca', client: 'mihai.ionescu@demo.ro',
    description: 'Perete TV de 3,6 m cu panouri riflate din furnir de stejar, comodă suspendată și două vitrine laterale cu sticlă fumurie.',
    budget: 'FROM_5K_TO_15K', est: 14000, deadline: 'ONE_TO_THREE_MONTHS', addr: CJ.addr, city: CJ.city, county: CJ.county, lat: CJ.lat, lng: CJ.lng,
    size: 'MEDIUM', score: 22, cost: 14, published: 8 * D, expires: 2 * D,
    room: [4.8, 3.9, 2.7], items: [it('Panouri riflate', 'MDF_FURNIR', []), it('Comodă TV suspendată', 'MDF_FURNIR', ['PUSH']), it('Vitrine laterale cu sticlă fumurie', 'MDF_FURNIR', ['MANER'], 2)],
  },
  // R11 IN_EXECUTION (ana) — Atelier Nord
  'ed8f289d-16ed-4546-b1e4-a2339490965e': {
    title: 'Bucătărie albă cu blat de stejar · București', client: 'ana.popescu@demo.ro',
    description: 'Bucătărie în L pentru apartamentul din Titan: fronturi albe mate, blat de stejar masiv și corpuri superioare cu deschidere Aventos.',
    budget: 'OVER_15K', est: 24000, deadline: 'ASAP', addr: 'Bd. Nicolae Grigorescu 29, ap. 41, Sector 3', ...BUC, lat: 44.425, lng: 26.164,
    size: 'LARGE', score: 34, cost: 24, published: 21 * D, expires: -10 * D,
    room: [3.4, 2.6, 2.6], items: [it('Corpuri inferioare', 'MDF_VOPSIT', ['PUSH'], 6), it('Corpuri superioare', 'MDF_VOPSIT', ['AVENTOS'], 4), it('Blat stejar masiv', 'LEMN_MASIV', [])],
  },
  // R12 DELIVERED_BY_COMPANY (elena) — DesignWood Studio
  'c95f9758-bf1c-45e8-af43-6969793c4c44': {
    title: 'Dulap dormitor cu uși glisante · Timișoara', client: 'elena.dumitru@demo.ro',
    description: 'Dulap de 280 cm cu uși glisante din oglindă și MDF bej, interior cu bară de haine, rafturi și sertare.',
    budget: 'FROM_5K_TO_15K', est: 13000, deadline: 'ONE_TO_THREE_MONTHS', addr: TM.addr, city: TM.city, county: TM.county, lat: TM.lat, lng: TM.lng,
    size: 'MEDIUM', score: 20, cost: 13, published: 40 * D, expires: -30 * D,
    room: [3.6, 3.1, 2.6], items: [it('Dulap cu uși glisante, 280 cm', 'MDF_VOPSIT', ['GLISANTE'], 1, 'O ușă cu oglindă, două din MDF bej')],
  },
  // R13 COMPLETED 5★ (mihai) — Atelier Nord
  '5dcd35ab-79e9-4455-859f-5bbea0ff1981': {
    title: 'Bucătărie verde salvie · Cluj-Napoca', client: 'mihai.ionescu@demo.ro',
    description: 'Bucătărie dreaptă de 3,4 m cu fronturi verde salvie, mânere din alamă și blat din lemn de stejar.',
    budget: 'OVER_15K', est: 18000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Republicii 61, ap. 4', city: CJ.city, county: CJ.county, lat: 46.762, lng: 23.588,
    size: 'MEDIUM', score: 24, cost: 18, published: 75 * D, expires: -65 * D,
    room: [3.4, 2.5, 2.6], items: [it('Corpuri inferioare', 'MDF_VOPSIT', ['MANER'], 5), it('Corpuri superioare', 'MDF_VOPSIT', ['MANER'], 4), it('Blat stejar', 'LEMN_MASIV', [])],
  },
  // R14 DISPUTED 2★ (radu) — CasaMea Mobilier
  'f3439556-1298-4e50-8620-e3d616d52549': {
    title: 'Birou cu bibliotecă integrată · Iași', client: 'radu.stanescu@demo.ro',
    description: 'Birou de lucru pe colț, cu bibliotecă integrată până în tavan și un dulap închis pentru imprimantă. Include proiectare 3D.',
    budget: 'OVER_15K', est: 16500, deadline: 'ONE_TO_THREE_MONTHS', addr: IS.addr, city: IS.city, county: IS.county, lat: IS.lat, lng: IS.lng,
    size: 'LARGE', score: 31, cost: 16, published: 60 * D, expires: -50 * D,
    room: [3.2, 2.8, 2.7], items: [it('Birou pe colț', 'PAL', []), it('Bibliotecă până în tavan', 'PAL', []), it('Dulap închis pentru imprimantă', 'PAL', ['MANER'])],
  },
  // R15 EXPIRED (radu)
  'c12c33ef-7f0e-4234-8c3d-d28d6b388ce9': {
    title: 'Dulap hol cu pantofar · Iași', client: 'radu.stanescu@demo.ro',
    description: 'Dulap de hol de 180 cm cu pantofar înclinat, cuier deschis și o băncuță.',
    budget: 'UNDER_5K', est: 4800, deadline: 'FLEXIBLE', addr: IS.addr, city: IS.city, county: IS.county, lat: IS.lat, lng: IS.lng,
    size: 'SMALL', score: 10, cost: 4, published: 10 * D, expires: -3 * D,
    room: [1.8, 1.2, 2.6], items: [it('Dulap de hol, 180 cm', 'PAL', ['PUSH']), it('Pantofar înclinat', 'PAL', []), it('Băncuță', 'PAL', [])],
  },
  // --- cereri noi langa Bucuresti (feed owner.a) ---
  // N1 Medie · 12 credite
  '85404327-ab1f-4423-82ac-917f8f86c7d7': {
    title: 'Bibliotecă living pe tot peretele · Voluntari', client: 'andreea.stan@demo.ro', status: 'IN_MARKETPLACE', createdAgo: 1 * D + 2 * H,
    description: 'Bibliotecă de 4 m pe tot peretele din living, cu nișă pentru TV, dulăpioare închise jos și rafturi deschise sus. Finisaj alb mat.',
    budget: 'FROM_5K_TO_15K', est: 12000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Erou Iancu Nicolae 32', city: 'Voluntari', county: 'Ilfov', lat: 44.4905, lng: 26.1756,
    size: 'MEDIUM', score: 19, cost: 12, published: 1 * D, expires: 5 * D,
    room: [5.2, 4.0, 2.7], items: [it('Bibliotecă cu nișă TV, 400 cm', 'MDF_VOPSIT', ['PUSH']), it('Dulăpioare inferioare', 'MDF_VOPSIT', ['PUSH'], 4)],
  },
  // N2 Mica · 4 credite
  '336fb0e8-47b5-41d8-97d7-3ba743d4abba': {
    title: 'Mobilier baie suspendat · București', client: 'sorina.matei@demo.ro', status: 'IN_MARKETPLACE', createdAgo: 4 * H,
    description: 'Corp suspendat de 80 cm sub lavoar și o etajeră deasupra mașinii de spălat, în baia mică. Finisaj stejar deschis.',
    budget: 'UNDER_5K', est: 4500, deadline: 'ASAP', addr: 'Str. Glinka 8, ap. 7, Sector 2', ...BUC, lat: 44.464, lng: 26.102,
    size: 'SMALL', score: 8, cost: 4, published: 3 * H, expires: 6 * D,
    room: [2.0, 1.6, 2.5], items: [it('Corp suspendat sub lavoar, 80 cm', 'PAL', ['PUSH']), it('Etajeră peste mașina de spălat', 'PAL', [])],
  },
  // N3 Medie · 18 credite · Sloturi 2/3 (preluata de DesignWood Studio + CasaMea Mobilier)
  '67f15705-e84c-4a1c-9af5-758e8e04fe11': {
    title: 'Dressing walk-in · Chiajna', client: 'mihnea.pavel@demo.ro', status: 'CLAIMED_PARTIAL', createdAgo: 3 * D + 3 * H,
    description: 'Dressing walk-in în camera de 2,5 × 2 m din casa nouă: bare de haine pe două niveluri, sertare cu închidere lentă și pantofar pe toată înălțimea.',
    budget: 'OVER_15K', est: 18000, deadline: 'ONE_TO_THREE_MONTHS', addr: 'Str. Tineretului 15', city: 'Chiajna', county: 'Ilfov', lat: 44.46, lng: 25.98,
    size: 'MEDIUM', score: 24, cost: 18, published: 3 * D, expires: 3 * D,
    room: [2.5, 2.0, 2.6], items: [it('Module cu bară de haine', 'PAL', [], 3), it('Corp cu sertare (închidere lentă)', 'PAL', ['PUSH']), it('Pantofar pe toată înălțimea', 'PAL', [])],
  },
};
const ROOMTYPE_NEW = {
  '85404327-ab1f-4423-82ac-917f8f86c7d7': 'LIVING', '336fb0e8-47b5-41d8-97d7-3ba743d4abba': 'BATHROOM', '67f15705-e84c-4a1c-9af5-758e8e04fe11': 'DRESSING',
};
const ROOM_ID_NEW = {
  '85404327-ab1f-4423-82ac-917f8f86c7d7': '785215bf-a746-4ac0-87a4-2c561bdd5069',
  '336fb0e8-47b5-41d8-97d7-3ba743d4abba': '081c7521-eb71-466a-bbab-de90beffd14b',
  '67f15705-e84c-4a1c-9af5-758e8e04fe11': 'ab8e972b-8a2f-4dff-83e8-50386565d918',
};

const roomOf = {};
for (const [id, r] of Object.entries(REQ)) {
  const client = U[r.client];
  const data = {
    title: r.title, description: r.description, budgetRange: r.budget, budgetEstimateRon: r.est, deadlineBucket: r.deadline,
    addressText: r.addr, city: r.city, county: r.county, lat: r.lat, lng: r.lng, clientUserId: client.id,
  };
  if (r.size) Object.assign(data, { projectSize: r.size, sizeScore: r.score, creditCost: r.cost, publishedAt: ago(r.published), expiresAt: ahead(r.expires) });
  const exists = await prisma.request.findUnique({ where: { id } });
  if (exists) {
    await prisma.request.update({ where: { id }, data: { ...data, createdAt: r.size ? ago(r.published + 2 * H) : exists.createdAt } });
  } else {
    await prisma.request.create({ data: { id, ...data, status: r.status, createdAt: ago(r.createdAgo), includesPaidDesign: false, hasOwnProject: false } });
  }
  // camera (una per cerere, ca in seed) + corpuri
  let room = await prisma.requestRoom.findFirst({ where: { requestId: id } });
  if (!room) room = await prisma.requestRoom.create({ data: { id: ROOM_ID_NEW[id], requestId: id, roomType: ROOMTYPE_NEW[id], lengthM: 1, widthM: 1, heightM: 1 } });
  await prisma.requestRoom.update({ where: { id: room.id }, data: { lengthM: r.room[0], widthM: r.room[1], heightM: r.room[2] } });
  await prisma.requestRoomItem.deleteMany({ where: { roomId: room.id } });
  await prisma.requestRoomItem.createMany({ data: r.items.map((x) => ({ roomId: room.id, ...x })) });
  roomOf[id] = room.id;
  // contact: emailul contului + telefon
  await prisma.requestContactPreference.deleteMany({ where: { requestId: id } });
  await prisma.requestContactPreference.createMany({
    data: [{ requestId: id, channel: 'EMAIL', value: client.email }, { requestId: id, channel: 'PHONE', value: PHONES[client.email] }],
  });
}
log(`${Object.keys(REQ).length} cereri (3 noi) cu titluri/descrieri/adrese/corpuri`);

// ---------- 4. preluari (claim-uri): snapshot-uri coerente cu cererea, momente plauzibile ----------
const slots = await prisma.claimSlot.findMany({ include: { request: true } });
for (const s of slots) {
  const r = REQ[s.requestId];
  if (!r || !r.size) continue;
  const claimedAt = new Date(s.request.publishedAt.getTime() + (3 + (s.id.charCodeAt(0) % 20)) * H);
  await prisma.claimSlot.update({
    where: { id: s.id },
    data: {
      projectSizeSnapshot: r.size, projectScoreSnapshot: r.score, claimCostCreditsSnapshot: r.cost, createdAt: claimedAt,
      slaDeadlineAt: ['ACTIVE'].includes(s.status) ? ahead(26 * H) : s.slaDeadlineAt,
    },
  });
}
// claim-ul din fisa de lucru a lui owner.a: preluat ieri
await prisma.claimSlot.update({ where: { id: '861163e7-6eec-48b3-8616-6f1749840a9b' }, data: { createdAt: ago(20 * H), slaDeadlineAt: ahead(28 * H) } });
// N3: 2 sloturi ocupate (DesignWood Studio + CasaMea Mobilier), fara oferta
const N3 = '67f15705-e84c-4a1c-9af5-758e8e04fe11';
for (const [slotId, threadId, key, owner] of [
  ['f00c7c51-5b76-47bf-87e5-dd4fbca15fe7', '9c518498-4e1b-475a-914b-b671fe630b83', 'B', 'owner.b@demo.ro'],
  ['9343d5ec-6794-454d-93f9-20c63f482f63', '34ae4cd7-f2b3-497a-9207-05139060af7f', 'C', 'owner.c@demo.ro'],
]) {
  const data = {
    requestId: N3, companyId: co[key], claimedByUserId: U[owner].id, assignedToUserId: null, status: 'ACTIVE',
    projectSizeSnapshot: 'MEDIUM', projectScoreSnapshot: 24, claimCostCreditsSnapshot: 18,
    slaDeadlineAt: ahead(30 * H), createdAt: ago(key === 'B' ? 2 * D + 20 * H : 2 * D + 5 * H),
  };
  await prisma.claimSlot.upsert({ where: { id: slotId }, update: data, create: { id: slotId, ...data } });
  await prisma.chatThread.upsert({ where: { claimSlotId: slotId }, update: {}, create: { id: threadId, claimSlotId: slotId } });
}
// „a preluat cererea acum …” din pagina de oferte a clientului = createdAt-ul threadului de chat
await prisma.$executeRaw`UPDATE chat_threads t SET created_at = c.created_at FROM claim_slots c WHERE t.claim_slot_id = c.id`;
log('preluari aliniate; N3 are 2/3 sloturi');

// ---------- 5. oferte ----------
const R9 = '1d02bcae-ce2d-4ce6-9793-40f2652b146c';
const quotes = await prisma.quote.findMany({ include: { versions: { orderBy: { version: 'asc' } }, company: true } });
const qOf = (req, key) => quotes.find((q) => q.requestId === req && q.companyId === co[key]);
async function setVersion(v, f) {
  const sentAt = ago(f.sent);
  await prisma.quoteVersion.update({
    where: { id: v.id },
    data: { price: f.price, designFee: f.design ?? null, deliveryTerm: f.term, warranty: f.warranty, description: f.desc, sentAt, createdAt: sentAt, validUntil: new Date(sentAt.getTime() + 14 * D) },
  });
  await prisma.quoteVersionRoomPrice.deleteMany({ where: { quoteVersionId: v.id } });
  await prisma.quoteVersionRoomPrice.create({ data: { quoteVersionId: v.id, requestRoomId: roomOf[f.req], price: f.price } });
}
const OFFERS = [
  // Elena (R9): trei oferte diferite
  { req: R9, key: 'A', price: 9500, design: 1200, term: '35 zile', warranty: '24 luni', sent: 4 * D + 3 * H,
    desc: 'Corp suspendat de 120 cm din MDF vopsit alb mat, cu blat compact HPL, dulap-coloană cu 4 polițe și oglindă cu bandă LED. Include proiectarea 3D, transportul și montajul.' },
  { req: R9, key: 'B', price: 2000, design: 250, term: '40 zile', warranty: '36 luni', sent: 3 * D + 5 * H,
    desc: 'Mobilier din MDF furniruit stejar, cu blat din lemn masiv tratat pentru umiditate și oglindă cu iluminare LED integrată. Proiect 3D inclus, garanție extinsă 36 de luni.' },
  { req: R9, key: 'C', price: 9200, design: 900, term: '28 zile', warranty: '24 luni', sent: 2 * D + 6 * H,
    desc: 'Corp suspendat din PAL melaminat hidrofug gri antracit, sertare cu închidere lentă și etajeră deschisă. Cel mai scurt termen de execuție; montajul este inclus.' },
  // restul ofertelor din seed
  { req: '80afad85-9640-418b-bf79-0d82e2447f75', key: 'B', price: 12600, term: '30 zile', warranty: '36 luni', sent: 5 * D,
    desc: 'Panouri riflate din furnir de stejar pe structură MDF, comodă TV suspendată de 240 cm și două vitrine cu sticlă fumurie și iluminare LED. Transport și montaj incluse.' },
  { req: 'ed8f289d-16ed-4546-b1e4-a2339490965e', key: 'A', price: 23900, term: '45 zile', warranty: '36 luni', sent: 16 * D,
    desc: 'Bucătărie în L din MDF vopsit alb mat, blat de stejar masiv uleiat, balamale și glisiere Blum cu închidere lentă, corpuri superioare cu Aventos HF. Include demontarea bucătăriei vechi.' },
  { req: 'c95f9758-bf1c-45e8-af43-6969793c4c44', key: 'B', price: 13400, term: '35 zile', warranty: '36 luni', sent: 36 * D,
    desc: 'Dulap de 280 cm cu sistem de glisare Hettich, o ușă cu oglindă argintie și două uși din MDF vopsit bej. Interior: bară de haine, 6 rafturi și 3 sertare.' },
  { req: '5dcd35ab-79e9-4455-859f-5bbea0ff1981', key: 'A', price: 18600, term: '40 zile', warranty: '24 luni', sent: 70 * D,
    desc: 'Fronturi MDF vopsit verde salvie cu mânere din alamă, blat din stejar masiv de 38 mm și corpuri pe picioare reglabile. Transport și montaj incluse.' },
  { req: 'f3439556-1298-4e50-8620-e3d616d52549', key: 'C', price: 16200, design: 800, term: '30 zile', warranty: '24 luni', sent: 55 * D,
    desc: 'Birou pe colț din PAL stejar Halifax, bibliotecă până în tavan și dulap închis pentru imprimantă, cu proiect 3D inclus. Montaj la domiciliu.' },
];
for (const o of OFFERS) {
  const q = qOf(o.req, o.key);
  if (!q) throw new Error(`oferta lipsa ${o.req} ${o.key}`);
  await setVersion(q.versions[0], o);
  await prisma.quote.update({ where: { id: q.id }, data: { createdAt: ago(o.sent), acceptedAt: q.status === 'ACCEPTED' ? ago(o.sent - 2 * D) : null } });
}
// Atelier Nord pe R9: cerere de modificare (onorata) + Versiunea 2 cu push-to-open
const qA = qOf(R9, 'A');
const v1 = qA.versions[0];
const owner = U['owner.a@demo.ro'];
const elena = U['elena.dumitru@demo.ro'];
await prisma.quoteChangeRequest.deleteMany({ where: { quoteVersionId: v1.id } });
await prisma.quoteChangeRequest.create({
  data: { id: '90210e5c-7abd-45ae-9715-9f7978b71660', quoteVersionId: v1.id, clientUserId: elena.id, requestedText: 'Se poate varianta fără mânere, cu uși care se deschid la apăsare (push-to-open)?', status: 'FULFILLED', createdAt: ago(3 * D + 2 * H), respondedAt: ago(1 * D + 4 * H) },
});
const v2Data = {
  quoteId: qA.id, version: 2, price: 9800, designFee: 1200, deliveryTerm: '35 zile', warranty: '24 luni',
  description: 'Varianta 2: aceeași configurație, cu sistem push-to-open Blum pe toate ușile și sertarele (+300 lei). Include proiectarea 3D, transportul și montajul.',
  validUntil: new Date(ago(1 * D + 4 * H).getTime() + 14 * D), createdByUserId: owner.id, sentAt: ago(1 * D + 4 * H), createdAt: ago(1 * D + 4 * H),
};
const V2 = '21f0c88e-09e8-4551-89ea-7e6618c025c2';
await prisma.quoteVersion.upsert({ where: { id: V2 }, update: v2Data, create: { id: V2, ...v2Data } });
await prisma.quoteVersionRoomPrice.deleteMany({ where: { quoteVersionId: V2 } });
await prisma.quoteVersionRoomPrice.create({ data: { quoteVersionId: V2, requestRoomId: roomOf[R9], price: 9800 } });
// negocierea lui Mihai (DesignWood Studio): cererea de modificare in asteptare, text natural
const qNeg = qOf('80afad85-9640-418b-bf79-0d82e2447f75', 'B');
await prisma.quoteChangeRequest.updateMany({
  where: { quoteVersionId: qNeg.versions[0].id },
  data: { requestedText: 'Se poate face peretele riflat în furnir de nuc în loc de stejar? Și vitrinele fără mânere, cu push-to-open.', createdAt: ago(2 * D) },
});
log('oferte: Atelier Nord 9.500 → v2 9.800 RON, DesignWood 2.000 EUR (≈10.400 RON), CasaMea 9.200 RON');

// ---------- 6. chat (criptat ca in productie) ----------
const threadOf = async (req, key) => (await prisma.chatThread.findFirst({ where: { claimSlot: { requestId: req, companyId: co[key] } } }));
const R11 = 'ed8f289d-16ed-4546-b1e4-a2339490965e';
const R13 = '5dcd35ab-79e9-4455-859f-5bbea0ff1981';
const CHATS = [
  { req: R9, key: 'A', client: elena, readClient: 1 * D + 4 * H + 60e3, msgs: [
    ['82f616a1-294f-49f1-ac55-edb9cb61ef4e', 'F', 4 * D + 2 * H, 'Bună, Elena! V-am trimis oferta pentru mobilierul de baie. Corpul suspendat are 120 cm, exact cât ați măsurat lângă cadă.'],
    ['79c36d49-4f96-445d-b8cc-3874f3ce3701', 'C', 3 * D + 2 * H, 'Mulțumesc! Se poate varianta fără mânere? Îmi plac ușile care se deschid la apăsare.'],
    ['85aafc35-9fd0-4785-96ee-292c578f5445', 'F', 3 * D + 1 * H, 'Sigur. Putem face ușile push-to-open, +300 lei.'],
    ['00a2b29b-88ab-422d-88e2-fcd5cca56ccb', 'C', 2 * D + 22 * H, 'Perfect, trimiteți varianta.'],
    ['fa5c148a-3b77-4b8f-ba73-9e4841670d48', 'F', 1 * D + 4 * H, 'Am trimis Versiunea 2 cu push-to-open. Termenul rămâne 35 de zile de la confirmare.'],
  ] },
  { req: R11, key: 'A', client: U['ana.popescu@demo.ro'], readOwner: 3 * H, msgs: [
    ['350c681a-310a-4ce8-9b06-feaf35ad0e86', 'F', 12 * D, 'Bună ziua, doamna Popescu! Am confirmat comanda. Debitarea începe luni, iar montajul îl estimăm pentru finalul lunii.'],
    ['a281ff09-d880-425c-b213-24ffd8057b38', 'C', 11 * D + 20 * H, 'Super, mulțumesc! Blatul de stejar vine uleiat sau trebuie să-l tratez eu?'],
    ['dcabd07a-316a-4a1d-9abc-2bee3e18f42c', 'F', 11 * D + 18 * H, 'Vine uleiat de două ori în atelier. Vă lăsăm și uleiul pentru întreținere.'],
    ['b5a7d119-d267-4b20-b05a-df8a42103898', 'C', 2 * H, 'Perfect. Vă pot trimite poze cu prizele înainte de montaj?'],
  ] },
  { req: R13, key: 'A', client: U['mihai.ionescu@demo.ro'], msgs: [
    ['d0074641-ff17-4488-be9d-c42bbac0a609', 'C', 13 * D, 'Montajul a ieșit foarte bine, mulțumim mult echipei!'],
    ['11c7fedb-35e4-404b-861c-35544c74e703', 'F', 13 * D - 2 * H, 'Ne bucurăm! Dacă apare ceva la balamale în primul an, ne sunați și venim să le reglăm.'],
  ] },
];
for (const c of CHATS) {
  const th = await threadOf(c.req, c.key);
  await prisma.message.deleteMany({ where: { chatThreadId: th.id } });
  for (const [id, who, when, body] of c.msgs) {
    await prisma.message.create({ data: { id, chatThreadId: th.id, senderUserId: who === 'F' ? owner.id : c.client.id, body: encrypt(body), createdAt: ago(when) } });
  }
  const lastClient = c.msgs.filter((m) => m[1] === 'C').map((m) => m[2]).sort((a, b) => a - b)[0];
  await prisma.chatThread.update({ where: { id: th.id }, data: { lastClientMessageAt: lastClient != null ? ago(lastClient) : null } });
  // citit: clientul/firma au citit tot, cu exceptiile care lasa 1 mesaj necitit (badge)
  await prisma.chatThreadRead.deleteMany({ where: { chatThreadId: th.id } });
  await prisma.chatThreadRead.createMany({
    data: [
      { chatThreadId: th.id, userId: c.client.id, lastReadAt: c.readClient ? ago(c.readClient) : new Date() },
      { chatThreadId: th.id, userId: owner.id, lastReadAt: c.readOwner ? ago(c.readOwner) : new Date() },
    ],
  });
}
log(`chat: ${CHATS.reduce((n, c) => n + c.msgs.length, 0)} mesaje criptate (Elena↔Atelier Nord, Ana↔Atelier Nord, Mihai↔Atelier Nord)`);

// ---------- 7. recenzii ----------
await prisma.review.updateMany({ where: { requestId: R13 }, data: { comment: 'Bucătăria a ieșit exact ca în randare. Echipa a venit la zi, a montat totul în două zile și a lăsat curat în urmă. Recomand Atelier Nord cu toată încrederea!', createdAt: ago(12 * D) } });
await prisma.review.updateMany({ where: { requestId: 'f3439556-1298-4e50-8620-e3d616d52549' }, data: { comment: 'Montajul a întârziat aproape două săptămâni, iar două fronturi au venit cu cantul dezlipit. Le-au înlocuit, dar ne așteptam la mai multă atenție.', createdAt: ago(20 * D) } });
log('recenzii rescrise');

// ---------- 8. fisiere atasate la cererea din fisa de lucru (schita + poza) ----------
const R5 = 'acb6df7f-372d-4184-ac80-4b564fcd62af';
const s3 = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } });
const FILES = [
  { id: '87887fc8-672f-4936-bfd8-4e4df892c7a1', file: 'schita-dormitor.png', mime: 'image/png', when: 5 * D + 3 * H },
  { id: '83906f27-f960-4a28-8d0e-009dda99100a', file: 'dulap-referinta.jpg', mime: 'image/jpeg', when: 5 * D + 3 * H - 60e3 },
];
let filesOk = 0;
for (const f of FILES) {
  const path = join(HERE, 'fixtures', f.file);
  const key = `request/${R5}/${f.id}/${f.file}`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: readFileSync(path), ContentType: f.mime }));
    const data = { entityType: 'REQUEST', entityId: R5, filename: f.file, mimeType: f.mime, sizeBytes: statSync(path).size, storageKey: key, status: 'SAFE', createdAt: ago(f.when) };
    await prisma.attachment.upsert({ where: { id: f.id }, update: data, create: { id: f.id, ...data } });
    filesOk++;
  } catch (e) {
    console.warn('[polish] upload esuat', f.file, e.message);
  }
}
log(`fisiere atasate la ${R5}: ${filesOk}/2`);

// ---------- 9. galeria de inspiratie: titluri cu diacritice, firme fictive, fara link extern ----------
const TITLES = {
  'Living cu mobilier din stejar si accente calde': 'Living cu mobilier din stejar și accente calde',
  'Mobilier de baie suspendat cu front de lemn': 'Mobilier de baie suspendat cu front de lemn',
  'Dormitor cu panou albastru petrol si stejar': 'Dormitor cu panou albastru petrol și stejar',
  'Depozitare cu sertare sub scara': 'Depozitare cu sertare sub scară',
  'Hol cu tapet tropical si masa alba': 'Hol cu tapet tropical și masă albă',
  'Bucatarie alba in L cu perdele mustar': 'Bucătărie albă în L cu perdele muștar',
  'Bucatarie alba cu fronturi verzi': 'Bucătărie albă cu fronturi verzi',
  'Living cu perete verde si mobilier alb': 'Living cu perete verde și mobilier alb',
  'Dormitor cu tablie tapitata bej': 'Dormitor cu tăblie tapițată bej',
  'Dressing deschis cu rafturi albe': 'Dressing deschis cu rafturi albe',
  'Cuier verde cu oglinzi rotunde': 'Cuier verde cu oglinzi rotunde',
  'Mobilier de hol alb cu stejar': 'Mobilier de hol alb cu stejar',
  'Living cu birou integrat si fresca pictata': 'Living cu birou integrat și frescă pictată',
  'Birou de acasa cu paravan din sipci': 'Birou de acasă cu paravan din șipci',
  'Camera copilului in albastru': 'Camera copilului în albastru',
  'Bucatarie alba cu corpuri din lemn': 'Bucătărie albă cu corpuri din lemn',
  'Camera copiilor cu covor multicolor': 'Camera copiilor cu covor multicolor',
  'Bar de bucatarie cu blat si etajere din lemn': 'Bar de bucătărie cu blat și etajere din lemn',
  'Cuier alb cu bancuta albastra': 'Cuier alb cu băncuță albastră',
  'Bucatarie neagra cu manere aurii': 'Bucătărie neagră cu mânere aurii',
  'Biblioteca alba pe tot peretele': 'Bibliotecă albă pe tot peretele',
  'Pat casuta din lemn pentru copii': 'Pat căsuță din lemn pentru copii',
  'Dulap cu usi glisante si nisa TV': 'Dulap cu uși glisante și nișă TV',
  'Bucatarie clasica vopsita crem': 'Bucătărie clasică vopsită crem',
  'Baie cu consola vintage': 'Baie cu consolă vintage',
  'Blat de baie din lemn masiv': 'Blat de baie din lemn masiv',
  'Camera copilului cu pat casuta': 'Camera copilului cu pat căsuță',
  'Comoda TV alba cu canapea verde': 'Comodă TV albă cu canapea verde',
  'Dormitor clasic cu perete din furnir': 'Dormitor clasic cu perete din furnir',
  'Mobilier cu masina de spalat integrata': 'Mobilier cu mașină de spălat integrată',
  'Bucatarie alba cu blat de lemn masiv': 'Bucătărie albă cu blat de lemn masiv',
  'Perete media crem cu riflaje': 'Perete media crem cu riflaje',
  'Bucatarie crem cu lemn deschis': 'Bucătărie crem cu lemn deschis',
  'Living clasic cu nise si canapea alba': 'Living clasic cu nișe și canapea albă',
  'Comoda alba cu canapea galbena': 'Comodă albă cu canapea galbenă',
  'Perete de dulapuri albe': 'Perete de dulapuri albe',
  'Dormitor cu canapea galbena': 'Dormitor cu canapea galbenă',
  'Bucatarie alba mata cu lemn inchis': 'Bucătărie albă mată cu lemn închis',
  'Hol cu bancuta si cosuri de ratan': 'Hol cu băncuță și coșuri de ratan',
  'Colt de birou cu tabla de scris': 'Colț de birou cu tablă de scris',
  'Bucatarie neagra cu insula de marmura': 'Bucătărie neagră cu insulă de marmură',
  'Dormitor cu pat petrol si perete geometric': 'Dormitor cu pat petrol și perete geometric',
  'Dulap de hol bleu, stil clasic': 'Dulap de hol bleu, stil clasic',
  'Biblioteca clasica crem cu TV': 'Bibliotecă clasică crem cu TV',
  'Living cu riflaje verzi si canapea teracota': 'Living cu riflaje verzi și canapea teracotă',
  'Sala de training cu scaune galbene': 'Sală de training cu scaune galbene',
  'Lounge de birou cu canapele petrol': 'Lounge de birou cu canapele petrol',
  'Dressing walk-in din stejar cu LED': 'Dressing walk-in din stejar cu LED',
  'Dormitor cu panou din sipci de lemn': 'Dormitor cu panou din șipci de lemn',
  'Dulap gri cu manere frezate': 'Dulap gri cu mânere frezate',
  'Living cu bucatarie verde si canapea cognac': 'Living cu bucătărie verde și canapea coniac',
  'Dormitor cu pat teracota si usa glisanta': 'Dormitor cu pat teracotă și ușă glisantă',
  'Bucatarie verde salvie cu accente cupru': 'Bucătărie verde salvie cu accente de cupru',
  'Dulap alb cu nisa TV in dormitor': 'Dulap alb cu nișă TV în dormitor',
  'Dormitor bej cu noptiere riflate negre': 'Dormitor bej cu noptiere riflate negre',
  'Perete TV cu riflaje de stejar': 'Perete TV cu riflaje de stejar',
  'Birou integrat in dulap alb': 'Birou integrat în dulap alb',
  'Dulap cu fronturi de sticla fumurie': 'Dulap cu fronturi de sticlă fumurie',
  'Biblioteca alba langa dining': 'Bibliotecă albă lângă zona de dining',
  'Vitrina de dressing cu rama neagra': 'Vitrină de dressing cu ramă neagră',
  'Dormitor cu dulapuri albe pe tot peretele': 'Dormitor cu dulapuri albe pe tot peretele',
  'Bucatarie gri deschis fara manere': 'Bucătărie gri deschis fără mânere',
  'Insula de bucatarie cu blat in trepte': 'Insulă de bucătărie cu blat în trepte',
  'Living antracit cu accente galbene': 'Living antracit cu accente galbene',
  'Dormitor antracit cu benzi LED': 'Dormitor antracit cu benzi LED',
  'Hol antracit cu nisa de spalatorie': 'Hol antracit cu nișă de spălătorie',
  'Bucatarie antracit cu stejar': 'Bucătărie antracit cu stejar',
  'Perete TV cu piatra si finisaje calde': 'Perete TV cu piatră și finisaje calde',
  'Bucatarie alba cu insula si parchet chevron': 'Bucătărie albă cu insulă și parchet chevron',
  'Crama cu rafturi din lemn masiv': 'Cramă cu rafturi din lemn masiv',
};
// autorii: fiecare proiect-sursa (din source_url, inainte sa-l stergem) merge la o firma fictiva aprobata
const AUTHORS = [co.A, co.B, co.C, co.H, co.S];
const photos = await prisma.inspirationPhoto.findMany({ orderBy: { createdAt: 'asc' } });
const projectOwner = new Map();
let pi = 0, retitled = 0;
for (const p of photos) {
  const project = p.sourceUrl ? p.sourceUrl.split('/').pop() : null;
  const data = { sourceUrl: null };
  if (project) {
    if (!projectOwner.has(project)) projectOwner.set(project, AUTHORS[pi++ % AUTHORS.length]);
    data.companyId = projectOwner.get(project);
  }
  const t = TITLES[p.title];
  if (t && t !== p.title) { data.title = t; retitled++; }
  await prisma.inspirationPhoto.update({ where: { id: p.id }, data });
}
const unmapped = photos.filter((p) => !TITLES[p.title] && !Object.values(TITLES).includes(p.title));
log(`inspiratie: ${retitled} titluri cu diacritice, ${projectOwner.size} proiecte impartite la 5 firme, source_url sters; fara mapare: ${unmapped.length}`);

// ---------- 10. portofolii (pagina Parteneri + profil firma) cu pini locali ----------
const PINS = 'http://localhost:8099';
const PORTFOLIO = {
  A: [['Dulap dormitor alb, Floreasca', '688a230b3a9873bc4ac6be36-mg-5053-min', 'Dulap pe tot peretele, uși albe mate, interior cu sertare și bară de haine.'],
      ['Comodă neagră cu mânere, Pipera', '61bb1e2b0bac79833378c9ab-a56-min', 'Comodă din MDF vopsit negru mat, cu mânere din alamă.'],
      ['Comodă TV din stejar, Cotroceni', '663b998cd143b35ccf0c0a4a-213123-min', 'Comodă TV joasă din furnir de stejar.']],
  B: [['Dressing din stejar cu uși glisante', '64bfda482655df9626749523-mg-2079-min', 'Dressing cu uși glisante din furnir de stejar.'],
      ['Bibliotecă gri antracit', '67128eeac409d9f6f70fbe7c-123-min', 'Bibliotecă cu rafturi reglabile, finisaj gri antracit.'],
      ['Birou alb cu casetieră', '663b998f2b107c7f925cdba9-mg-4232-min', 'Birou de lucru cu casetieră și sertare push-to-open.']],
  C: [['Dulap verde salvie, Cluj-Napoca', '65c90ccd5358e5ac623faf17-livinglivmodif-min', 'Dulap cu fronturi verde salvie și interior alb.'],
      ['Comodă TV albă, Florești', '619cdc9f4830e05283f4b714-mg-9992-min', 'Comodă TV cu nișe deschise, finisaj alb mat.'],
      ['Noptiere albastre', '61289cd71e6a8c736b04171b-mg-0034-min', 'Pereche de noptiere cu sertar și nișă deschisă.']],
  H: [['Dulap de hol bleu, stil clasic', '62c6ad4b280efc4af23bb43e-mg-9400-copy-min', 'Dulap cu mânere și finisaj vopsit bleu.'],
      ['Bibliotecă clasică crem', '62c6ad4b280efc66f63bb446-mg-9383-copy-min', 'Bibliotecă vopsită crem, cu mânere clasice.'],
      ['Dulap din nuc cu uși glisante', '663b998f386581473c5e6ae7-mg-4248-min', 'Dulap cu fronturi din furnir de nuc.']],
  S: [['Comodă TV crem', '697bb2602ffc7c1c50eeacb0-mg-7414-1', 'Comodă TV cu nișe, finisaj crem cald.'],
      ['Comodă albă cu sertare', '697bb2694cd704616f2058ab-mg-7387-1', 'Comodă cu sertare fără mânere.'],
      ['Comodă antracit', '67128f0a357ef468cf3d102f-mg-4935-min', 'Comodă joasă cu sertare, finisaj antracit.']],
};
const PF_IDS = ['4892db1a-cc99-4908-bfcd-cb316361f9a7', '32cf3a8d-5822-499f-8883-6885991dfbe4', '596acb79-b859-41da-8ffc-4ac489ae116d',
  'c89b6538-1cc3-4d9d-bcf9-47ce9e36c8e5', 'a9374d36-b77d-4132-87a2-2b96875ca82e', 'c38915b5-e111-4c3b-a85e-10b5d48dda29',
  'b9bc898f-02e9-4252-8a62-12601d327ae6', '9f179836-f890-40ab-bd17-ae186878cee5', '3c7f9b96-e03c-49a2-9052-a1d939f048a6',
  '8ef8284d-eab3-42d0-9f4c-1905cf194119', 'fc9c7966-8865-47f0-9bd5-3be7b6e0befb', 'e02eab72-cab2-4469-8f04-dcd56ac4e782',
  'e1a0c7e2-5d3b-4f6a-9c1e-7b2d4e6f8a01', 'e1a0c7e2-5d3b-4f6a-9c1e-7b2d4e6f8a02', 'e1a0c7e2-5d3b-4f6a-9c1e-7b2d4e6f8a03'];
let pfi = 0;
for (const [key, items] of Object.entries(PORTFOLIO)) {
  for (const [i, [title, slug, description]] of items.entries()) {
    const id = PF_IDS[pfi++];
    const data = { companyId: co[key], title, description, imageUrl: `${PINS}/${slug}.jpg`, createdAt: ago((90 - i * 20) * D) };
    await prisma.companyPortfolioItem.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
}
log(`portofolii: ${pfi} proiecte pentru 5 firme`);

// ---------- 11. notificari cu context real (inlocuiesc cele 30 de decor {demo:true}) ----------
await prisma.notification.deleteMany({ where: { OR: [{ payload: { path: ['demo'], equals: true } }, { payload: { path: ['polish'], equals: true } }] } });
const title = (id) => REQ[id].title;
const n = (email, type, req, company, whenMs, read = true, extra = {}) => ({
  userId: U[email].id, type, createdAt: ago(whenMs), readAt: read ? ago(Math.max(whenMs - H, 60e3)) : null,
  payload: { polish: true, requestId: req, requestTitle: title(req), ...(company ? { companyName: company } : {}), ...extra },
});
const NN = 'Atelier Nord', DW = 'DesignWood Studio', CM = 'CasaMea Mobilier';
const R5T = R5, R7 = 'e540bd37-8980-4a66-a2f0-09b7fc29351d', R10 = '80afad85-9640-418b-bf79-0d82e2447f75', R12 = 'c95f9758-bf1c-45e8-af43-6969793c4c44';
const R14 = 'f3439556-1298-4e50-8620-e3d616d52549', R15 = 'c12c33ef-7f0e-4234-8c3d-d28d6b388ce9', R6 = '550fa730-217b-4d31-8e1f-1446c6ad5112';
await prisma.notification.createMany({ data: [
  // Elena: comparatia cu 3 oferte; 2 necitite (oferta actualizata + mesaj de la Atelier Nord)
  n('elena.dumitru@demo.ro', 'claim.created', R9, NN, 6 * D + 20 * H), n('elena.dumitru@demo.ro', 'claim.created', R9, DW, 6 * D + 10 * H),
  n('elena.dumitru@demo.ro', 'claim.created', R9, CM, 5 * D + 18 * H), n('elena.dumitru@demo.ro', 'quote.created', R9, NN, 4 * D + 3 * H),
  n('elena.dumitru@demo.ro', 'quote.created', R9, DW, 3 * D + 5 * H), n('elena.dumitru@demo.ro', 'quote.created', R9, CM, 2 * D + 6 * H),
  n('elena.dumitru@demo.ro', 'request.status_changed', R12, DW, 2 * D), n('elena.dumitru@demo.ro', 'quote.updated', R9, NN, 1 * D + 4 * H, false),
  n('elena.dumitru@demo.ro', 'message.created', R9, NN, 1 * D + 4 * H - 60e3, false),
  // Mihai
  n('mihai.ionescu@demo.ro', 'request.status_changed', R13, NN, 12 * D), n('mihai.ionescu@demo.ro', 'quote.created', R10, DW, 5 * D),
  n('mihai.ionescu@demo.ro', 'claim.created', R6, CM, 3 * D),
  // Ana
  n('ana.popescu@demo.ro', 'quote.accepted', R11, NN, 14 * D), n('ana.popescu@demo.ro', 'message.created', R11, NN, 11 * D + 18 * H),
  n('ana.popescu@demo.ro', 'claim.created', R5T, NN, 20 * H),
  // Radu
  n('radu.stanescu@demo.ro', 'claim.created', R7, NN, 4 * D), n('radu.stanescu@demo.ro', 'claim.created', R7, DW, 4 * D - 2 * H),
  n('radu.stanescu@demo.ro', 'claim.created', R7, CM, 3 * D), n('radu.stanescu@demo.ro', 'request.status_changed', R15, null, 3 * D),
  n('radu.stanescu@demo.ro', 'request.status_changed', R14, CM, 20 * D),
  // firme: owner.a are un mesaj necitit de la Ana
  n('owner.a@demo.ro', 'quote.accepted', R11, NN, 14 * D), n('owner.a@demo.ro', 'message.created', R9, NN, 2 * D + 22 * H),
  n('owner.a@demo.ro', 'message.created', R11, NN, 2 * H, false),
  n('owner.b@demo.ro', 'quote.accepted', R12, DW, 34 * D), n('owner.b@demo.ro', 'request.status_changed', R12, DW, 2 * D),
  n('owner.c@demo.ro', 'request.status_changed', R14, CM, 20 * D),
] });
log('notificari cu context (2 necitite la Elena, 1 la owner.a)');

// ---------- 12. facturi: numere + abonamente ----------
const pkg50 = await prisma.creditPackage.findFirst({ where: { credits: 50 } });
const pkg100 = await prisma.creditPackage.findFirst({ where: { credits: 100 } });
let invNo = 1041;
for (const o of await prisma.mockBillingOrder.findMany({ where: { orderType: 'CREDIT_PACKAGE' }, orderBy: { createdAt: 'asc' } })) {
  await prisma.mockBillingOrder.update({ where: { id: o.id }, data: { invoiceNumber: invNo++, creditPackageId: o.credits === 50 ? pkg50?.id : pkg100?.id } });
}
const gold = await prisma.subscriptionPlan.findFirst({ where: { tier: 'GOLD' } });
const plat = await prisma.subscriptionPlan.findFirst({ where: { tier: 'PLATINUM' } });
for (const [id, key, plan, base, num, when] of [
  ['e1a0c7e2-5d3b-4f6a-9c1e-7b2d4e6f8a10', 'A', gold, 399, 1038, 20 * D],
  ['e1a0c7e2-5d3b-4f6a-9c1e-7b2d4e6f8a11', 'B', plat, 899, 1039, 20 * D],
]) {
  const vat = Math.round(base * 21) / 100;
  const data = {
    companyId: co[key], orderType: 'SUBSCRIPTION', status: 'CONFIRMED', planId: plan.id, credits: plan.includedCredits,
    baseAmountRon: base, vatRate: 21, vatAmountRon: vat, totalRon: base + vat, invoiceSeries: 'MM', invoiceNumber: num,
    confirmedAt: ago(when), paymentSource: 'admin', createdAt: ago(when + H),
    sellerSnapshot: { name: 'Marketplace Mobilier SRL', cui: 'RO12345678' },
  };
  await prisma.mockBillingOrder.upsert({ where: { id }, update: data, create: { id, ...data } });
}
log('facturi numerotate (MM 1038–1042) + abonamente Gold/Platinum');

// ---------- verificare: nimic „demo”/„Mobila Unicat” in textele vizibile ----------
const leftovers = await prisma.$queryRaw`
  SELECT 'request' AS t, title AS v FROM requests WHERE title ~ '(KITCHEN|BEDROOM|LIVING|OFFICE|DRESSING|BATHROOM)' OR title ~* '\\mdemo\\M' OR description ~* '\\mdemo\\M'
  UNION ALL SELECT 'company', name FROM companies WHERE name ~* '(unicat|^[A-H] )'
  UNION ALL SELECT 'user', name FROM users WHERE name ~ ' [A-Z]$' OR name ~* '\\mdemo\\M'
  UNION ALL SELECT 'quote', description FROM quote_versions WHERE description ~* '\\mdemo\\M'
  UNION ALL SELECT 'review', comment FROM reviews WHERE comment ~* '\\mdemo\\M'
  UNION ALL SELECT 'photo', title FROM inspiration_photos WHERE source_url IS NOT NULL`;
log(leftovers.length ? `RAMAS: ${JSON.stringify(leftovers)}` : 'verificare: niciun text demo/Mobila Unicat ramas');
await prisma.$disconnect();
