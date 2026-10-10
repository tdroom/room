import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, tx } from './db.js';
import { config } from './config.js';
import { splitStruttura } from './lib/strutture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'migrations');

export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`);
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await c.query('COMMIT');
      console.log(`[migrate] applicata ${f}`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`Migrazione ${f} fallita: ${e.message}`);
    } finally {
      c.release();
    }
  }
  await seed();
}

async function seed() {
  // Super amministratore iniziale
  if (config.seed.superadminEmail) {
    const { rows } = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [config.seed.superadminEmail]);
    if (!rows.length) {
      if (!config.seed.superadminPassword || config.seed.superadminPassword.length < 12) {
        console.warn('[seed] SEED_SUPERADMIN_PASSWORD assente o troppo corta (min 12): amministratore creato con solo accesso Microsoft 365');
      }
      const hash = config.seed.superadminPassword?.length >= 12 ? await bcrypt.hash(config.seed.superadminPassword, 12) : null;
      await pool.query(
        `INSERT INTO users (email, full_name, role, auth_provider, password_hash, must_change_password) VALUES ($1,$2,'ADMIN',$3,$4,TRUE)`,
        [config.seed.superadminEmail, config.seed.superadminName, hash ? 'BOTH' : 'ENTRA', hash],
      );
      console.log(`[seed] creato amministratore ${config.seed.superadminEmail}`);
    }
  }
  // Dati iniziali: le sedi migrate dalla versione artifact (una sola volta, se il database è vuoto)
  const n = (await pool.query('SELECT count(*)::int AS n FROM strutture')).rows[0].n;
  const seedFile = path.join(here, 'seed', 'roomplanning_seed.json');
  if (n === 0 && config.seed.loadInitialData && fs.existsSync(seedFile)) {
    const env = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const list = env.data?.strutture || env.strutture || [];
    await tx(async (c) => {
      for (const s of list) {
        const { lite, blobs } = splitStruttura(s);
        await c.query('INSERT INTO strutture (id, data, version) VALUES ($1,$2,1)', [lite.id, JSON.stringify(lite)]);
        for (const [kind, data] of Object.entries(blobs)) {
          if (data) await c.query('INSERT INTO struttura_blobs (struttura_id, kind, data) VALUES ($1,$2,$3)', [lite.id, kind, data]);
        }
        await c.query('INSERT INTO struttura_history (struttura_id, version, data, user_name, note) VALUES ($1,1,$2,$3,$4)',
          [lite.id, JSON.stringify(lite), 'migrazione', `Dati importati dalla versione precedente (salvataggio del ${env.savedAt || '?'})`]);
      }
      if (env.data?.brand) await c.query(`INSERT INTO app_settings (key, value) VALUES ('brand', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(env.data.brand)]);
    });
    console.log(`[seed] importate ${list.length} sedi dai dati iniziali`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate().then(() => { console.log('ok'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}
