import pg from 'pg';

const password = 'dS7R-v.Cu9-#Mf$';
const user_pooler = 'postgres.alobxvlwznumwikxqewb';
const dbname = 'postgres';

const attempts = [
  { host: 'aws-1-ap-northeast-1.pooler.supabase.com', port: 6543, user: user_pooler, label: 'Pooler aws-1-ap-northeast-1 6543' },
  { host: 'aws-1-ap-northeast-1.pooler.supabase.com', port: 5432, user: user_pooler, label: 'Pooler aws-1-ap-northeast-1 5432' },
  { host: 'db.alobxvlwznumwikxqewb.supabase.co',      port: 5432, user: 'postgres',   label: 'Direct DB 5432' },
];

for (const a of attempts) {
  const pool = new pg.Pool({
    host: a.host, port: a.port,
    database: dbname, user: a.user, password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    const r = await pool.query('SELECT NOW()');
    console.log(`SUCCESS [${a.label}]:`, r.rows[0]);
  } catch (e) {
    console.log(`FAIL [${a.label}]: ${e.message}`);
  }
  await pool.end().catch(() => {});
}
process.exit(0);