// Helper comun: inlocuiri exacte, cu respectarea CRLF. Folosire: require('./rep.cjs')(file, [[a,b],...])
const fs = require('fs');
module.exports = function rep(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  const LF = String.fromCharCode(10);
  const CRLF = String.fromCharCode(13, 10);
  const crlf = s.includes(CRLF);
  for (let [a, b] of pairs) {
    if (crlf) { a = a.split(CRLF).join(LF).split(LF).join(CRLF); b = b.split(CRLF).join(LF).split(LF).join(CRLF); }
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`${file}: ancora gasita de ${n} ori: ${a.slice(0, 80)}`);
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, s);
  console.log('ok', file);
};
