#!/usr/bin/env node
// Colectii de inspiratie demo pentru un client (seed-ul din repo nu are boards).
// Doar date in DB-ul local, prin API-ul real (login + POST /inspiration/boards).
// Idempotent dupa numele colectiei. Implicit pentru ana.popescu@demo.ro.
//   node tools/seed-boards.mjs [email]
const API = 'http://localhost:3001/api/v1';
const email = process.argv[2] || 'ana.popescu@demo.ro';
const password = process.env.DEMO_PASSWORD || 'DemoCozy2026!';

const BOARDS = [
  { name: 'Bucătăria noastră', room: 'KITCHEN', n: 7 },
  { name: 'Dormitor matrimonial', room: 'BEDROOM', n: 6 },
  { name: 'Living & bibliotecă', room: 'LIVING', n: 6 },
  { name: 'Hol și depozitare', room: 'HALLWAY', n: 4 },
];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`login ${login.status}: ${await login.text()}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const api = async (method, path, body) => {
  const r = await fetch(`${API}${path}`, {
    method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
};

const gallery = await api('GET', '/inspiration?limit=100');
const photos = gallery.items ?? gallery.data ?? gallery;
const existing = await api('GET', '/inspiration/boards');
const list = existing.items ?? existing;
for (const b of BOARDS) {
  if (list.some((x) => x.name === b.name)) { console.log(`= ${b.name} exista`); continue; }
  const board = await api('POST', '/inspiration/boards', { name: b.name });
  const pick = photos.filter((p) => p.roomType === b.room).slice(0, b.n);
  for (const p of pick) await api('POST', `/inspiration/boards/${board.id}/items`, { photoId: p.id });
  console.log(`+ ${b.name}: ${pick.length} pini (${board.id})`);
}
