import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import authRoutes from './lms/routes/auth.js';
import learnerTypeRoutes from './lms/routes/learnerTypes.js';
import learnerRoutes from './lms/routes/learners.js';
import contentRoutes from './lms/routes/content.js';
import adminApiRoutes from './lms/routes/adminApi.js';
import learnerApiRoutes from './lms/routes/learnerApi.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001; // different port from dashboard

app.use(cors());
app.use(express.json());
app.use(cookieParser());

const __lms_dir = dirname(fileURLToPath(import.meta.url));
app.use('/uploads/videos', express.static(`${__lms_dir}/uploads/videos`, {
  dotfiles: 'deny',
  setHeaders: (res) => { res.setHeader('Accept-Ranges', 'bytes'); }
}));

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
  options: '--search_path=test'
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ DB connection failed:', err.message);
  else console.log('✅ LMS DB connected:', res.rows[0].now);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'cortex-lms' }));

app.use('/api/auth',        authRoutes(pool));
app.use('/api/lms/auth',        authRoutes(pool));
app.use('/api/lms/learner-types', learnerTypeRoutes(pool));
app.use('/api/lms/learners',    learnerRoutes(pool));
app.use('/api/lms/content',     contentRoutes(pool));
app.use('/api/lms/admin',       adminApiRoutes(pool));
app.use('/api/lms/learn',       learnerApiRoutes(pool));

app.listen(PORT, () => console.log(`🚀 LMS server running on port ${PORT}`));
