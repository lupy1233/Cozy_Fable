// SMTP sink (inlocuieste Mailpit): accepta orice mesaj pe :1025 si il salveaza
// in data/mail/<timestamp>.eml; logheaza destinatarul, subiectul si linkurile gasite.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { SMTPServer } = require('smtp-server');
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'data', 'mail');
mkdirSync(outDir, { recursive: true });

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  onData(stream, session, cb) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`);
      writeFileSync(file, raw);
      const subject = (raw.match(/^Subject: (.*)$/m) ?? [])[1] ?? '';
      const to = session.envelope.rcptTo.map((r) => r.address).join(', ');
      // quoted-printable: lipeste liniile rupte ("=\n") si decodeaza "=3D"
      const body = raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
      const links = [...new Set(body.match(/https?:\/\/[^\s"'<>]+/g) ?? [])].slice(0, 5);
      console.log(`[smtp] ${new Date().toISOString()} to=${to} subject="${subject}" file=${file}`);
      for (const l of links) console.log(`[smtp]   link: ${l}`);
      cb();
    });
  },
});
server.listen(Number(process.env.SMTP_PORT ?? 1025), '0.0.0.0', () =>
  console.log(`[smtp] sink pe :${process.env.SMTP_PORT ?? 1025} (mesaje in ${outDir})`),
);
