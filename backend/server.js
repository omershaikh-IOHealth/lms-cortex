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

import departmentsRoutes from './lms/routes/departments.js';
import usersRoutes       from './lms/routes/users.js';
import trainerRoutes     from './lms/routes/trainer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
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

// NEW — replace with:
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
  options: '--search_path=test'
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ DB connection failed:', err.message);
  else     console.log('✅ LMS DB connected:', res.rows[0].now);
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