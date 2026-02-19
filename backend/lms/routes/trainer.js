import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function trainerRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('trainer', 'admin', 'training')];

  // GET /api/trainer/sessions — trainer sees their assigned sessions
  router.get('/sessions', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT ps.*,
          COUNT(pe.id)::int AS enrolled_count,
          COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'present')::int AS present_count,
          COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int  AS absent_count
        FROM lms_physical_sessions ps
        LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
        WHERE ps.trainer_id = $1
        GROUP BY ps.id
        ORDER BY ps.scheduled_date DESC, ps.start_time DESC
      `, [req.user.id]);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/trainer/sessions/:id/enrollments
  router.get('/sessions/:id/enrollments', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT pe.*, u.email, u.display_name, u.staff_id,
          lt.name AS learner_type_name
        FROM lms_physical_enrollments pe
        JOIN auth_users u ON pe.user_id = u.id
        LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
        WHERE pe.session_id = $1
        ORDER BY u.display_name
      `, [req.params.id]);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT /api/trainer/sessions/:id/attendance — trainer marks attendance
  router.put('/sessions/:id/attendance', ...guard, async (req, res) => {
    const { attendances } = req.body;
    if (!Array.isArray(attendances)) return res.status(400).json({ error: 'attendances array required' });
    try {
      for (const a of attendances) {
        await pool.query(`
          UPDATE lms_physical_enrollments
          SET attendance_status = $1, marked_at = NOW(), marked_by = $2
          WHERE session_id = $3 AND user_id = $4
        `, [a.status, req.user.id, req.params.id, a.user_id]);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/trainer/profile
  router.get('/profile', ...guard, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT id, email, display_name, staff_id, departments, specialties FROM auth_users WHERE id = $1',
        [req.user.id]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}