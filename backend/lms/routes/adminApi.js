// backend/lms/routes/adminApi.js
// Assignments + Analytics for Training Team
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function adminApiRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin', 'training')];

  // ========== ASSIGNMENTS ==========

  // GET /api/lms/admin/assignments?learner_type_id=X
  router.get('/assignments', ...guard, async (req, res) => {
    const { learner_type_id } = req.query;
    try {
      const result = await pool.query(`
        SELECT la.*, l.title as lesson_title, lt.name as learner_type_name,
               s.title as section_title, c.title as course_title
        FROM lms_lesson_assignments la
        JOIN lms_lessons l ON la.lesson_id = l.id
        JOIN lms_learner_types lt ON la.learner_type_id = lt.id
        JOIN lms_sections s ON l.section_id = s.id
        JOIN lms_courses c ON s.course_id = c.id
        ${learner_type_id ? 'WHERE la.learner_type_id = $1' : ''}
        ORDER BY lt.name, c.title, s.sort_order, l.sort_order
      `, learner_type_id ? [learner_type_id] : []);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/assignments
  router.post('/assignments', ...guard, async (req, res) => {
    const { learner_type_id, lesson_id } = req.body;
    if (!learner_type_id || !lesson_id) return res.status(400).json({ error: 'learner_type_id and lesson_id required' });
    try {
      const result = await pool.query(`
        INSERT INTO lms_lesson_assignments (learner_type_id, lesson_id, assigned_by)
        VALUES ($1,$2,$3) ON CONFLICT (learner_type_id, lesson_id) DO NOTHING RETURNING *
      `, [learner_type_id, lesson_id, req.user.id]);
      res.status(201).json(result.rows[0] || { message: 'Already assigned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/lms/admin/assignments
  router.delete('/assignments', ...guard, async (req, res) => {
    const { learner_type_id, lesson_id } = req.body;
    try {
      await pool.query('DELETE FROM lms_lesson_assignments WHERE learner_type_id=$1 AND lesson_id=$2', [learner_type_id, lesson_id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ========== ANALYTICS ==========

  // GET /api/lms/admin/progress/users - All learners summary
  router.get('/progress/users', ...guard, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.email, u.display_name, lt.name as learner_type,
          COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int as completed_lessons,
          COUNT(DISTINCT ulp.lesson_id)::int as started_lessons,
          COALESCE(SUM(ulp.total_watch_seconds), 0)::int as total_watch_seconds,
          MAX(ulp.last_activity_at) as last_active,
          ROUND(AVG(ulp.percent_watched) FILTER (WHERE ulp.percent_watched > 0), 1) as avg_percent_watched
        FROM auth_users u
        LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
        LEFT JOIN lms_learner_types lt ON lp.learner_type_id = lt.id
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = u.id
        WHERE u.role = 'learner'
        GROUP BY u.id, lt.name
        ORDER BY last_active DESC NULLS LAST
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/progress/users/:userId - Per-user detail
  router.get('/progress/users/:userId', ...guard, async (req, res) => {
    try {
      const [userRes, progressRes, sessionsRes] = await Promise.all([
        pool.query(`
          SELECT u.id, u.email, u.display_name, lt.name as learner_type
          FROM auth_users u
          LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
          LEFT JOIN lms_learner_types lt ON lp.learner_type_id = lt.id
          WHERE u.id = $1
        `, [req.params.userId]),
        pool.query(`
          SELECT ulp.*, l.title as lesson_title, s.title as section_title, c.title as course_title
          FROM lms_user_lesson_progress ulp
          JOIN lms_lessons l ON ulp.lesson_id = l.id
          JOIN lms_sections s ON l.section_id = s.id
          JOIN lms_courses c ON s.course_id = c.id
          WHERE ulp.user_id = $1
          ORDER BY ulp.last_activity_at DESC
        `, [req.params.userId]),
        pool.query(`
          SELECT id, lesson_id, session_started_at, session_ended_at, total_active_seconds, total_idle_seconds
          FROM lms_learning_sessions WHERE user_id = $1 ORDER BY session_started_at DESC LIMIT 20
        `, [req.params.userId])
      ]);
      res.json({ user: userRes.rows[0], progress: progressRes.rows, sessions: sessionsRes.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/sessions/:sessionId/timeline
  router.get('/sessions/:sessionId/timeline', ...guard, async (req, res) => {
    try {
      const [sessionRes, eventsRes] = await Promise.all([
        pool.query(`
          SELECT s.*, u.display_name, l.title as lesson_title
          FROM lms_learning_sessions s
          JOIN auth_users u ON s.user_id = u.id
          JOIN lms_lessons l ON s.lesson_id = l.id
          WHERE s.id = $1
        `, [req.params.sessionId]),
        pool.query(`
          SELECT event_type, event_payload, client_ts, server_ts
          FROM lms_event_logs WHERE session_id = $1 ORDER BY client_ts ASC
        `, [req.params.sessionId])
      ]);
      res.json({ session: sessionRes.rows[0], events: eventsRes.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
