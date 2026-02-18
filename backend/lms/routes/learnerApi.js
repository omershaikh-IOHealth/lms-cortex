// backend/lms/routes/learnerApi.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const COMPLETION_THRESHOLD = 80; // percent

export default function learnerApiRoutes(pool) {
  const router = Router();
  router.use(requireAuth, requireRole('learner', 'admin', 'training'));

  // ─── CURRICULUM ──────────────────────────────────────────────────────────

  router.get('/curriculum', async (req, res) => {
    try {
      const profileRes = await pool.query(
        'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
        [req.user.id]
      );
      if (!profileRes.rows[0]) return res.json({ courses: [] });
      const { learner_type_id } = profileRes.rows[0];

      const lessonsRes = await pool.query(`
        SELECT c.id AS course_id, c.title AS course_title,
               s.id AS section_id, s.title AS section_title,
               s.sort_order AS section_order, s.parent_section_id,
               l.id AS lesson_id, l.title AS lesson_title,
               l.sort_order AS lesson_order, l.duration_seconds,
               COALESCE(ulp.percent_watched, 0)          AS percent_watched,
               COALESCE(ulp.completed, false)             AS completed,
               ulp.last_position_seconds
        FROM lms_lesson_assignments la
        JOIN lms_lessons  l ON la.lesson_id  = l.id
        JOIN lms_sections s ON l.section_id  = s.id
        JOIN lms_courses  c ON s.course_id   = c.id
        LEFT JOIN lms_user_lesson_progress ulp
          ON ulp.lesson_id = l.id AND ulp.user_id = $1
        WHERE la.learner_type_id = $2 AND l.is_active = true AND c.is_active = true
        ORDER BY c.title, s.sort_order, l.sort_order
      `, [req.user.id, learner_type_id]);

      const courseMap = {};
      for (const row of lessonsRes.rows) {
        if (!courseMap[row.course_id])
          courseMap[row.course_id] = { id: row.course_id, title: row.course_title, sections: {} };
        const sections = courseMap[row.course_id].sections;
        if (!sections[row.section_id])
          sections[row.section_id] = {
            id: row.section_id, title: row.section_title,
            sort_order: row.section_order, parent_section_id: row.parent_section_id,
            lessons: []
          };
        sections[row.section_id].lessons.push({
          id: row.lesson_id, title: row.lesson_title,
          sort_order: row.lesson_order, duration_seconds: row.duration_seconds,
          percent_watched: row.percent_watched, completed: row.completed,
          last_position_seconds: row.last_position_seconds
        });
      }

      const courses = Object.values(courseMap).map(c => ({
        ...c, sections: Object.values(c.sections)
      }));
      res.json({ courses });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── LESSONS ─────────────────────────────────────────────────────────────

  router.get('/lessons/:id', async (req, res) => {
    try {
      const profileRes = await pool.query(
        'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
        [req.user.id]
      );
      const learnerTypeId = profileRes.rows[0]?.learner_type_id;

      const accessCheck = await pool.query(`
        SELECT l.* FROM lms_lessons l
        JOIN lms_lesson_assignments la ON la.lesson_id = l.id
        WHERE l.id = $1 AND la.learner_type_id = $2 AND l.is_active = true
      `, [req.params.id, learnerTypeId]);

      if (!accessCheck.rows[0] && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Access denied to this lesson' });

      const lesson = accessCheck.rows[0];
      const progressRes = await pool.query(
        'SELECT * FROM lms_user_lesson_progress WHERE user_id=$1 AND lesson_id=$2',
        [req.user.id, req.params.id]
      );
      res.json({ lesson, progress: progressRes.rows[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── SESSIONS ────────────────────────────────────────────────────────────

  router.post('/sessions', async (req, res) => {
    const { lesson_id } = req.body;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id required' });
    try {
      const result = await pool.query(`
        INSERT INTO lms_learning_sessions (user_id, lesson_id) VALUES ($1,$2) RETURNING id
      `, [req.user.id, lesson_id]);
      res.status(201).json({ session_id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.patch('/sessions/:id/end', async (req, res) => {
    const { total_active_seconds, total_idle_seconds } = req.body;
    try {
      await pool.query(`
        UPDATE lms_learning_sessions
        SET session_ended_at     = NOW(),
            total_active_seconds = COALESCE($1, total_active_seconds),
            total_idle_seconds   = COALESCE($2, total_idle_seconds)
        WHERE id = $3 AND user_id = $4
      `, [total_active_seconds, total_idle_seconds, req.params.id, req.user.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── EVENTS ──────────────────────────────────────────────────────────────

  router.post('/events/batch', async (req, res) => {
    const { session_id, lesson_id, events } = req.body;
    if (!Array.isArray(events) || !events.length) return res.json({ ok: true, count: 0 });
    try {
      const values = events.map((e, i) => {
        const base = i * 5;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`;
      }).join(',');
      const params = events.flatMap(e => [
        session_id, req.user.id, lesson_id,
        e.event_type, JSON.stringify(e.payload || {})
      ]);
      await pool.query(`
        INSERT INTO lms_event_logs (session_id, user_id, lesson_id, event_type, event_payload, client_ts)
        VALUES ${values}
      `.replace(/\(\$\d+,\$\d+,\$\d+,\$\d+,\$\d+\)/g, (m, i) => m + ',NOW()'), params);

      // Increment active seconds from video heartbeats
      const heartbeats = events.filter(e => e.event_type === 'video_progress_heartbeat');
      if (heartbeats.length > 0 && session_id) {
        await pool.query(`
          UPDATE lms_learning_sessions
          SET total_active_seconds = total_active_seconds + $1
          WHERE id = $2
        `, [heartbeats.length * 5, session_id]);
      }

      res.json({ ok: true, count: events.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── PROGRESS ────────────────────────────────────────────────────────────

  router.post('/progress', async (req, res) => {
    const { lesson_id, percent_watched, last_position_seconds, total_watch_seconds_delta } = req.body;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id required' });
    try {
      const completed = percent_watched >= COMPLETION_THRESHOLD;
      await pool.query(`
        INSERT INTO lms_user_lesson_progress
          (user_id, lesson_id, percent_watched, last_position_seconds,
           total_watch_seconds, completed, completed_at, watch_count, last_activity_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,1,NOW())
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          percent_watched      = GREATEST(lms_user_lesson_progress.percent_watched, EXCLUDED.percent_watched),
          last_position_seconds = EXCLUDED.last_position_seconds,
          total_watch_seconds  = lms_user_lesson_progress.total_watch_seconds + COALESCE($5, 0),
          completed            = CASE WHEN EXCLUDED.percent_watched >= ${COMPLETION_THRESHOLD}
                                      THEN true ELSE lms_user_lesson_progress.completed END,
          completed_at         = CASE WHEN EXCLUDED.percent_watched >= ${COMPLETION_THRESHOLD}
                                       AND lms_user_lesson_progress.completed = false
                                      THEN NOW() ELSE lms_user_lesson_progress.completed_at END,
          watch_count          = CASE WHEN EXCLUDED.percent_watched <= 20
                                       AND lms_user_lesson_progress.percent_watched > 80
                                      THEN lms_user_lesson_progress.watch_count + 1
                                      ELSE lms_user_lesson_progress.watch_count END,
          last_activity_at     = NOW()
      `, [req.user.id, lesson_id, percent_watched, last_position_seconds,
          total_watch_seconds_delta || 0, completed, completed ? new Date() : null]);
      res.json({ ok: true, completed });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/progress', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ulp.*, l.title AS lesson_title
        FROM lms_user_lesson_progress ulp
        JOIN lms_lessons l ON ulp.lesson_id = l.id
        WHERE ulp.user_id = $1
      `, [req.user.id]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── PHYSICAL TRAINING SCHEDULE (learner-facing) ─────────────────────────

  // GET /api/lms/me/schedule — learner's upcoming + past physical sessions
  router.get('/schedule', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          pe.attendance_status, pe.acknowledged_at,
          ps.id AS session_id, ps.title, ps.description,
          ps.scheduled_date, ps.start_time, ps.end_time,
          ps.location, ps.status AS session_status,
          trainer.display_name AS trainer_name, trainer.email AS trainer_email
        FROM lms_physical_enrollments pe
        JOIN lms_physical_sessions ps ON pe.session_id = ps.id
        LEFT JOIN auth_users trainer ON ps.trainer_id = trainer.id
        WHERE pe.user_id = $1 AND ps.status != 'cancelled'
        ORDER BY ps.scheduled_date DESC, ps.start_time DESC
      `, [req.user.id]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/lms/me/schedule/:sessionId/acknowledge
  router.patch('/schedule/:sessionId/acknowledge', async (req, res) => {
    try {
      await pool.query(`
        UPDATE lms_physical_enrollments
        SET acknowledged_at = NOW()
        WHERE session_id = $1 AND user_id = $2 AND acknowledged_at IS NULL
      `, [req.params.sessionId, req.user.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────

  // GET /api/lms/me/notifications
  router.get('/notifications', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM lms_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user.id]);
      const unread = result.rows.filter(n => !n.is_read).length;
      res.json({ notifications: result.rows, unread });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/lms/me/notifications/read — mark ids as read (or all if no ids)
  router.patch('/notifications/read', async (req, res) => {
    const { ids } = req.body; // optional array
    try {
      if (ids?.length) {
        await pool.query(
          `UPDATE lms_notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::int[])`,
          [req.user.id, ids]
        );
      } else {
        await pool.query(
          `UPDATE lms_notifications SET is_read = true WHERE user_id = $1`,
          [req.user.id]
        );
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}