// backend/lms/routes/content.js
import { Router } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, requireRole } from '../middleware/auth.js';

let _supabase = null;
const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
};
const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

// Use memory storage — no local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = ['video/mp4', 'video/webm', 'video/ogg'].includes(file.mimetype);
    cb(ok ? null : new Error('Only mp4/webm/ogg allowed'), ok);
  },
});

const deleteVideoFile = async (video_url) => {
  if (!video_url) return;
  // Handle both old local paths and new Supabase URLs
  if (video_url.startsWith('/uploads/')) return; // old local file, skip
  try {
    const filename = video_url.split('/').pop();
    await getSupabase().storage.from(BUCKET).remove([filename]);
  } catch {}
};

const uploadToSupabase = async (file) => {
  const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
  const { error } = await getSupabase().storage
  .from(BUCKET)
  .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
if (error) throw new Error(error.message);
const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
};

export default function contentRoutes(pool) {
  const router = Router();
  const guard  = [requireAuth, requireRole('admin', 'training')];

  // ─── COURSES ──────────────────────────────────────────────────────────────

  router.get('/courses', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*,
          COUNT(DISTINCT l.id)::int AS lesson_count
        FROM lms_courses c
        LEFT JOIN lms_sections s ON s.course_id = c.id
        LEFT JOIN lms_lessons l  ON l.section_id = s.id
        GROUP BY c.id ORDER BY c.title
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/courses', ...guard, async (req, res) => {
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    try {
      const r = await pool.query(
        'INSERT INTO lms_courses (title, description, created_by) VALUES ($1,$2,$3) RETURNING *',
        [title.trim(), description || null, req.user.id]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/courses/:id', ...guard, async (req, res) => {
    const { title, description, is_active } = req.body;
    try {
      const r = await pool.query(`
        UPDATE lms_courses SET
          title       = COALESCE($1, title),
          description = COALESCE($2, description),
          is_active   = COALESCE($3, is_active),
          updated_at  = NOW()
        WHERE id = $4 RETURNING *
      `, [title?.trim(), description, is_active, req.params.id]);
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/courses/:id', ...guard, async (req, res) => {
    try {
      // Collect all video files before deletion for cleanup
      const videos = await pool.query(`
        SELECT l.video_url FROM lms_lessons l
        JOIN lms_sections s ON l.section_id = s.id
        WHERE s.course_id = $1 AND l.video_url IS NOT NULL
      `, [req.params.id]);
      videos.rows.forEach(r => deleteVideoFile(r.video_url));
      await pool.query('DELETE FROM lms_courses WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Full course tree
  router.get('/courses/:courseId/tree', requireAuth, async (req, res) => {
    try {
      const sections = await pool.query(`
        SELECT s.*,
          json_agg(
            json_build_object(
              'id', l.id, 'title', l.title, 'video_url', l.video_url,
              'duration_seconds', l.duration_seconds, 'sort_order', l.sort_order,
              'is_active', l.is_active, 'manual_markdown', l.manual_markdown
            ) ORDER BY l.sort_order
          ) FILTER (WHERE l.id IS NOT NULL) AS lessons
        FROM lms_sections s
        LEFT JOIN lms_lessons l ON l.section_id = s.id
        WHERE s.course_id = $1
        GROUP BY s.id ORDER BY s.sort_order, s.parent_section_id NULLS FIRST
      `, [req.params.courseId]);
      res.json(sections.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── SECTIONS ─────────────────────────────────────────────────────────────

  router.post('/sections', ...guard, async (req, res) => {
    const { course_id, parent_section_id, title, sort_order } = req.body;
    if (!course_id || !title?.trim()) return res.status(400).json({ error: 'course_id and title required' });
    try {
      const r = await pool.query(
        'INSERT INTO lms_sections (course_id, parent_section_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [course_id, parent_section_id || null, title.trim(), sort_order || 0]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/sections/:id', ...guard, async (req, res) => {
    const { title, sort_order } = req.body;
    try {
      const r = await pool.query(
        'UPDATE lms_sections SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), updated_at=NOW() WHERE id=$3 RETURNING *',
        [title?.trim(), sort_order, req.params.id]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/sections/:id', ...guard, async (req, res) => {
    try {
      // Delete video files for lessons in this section
      const videos = await pool.query(
        'SELECT video_url FROM lms_lessons WHERE section_id = $1 AND video_url IS NOT NULL',
        [req.params.id]
      );
      videos.rows.forEach(r => deleteVideoFile(r.video_url));
      // Also clean up child sections' lessons
      const childVideos = await pool.query(`
        SELECT l.video_url FROM lms_lessons l
        JOIN lms_sections s ON l.section_id = s.id
        WHERE s.parent_section_id = $1 AND l.video_url IS NOT NULL
      `, [req.params.id]);
      childVideos.rows.forEach(r => deleteVideoFile(r.video_url));

      await pool.query('DELETE FROM lms_sections WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── LESSONS ──────────────────────────────────────────────────────────────

  router.post('/lessons', ...guard, upload.single('video'), async (req, res) => {
    const { section_id, title, manual_markdown, sort_order, duration_seconds } = req.body;
    if (!section_id || !title?.trim()) return res.status(400).json({ error: 'section_id and title required' });
    let video_url = null;
      if (req.file) {
        const { url, storagePath } = await uploadToSupabase(req.file);
        video_url = url;        // public HTTPS URL for playback
        // store storagePath in a separate col OR just store the url and delete by listing — simplest:
        video_url = url;
      }
    try {
      const r = await pool.query(`
        INSERT INTO lms_lessons (section_id, title, video_url, manual_markdown, sort_order, duration_seconds, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
      `, [section_id, title.trim(), video_url, manual_markdown || null, sort_order || 0, duration_seconds || null, req.user.id]);
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/lessons/:id', ...guard, upload.single('video'), async (req, res) => {
    const { title, manual_markdown, sort_order, is_active, duration_seconds } = req.body;
    let videoClause = '';
    const params = [title?.trim(), manual_markdown, sort_order, is_active, duration_seconds, req.user.id, req.params.id];

    if (req.file) {
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [req.params.id]);
      await deleteVideoFile(old.rows[0]?.video_url);
      const newUrl = await uploadToSupabase(req.file);
      videoClause = `, video_url = $8`;
      params.push(newUrl);
    }

    try {
      const r = await pool.query(`
        UPDATE lms_lessons SET
          title            = COALESCE($1, title),
          manual_markdown  = COALESCE($2, manual_markdown),
          sort_order       = COALESCE($3, sort_order),
          is_active        = COALESCE($4, is_active),
          duration_seconds = COALESCE($5, duration_seconds),
          updated_by       = $6,
          updated_at       = NOW()
          ${videoClause}
        WHERE id = $7 RETURNING *
      `, params);
      if (!r.rows[0]) return res.status(404).json({ error: 'Lesson not found' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /lessons/:id/remove-video — clears video only, keeps lesson
  router.patch('/lessons/:id/remove-video', ...guard, async (req, res) => {
    try {
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [req.params.id]);
      deleteVideoFile(old.rows[0]?.video_url);
      await pool.query(
        'UPDATE lms_lessons SET video_url = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
        [req.user.id, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/lessons/:id', ...guard, async (req, res) => {
    try {
      const r = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [req.params.id]);
      deleteVideoFile(r.rows[0]?.video_url);
      await pool.query('DELETE FROM lms_lessons WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/lessons/:id', requireAuth, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}