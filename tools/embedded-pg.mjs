/* ============================================================
   Local development: run a throwaway PostgreSQL instance so the
   API can be tested without installing a database server.

   Usage:  npm run pg
   Then:   DATABASE_URL=postgres://postgres:postgres@localhost:54329/fib140 npm start
   ============================================================ */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PG_PORT || 54329);

const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, '.pgdata'),
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  /* الترميز UTF8 ضروري للبيانات العربية على Windows */
  initdbFlags: ['--encoding=UTF8', '--locale=C']
});

await pg.initialise().catch(() => {});
await pg.start();
await pg.createDatabase('fib140').catch(() => {});
console.log(`[dev-pg] PostgreSQL listening on postgres://postgres:postgres@localhost:${port}/fib140`);

const stop = async () => { try { await pg.stop(); } catch (e) {} process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
