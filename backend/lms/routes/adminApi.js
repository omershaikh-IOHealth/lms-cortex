// backend/lms/routes/adminApi.js
// Assignments + Analytics + Learner Profiles
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function adminApiRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin', 'training', 'trainer')];

  // ─── ASSIGNMENTS ─────────────────────────────────────────────────────────

  router.get('/assignments', ...guard, async (req, res) => {
    const { learner_type_id } = req.query;
    try {
      const result = await pool.query(`
        SELECT la.*, l.title as lesson_title, lt.name as learner_type_name,
               s.title as section_title, c.title as course_title
        FROM lms_lesson_assignments la
        JOIN lms_lessons l        ON la.lesson_id        = l.id
        JOIN lms_learner_types lt ON la.learner_type_id  = lt.id
        JOIN lms_sections s       ON l.section_id        = s.id
        JOIN lms_courses c        ON s.course_id         = c.id
        ${learner_type_id ? 'WHERE la.learner_type_id = $1' : ''}
        ORDER BY lt.name, c.title, s.sort_order, l.sort_order
      `, learner_type_id ? [learner_type_id] : []);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/assignments', ...guard, async (req, res) => {
    const { learner_type_id, lesson_id } = req.body;
    if (!learner_type_id || !lesson_id)
      return res.status(400).json({ error: 'learner_type_id and lesson_id required' });
    try {
      const result = await pool.query(`
        INSERT INTO lms_lesson_assignments (learner_type_id, lesson_id, assigned_by)
        VALUES ($1,$2,$3) ON CONFLICT (learner_type_id, lesson_id) DO NOTHING RETURNING *
      `, [learner_type_id, lesson_id, req.user.id]);
      res.status(201).json(result.rows[0] || { message: 'Already assigned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/assignments', ...guard, async (req, res) => {
    const { learner_type_id, lesson_id } = req.body;
    try {
      await pool.query(
        'DELETE FROM lms_lesson_assignments WHERE learner_type_id=$1 AND lesson_id=$2',
        [learner_type_id, lesson_id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── ANALYTICS ───────────────────────────────────────────────────────────

  // GET /api/lms/admin/progress/users — all learners summary table (with filters)
  router.get('/progress/users', ...guard, async (req, res) => {
    try {
      const { department, specialty, learner_type } = req.query;
      let whereExtra = '';
      const params = [];
      if (department) {
        params.push(department);
        whereExtra += ` AND $${params.length} = ANY(u.departments)`;
      }
      if (specialty) {
        params.push(specialty);
        whereExtra += ` AND $${params.length} = ANY(u.specialties)`;
      }
      if (learner_type) {
        params.push(learner_type);
        whereExtra += ` AND lt.name = $${params.length}`;
      }
      const result = await pool.query(`
        SELECT
          u.id, u.email, u.display_name, u.is_active, u.created_at,
          u.staff_id, u.departments, u.specialties,
          lt.name AS learner_type,
          COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int  AS completed_lessons,
          COUNT(DISTINCT ulp.lesson_id)::int                                       AS started_lessons,
          COALESCE(SUM(ulp.total_watch_seconds), 0)::int                           AS total_watch_seconds,
          MAX(ulp.last_activity_at)                                                AS last_active,
          ROUND(AVG(ulp.percent_watched) FILTER (WHERE ulp.percent_watched > 0), 1) AS avg_percent_watched,
          (SELECT COUNT(*)::int FROM lms_physical_enrollments pe
           WHERE pe.user_id = u.id AND pe.attendance_status = 'present')           AS physical_attended
        FROM auth_users u
        LEFT JOIN lms_learner_profiles  lp  ON lp.user_id        = u.id
        LEFT JOIN lms_learner_types     lt  ON lp.learner_type_id = lt.id
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id    = u.id
        WHERE u.role = 'learner' ${whereExtra}
        GROUP BY u.id, lt.name
        ORDER BY last_active DESC NULLS LAST
      `, params);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/analytics/summary — aggregate stats by department/specialty/course
  router.get('/analytics/summary', ...guard, async (req, res) => {
    try {
      const { department, specialty, learner_type } = req.query;
      let whereExtra = '';
      const params = [];
      if (department) { params.push(department); whereExtra += ` AND $${params.length} = ANY(u.departments)`; }
      if (specialty) { params.push(specialty); whereExtra += ` AND $${params.length} = ANY(u.specialties)`; }
      if (learner_type) { params.push(learner_type); whereExtra += ` AND lt.name = $${params.length}`; }

      // Department breakdown
      const deptResult = await pool.query(`
        SELECT dept, COUNT(DISTINCT u.id)::int AS learner_count,
               COALESCE(SUM(ulp.total_watch_seconds), 0)::int AS total_watch_seconds,
               COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int AS completed_lessons
        FROM auth_users u, UNNEST(u.departments) AS dept
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = u.id
        WHERE u.role = 'learner'
        GROUP BY dept ORDER BY learner_count DESC
      `);

      // Course completion rates
      const courseResult = await pool.query(`
        SELECT c.id, c.title AS course_title,
               COUNT(DISTINCT ulp.user_id)::int AS active_learners,
               COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int AS lessons_completed,
               COUNT(DISTINCT l.id)::int AS total_lessons,
               ROUND(AVG(ulp.percent_watched) FILTER (WHERE ulp.percent_watched > 0), 1) AS avg_progress
        FROM lms_courses c
        JOIN lms_sections s ON s.course_id = c.id
        JOIN lms_lessons l ON l.section_id = s.id
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.lesson_id = l.id
        GROUP BY c.id, c.title ORDER BY active_learners DESC
      `);

      // Learner type breakdown
      const typeResult = await pool.query(`
        SELECT lt.name AS learner_type,
               COUNT(DISTINCT u.id)::int AS learner_count,
               COALESCE(SUM(ulp.total_watch_seconds), 0)::int AS total_watch_seconds,
               COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int AS completed_lessons
        FROM auth_users u
        LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
        LEFT JOIN lms_learner_types lt ON lp.learner_type_id = lt.id
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = u.id
        WHERE u.role = 'learner'
        GROUP BY lt.name ORDER BY learner_count DESC
      `);

      // Weekly activity (last 8 weeks)
      const weeklyResult = await pool.query(`
        SELECT
          DATE_TRUNC('week', ulp.last_activity_at)::date AS week_start,
          COUNT(DISTINCT ulp.user_id)::int AS active_learners,
          COALESCE(SUM(ulp.total_watch_seconds), 0)::int AS watch_seconds
        FROM lms_user_lesson_progress ulp
        WHERE ulp.last_activity_at > NOW() - INTERVAL '8 weeks'
        GROUP BY week_start ORDER BY week_start
      `);

      res.json({
        byDepartment: deptResult.rows,
        byCourse: courseResult.rows,
        byLearnerType: typeResult.rows,
        weeklyActivity: weeklyResult.rows,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/departments — list all departments
  router.get('/departments', ...guard, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM lms_departments WHERE is_active = true ORDER BY name'
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/specialties — list all specialties
  router.get('/specialties', ...guard, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM lms_specialties WHERE is_active = true ORDER BY name'
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/progress/users/:userId — per-user analytics detail
  router.get('/progress/users/:userId', ...guard, async (req, res) => {
    try {
      const [userRes, progressRes, sessionsRes] = await Promise.all([
        pool.query(`
          SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
                 u.staff_id, u.departments, u.specialties,
                 lt.name AS learner_type, lt.id AS learner_type_id,
                 lp.id AS profile_id
          FROM auth_users u
          LEFT JOIN lms_learner_profiles lp ON lp.user_id        = u.id
          LEFT JOIN lms_learner_types    lt ON lp.learner_type_id = lt.id
          WHERE u.id = $1
        `, [req.params.userId]),
        pool.query(`
          SELECT ulp.*, l.title AS lesson_title,
                 s.title AS section_title, c.title AS course_title
          FROM lms_user_lesson_progress ulp
          JOIN lms_lessons  l ON ulp.lesson_id  = l.id
          JOIN lms_sections s ON l.section_id   = s.id
          JOIN lms_courses  c ON s.course_id    = c.id
          WHERE ulp.user_id = $1
          ORDER BY ulp.last_activity_at DESC
        `, [req.params.userId]),
        pool.query(`
          SELECT ls.id, ls.lesson_id, ls.session_started_at, ls.session_ended_at,
                 ls.total_active_seconds, ls.total_idle_seconds,
                 l.title AS lesson_title
          FROM lms_learning_sessions ls
          JOIN lms_lessons l ON ls.lesson_id = l.id
          WHERE ls.user_id = $1
          ORDER BY ls.session_started_at DESC
          LIMIT 30
        `, [req.params.userId])
      ]);

      if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });

      // Top 3 most-watched lessons
      const topLessons = [...progressRes.rows]
        .sort((a, b) => (b.watch_count || 0) - (a.watch_count || 0) || (b.total_watch_seconds || 0) - (a.total_watch_seconds || 0))
        .slice(0, 3);

      // Curriculum totals — count all lessons assigned to this learner's type
      const assignedRes = await pool.query(`
        SELECT COUNT(DISTINCT la.lesson_id)::int AS total_assigned
        FROM lms_lesson_assignments la
        JOIN lms_learner_profiles lp ON lp.learner_type_id = la.learner_type_id
        WHERE lp.user_id = $1
      `, [req.params.userId]);
      const totalAssigned = assignedRes.rows[0]?.total_assigned || 0;

      // Physical training history
      const physicalRes = await pool.query(`
        SELECT
          pe.attendance_status, pe.acknowledged_at, pe.marked_at, pe.created_at AS enrolled_at,
          ps.id AS session_id, ps.title, ps.scheduled_date, ps.start_time, ps.end_time,
          ps.location, ps.status AS session_status,
          trainer.display_name AS trainer_name
        FROM lms_physical_enrollments pe
        JOIN lms_physical_sessions ps ON pe.session_id = ps.id
        LEFT JOIN auth_users trainer  ON ps.trainer_id  = trainer.id
        WHERE pe.user_id = $1
        ORDER BY ps.scheduled_date DESC
      `, [req.params.userId]);

      res.json({
        user:            userRes.rows[0],
        progress:        progressRes.rows,
        topLessons,
        sessions:        sessionsRes.rows,
        totalAssigned,
        physicalTrainings: physicalRes.rows,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/sessions/:sessionId/timeline
  router.get('/sessions/:sessionId/timeline', ...guard, async (req, res) => {
    try {
      const [sessionRes, eventsRes] = await Promise.all([
        pool.query(`
          SELECT s.*, u.display_name, l.title AS lesson_title
          FROM lms_learning_sessions s
          JOIN auth_users u ON s.user_id   = u.id
          JOIN lms_lessons l ON s.lesson_id = l.id
          WHERE s.id = $1
        `, [req.params.sessionId]),
        pool.query(`
          SELECT event_type, event_payload, client_ts, server_ts
          FROM lms_event_logs
          WHERE session_id = $1
          ORDER BY client_ts ASC
        `, [req.params.sessionId])
      ]);
      res.json({ session: sessionRes.rows[0], events: eventsRes.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}