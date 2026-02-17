// backend/lms/routes/content.js
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (/video\/(mp4|webm|ogg)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only mp4/webm/ogg video files are allowed'));
  }
});

export default function contentRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin', 'training')];

  // ========== COURSES ==========
  router.get('/courses', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*,
          COUNT(DISTINCT s.id)::int as section_count,
          COUNT(DISTINCT l.id)::int as lesson_count
        FROM lms_courses c
        LEFT JOIN lms_sections s ON s.course_id = c.id
        LEFT JOIN lms_sections s2 ON s2.course_id = c.id
        LEFT JOIN lms_lessons l ON l.section_id IN (
          SELECT id FROM lms_sections WHERE course_id = c.id
        )
        WHERE c.is_active = true
        GROUP BY c.id ORDER BY c.title
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/courses', ...guard, async (req, res) => {
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    try {
      const result = await pool.query(
        'INSERT INTO lms_courses (title, description, created_by) VALUES ($1,$2,$3) RETURNING *',
        [title.trim(), description, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Full course tree (for training team content view)
  router.get('/courses/:courseId/tree', requireAuth, async (req, res) => {
    try {
      const sections = await pool.query(`
        SELECT s.*, 
          json_agg(
            json_build_object(
              'id', l.id, 'title', l.title, 'video_url', l.video_url,
              'duration_seconds', l.duration_seconds, 'sort_order', l.sort_order,
              'is_active', l.is_active
            ) ORDER BY l.sort_order
          ) FILTER (WHERE l.id IS NOT NULL) as lessons
        FROM lms_sections s
        LEFT JOIN lms_lessons l ON l.section_id = s.id
        WHERE s.course_id = $1
        GROUP BY s.id ORDER BY s.sort_order, s.parent_section_id NULLS FIRST
      `, [req.params.courseId]);
      res.json(sections.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ========== SECTIONS ==========
  router.post('/sections', ...guard, async (req, res) => {
    const { course_id, parent_section_id, title, sort_order } = req.body;
    if (!course_id || !title?.trim()) return res.status(400).json({ error: 'course_id and title required' });
    try {
      const result = await pool.query(
        'INSERT INTO lms_sections (course_id, parent_section_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [course_id, parent_section_id || null, title.trim(), sort_order || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/sections/:id', ...guard, async (req, res) => {
    const { title, sort_order } = req.body;
    try {
      const result = await pool.query(
        'UPDATE lms_sections SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), updated_at=NOW() WHERE id=$3 RETURNING *',
        [title?.trim(), sort_order, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ========== LESSONS ==========
  router.post('/lessons', ...guard, upload.single('video'), async (req, res) => {
    const { section_id, title, manual_markdown, sort_order, duration_seconds } = req.body;
    if (!section_id || !title?.trim()) return res.status(400).json({ error: 'section_id and title required' });
    const video_url = req.file ? `/uploads/videos/${req.file.filename}` : null;
    try {
      const result = await pool.query(`
        INSERT INTO lms_lessons (section_id, title, video_url, manual_markdown, sort_order, duration_seconds, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
      `, [section_id, title.trim(), video_url, manual_markdown, sort_order || 0, duration_seconds || null, req.user.id]);
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/lessons/:id', ...guard, upload.single('video'), async (req, res) => {
    const { title, manual_markdown, sort_order, is_active, duration_seconds } = req.body;
    let video_url_update = '';
    const params = [title?.trim(), manual_markdown, sort_order, is_active, duration_seconds, req.user.id, req.params.id];
    if (req.file) {
      video_url_update = ', video_url = $8';
      params.push(`/uploads/videos/${req.file.filename}`);
    }
    try {
      const result = await pool.query(`
        UPDATE lms_lessons
        SET title = COALESCE($1, title),
            manual_markdown = COALESCE($2, manual_markdown),
            sort_order = COALESCE($3, sort_order),
            is_active = COALESCE($4, is_active),
            duration_seconds = COALESCE($5, duration_seconds),
            updated_by = $6,
            updated_at = NOW()
            ${video_url_update}
        WHERE id = $7 RETURNING *
      `, params);
      if (!result.rows[0]) return res.status(404).json({ error: 'Lesson not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/lessons/:id', requireAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
