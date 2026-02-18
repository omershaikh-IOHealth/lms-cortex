import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import authRoutes            from './lms/routes/auth.js';
import learnerTypeRoutes     from './lms/routes/learnerTypes.js';
import learnerRoutes         from './lms/routes/learners.js';
import contentRoutes         from './lms/routes/content.js';
import adminApiRoutes        from './lms/routes/adminApi.js';
import learnerApiRoutes      from './lms/routes/learnerApi.js';
import physicalTrainingRoutes from './lms/routes/physicalTraining.js';
import calendarRoutes         from './lms/routes/calendar.js';
import { readFileSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded videos — must be before route handlers
const __lms_dir = dirname(fileURLToPath(import.meta.url));
app.use('/uploads/videos', express.static(`${__lms_dir}/uploads/videos`, {
  dotfiles: 'deny',
  setHeaders: (res) => {
    // Range requests enable scrubbing/seeking from any device on the LAN
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

const pool = new pg.Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
  options: '--search_path=test'
});

// Auto-run migration on startup (idempotent — uses IF NOT EXISTS)
async function runMigration() {
  try {
    const migrationPath = `${__lms_dir}/migrations/001_department_trainer_calendar.sql`;
    const sql = readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration applied successfully');
  } catch (err) {
    // Migration may fail if already applied — that's OK for IF NOT EXISTS statements
    console.log('⚠️  Migration note:', err.message?.slice(0, 100));
  }
}

pool.query('SELECT NOW()', async (err, res) => {
  if (err) console.error('❌ DB connection failed:', err.message);
  else {
    console.log('✅ LMS DB connected:', res.rows[0].now);
    await runMigration();
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'cortex-lms' }));

// Auth — dual mount so both /api/auth and /api/lms/auth work
app.use('/api/auth',          authRoutes(pool));
app.use('/api/lms/auth',      authRoutes(pool));

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────
// Mount under /api/lms/admin/* to match what the frontend calls
app.use('/api/lms/admin/learner-types',     learnerTypeRoutes(pool));
app.use('/api/lms/admin/learners',          learnerRoutes(pool));
app.use('/api/lms/admin/content',           contentRoutes(pool));
app.use('/api/lms/admin/physical-sessions', physicalTrainingRoutes(pool));
app.use('/api/lms/admin/calendar',          calendarRoutes(pool));
// Assignments + analytics + learner profile live in adminApi
app.use('/api/lms/admin',                   adminApiRoutes(pool));

// Keep legacy mounts so any direct calls still work
app.use('/api/lms/learner-types', learnerTypeRoutes(pool));
app.use('/api/lms/learners',      learnerRoutes(pool));
app.use('/api/lms/content',       contentRoutes(pool));

// ── LEARNER ROUTES ────────────────────────────────────────────────────────
// Frontend calls /api/lms/me/* — mount learnerApi here
app.use('/api/lms/me',    learnerApiRoutes(pool));
// Keep /api/lms/learn/* as alias
app.use('/api/lms/learn', learnerApiRoutes(pool));

app.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 LMS server running on port ${PORT} (accessible on LAN)`)
);