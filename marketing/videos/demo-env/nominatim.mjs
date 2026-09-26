// Mock Nominatim (nominatim.openstreetmap.org e blocat in container).
// Backend-ul (GeoService) cheama GET /search?q=<adresa, oras, judet>&format=jsonv2.
// Raspundem cu coordonatele orasului recunoscut (resedinte de judet + cateva
// orase din Ilfov), cu un mic offset determinist din adresa (<1 km) ca pinii sa
// nu se suprapuna. Oras necunoscut → judetul lui → fallback Bucuresti.
import http from 'node:http';

const PLACES = {
  bucuresti: [44.4268, 26.1025, 'București'], ilfov: [44.5355, 26.2324, 'Ilfov'],
  voluntari: [44.4905, 26.1756, 'Voluntari'], otopeni: [44.5500, 26.0706, 'Otopeni'],
  popesti_leordeni: [44.3800, 26.1700, 'Popești-Leordeni'], chiajna: [44.4600, 25.9800, 'Chiajna'],
  bragadiru: [44.3711, 25.9750, 'Bragadiru'], pantelimon: [44.4533, 26.2069, 'Pantelimon'],
  cluj: [46.7712, 23.6236, 'Cluj-Napoca'], cluj_napoca: [46.7712, 23.6236, 'Cluj-Napoca'],
  timisoara: [45.7489, 21.2087, 'Timișoara'], timis: [45.7489, 21.2087, 'Timiș'],
  iasi: [47.1585, 27.6014, 'Iași'], brasov: [45.6580, 25.6012, 'Brașov'],
  constanta: [44.1598, 28.6348, 'Constanța'], craiova: [44.3302, 23.7949, 'Craiova'], dolj: [44.3302, 23.7949, 'Dolj'],
  galati: [45.4353, 28.0080, 'Galați'], ploiesti: [44.9416, 26.0236, 'Ploiești'], prahova: [44.9416, 26.0236, 'Prahova'],
  oradea: [47.0465, 21.9189, 'Oradea'], bihor: [47.0465, 21.9189, 'Bihor'],
  braila: [45.2692, 27.9575, 'Brăila'], arad: [46.1866, 21.3123, 'Arad'],
  pitesti: [44.8565, 24.8692, 'Pitești'], arges: [44.8565, 24.8692, 'Argeș'],
  sibiu: [45.7983, 24.1256, 'Sibiu'], bacau: [46.5670, 26.9146, 'Bacău'],
  targu_mures: [46.5386, 24.5575, 'Târgu Mureș'], mures: [46.5386, 24.5575, 'Mureș'],
  baia_mare: [47.6567, 23.5850, 'Baia Mare'], maramures: [47.6567, 23.5850, 'Maramureș'],
  buzau: [45.1500, 26.8333, 'Buzău'], botosani: [47.7486, 26.6694, 'Botoșani'],
  satu_mare: [47.7900, 22.8900, 'Satu Mare'], ramnicu_valcea: [45.1047, 24.3756, 'Râmnicu Vâlcea'], valcea: [45.1047, 24.3756, 'Vâlcea'],
  drobeta_turnu_severin: [44.6369, 22.6597, 'Drobeta-Turnu Severin'], mehedinti: [44.6369, 22.6597, 'Mehedinți'],
  suceava: [47.6514, 26.2556, 'Suceava'], piatra_neamt: [46.9275, 26.3708, 'Piatra Neamț'], neamt: [46.9275, 26.3708, 'Neamț'],
  targu_jiu: [45.0342, 23.2747, 'Târgu Jiu'], gorj: [45.0342, 23.2747, 'Gorj'],
  targoviste: [44.9254, 25.4567, 'Târgoviște'], dambovita: [44.9254, 25.4567, 'Dâmbovița'],
  focsani: [45.6961, 27.1864, 'Focșani'], vrancea: [45.6961, 27.1864, 'Vrancea'],
  bistrita: [47.1333, 24.5000, 'Bistrița'], bistrita_nasaud: [47.1333, 24.5000, 'Bistrița-Năsăud'],
  resita: [45.3008, 21.8892, 'Reșița'], caras_severin: [45.3008, 21.8892, 'Caraș-Severin'],
  tulcea: [45.1716, 28.7914, 'Tulcea'], slatina: [44.4297, 24.3642, 'Slatina'], olt: [44.4297, 24.3642, 'Olt'],
  calarasi: [44.2000, 27.3333, 'Călărași'], giurgiu: [43.9037, 25.9699, 'Giurgiu'],
  alba_iulia: [46.0667, 23.5833, 'Alba Iulia'], alba: [46.0667, 23.5833, 'Alba'],
  deva: [45.8833, 22.9000, 'Deva'], hunedoara: [45.8833, 22.9000, 'Hunedoara'],
  zalau: [47.1911, 23.0572, 'Zalău'], salaj: [47.1911, 23.0572, 'Sălaj'],
  sfantu_gheorghe: [45.8667, 25.7833, 'Sfântu Gheorghe'], covasna: [45.8667, 25.7833, 'Covasna'],
  miercurea_ciuc: [46.3594, 25.8017, 'Miercurea Ciuc'], harghita: [46.3594, 25.8017, 'Harghita'],
  vaslui: [46.6407, 27.7276, 'Vaslui'], slobozia: [44.5647, 27.3633, 'Slobozia'], ialomita: [44.5647, 27.3633, 'Ialomița'],
  alexandria: [43.9686, 25.3333, 'Alexandria'], teleorman: [43.9686, 25.3333, 'Teleorman'],
};

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^(municipiul|orasul|judetul|jud\.?|sector(ul)?\s*\d)\s*/g, '').trim().replace(/[\s-]+/g, '_');

function hashOffset(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return [((h & 0xff) / 255 - 0.5) * 0.012, (((h >> 8) & 0xff) / 255 - 0.5) * 0.016];
}

function lookup(q) {
  const parts = q.split(',').map((p) => p.trim()).filter(Boolean);
  // cu >=2 segmente primul e strada ("Str. Cluj nr. 3") — nu-l folosim pentru potrivire
  const candidates = parts.length > 1 ? parts.slice(1) : parts;
  for (const seg of candidates) {
    const key = norm(seg);
    if (PLACES[key]) return PLACES[key];
  }
  for (const seg of parts) {
    const key = norm(seg);
    if (PLACES[key]) return PLACES[key];
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mock: 'nominatim' }));
  }
  if (url.pathname !== '/search') {
    res.writeHead(404);
    return res.end('[]');
  }
  const q = url.searchParams.get('q') ?? '';
  const hit = lookup(q) ?? PLACES.bucuresti;
  const [dLat, dLng] = hashOffset(q);
  const body = [{
    lat: String((hit[0] + dLat).toFixed(6)),
    lon: String((hit[1] + dLng).toFixed(6)),
    display_name: `${q} (${hit[2]}, România — mock local)`,
  }];
  console.log(`[nominatim] q="${q}" -> ${hit[2]}`);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
});
const port = Number(process.env.NOMINATIM_PORT ?? 8088);
server.listen(port, '0.0.0.0', () => console.log(`[nominatim] mock pe http://localhost:${port}/search`));
