import pg from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '6543'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
      options: '--search_path=test',
    });
  }
  return pool;
}
