import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function trainerRoutes(pool) {
  const router = Router();
  const guard  = [requireAuth, requireRole('trainer', 'admin', 'training')];

  // ownership check helper — trainer can only touch their own sessions
  const ownSession = async (sessionId, userId) => {
    const r = await pool.query(
      `SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2`,
      [sessionId, userId]
    );
    return r.rows.length > 0;
  };

  // ── GET /api/trainer/sessions ─────────────────────────────────────────────
  router.get('/sessions', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT ps.*,
          COUNT(pe.id)::int                                                    AS enrolled_count,
          COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'present')::int   AS present_count,
          COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int    AS absent_count
        FROM lms_physical_sessions ps
        LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
        WHERE ps.trainer_id = $1
        GROUP BY ps.id
        ORDER BY ps.scheduled_date DESC, ps.start_time DESC
      `, [req.user.id]);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/trainer/sessions — create a new session ────────────────────
  router.post('/sessions', ...guard, async (req, res) => {
    const { title, description, location, scheduled_date, start_time, end_time, max_capacity } = req.body;
    if (!title || !scheduled_date || !start_time || !end_time)
      return res.status(400).json({ error: 'title, scheduled_date, start_time, end_time are required' });
    try {
      const r = await pool.query(`
        INSERT INTO lms_physical_sessions
          (title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$4)
        RETURNING *
      `, [title, description || null, location || null, req.user.id,
          scheduled_date, start_time, end_time, max_capacity || null]);
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/trainer/sessions/:id — edit own session ─────────────────────
  router.put('/sessions/:id', ...guard, async (req, res) => {
    if (!(await ownSession(req.params.id, req.user.id)))
      return res.status(403).json({ error: 'Not your session' });

    const { title, description, location, scheduled_date, start_time, end_time, max_capacity } = req.body;
    if (!title || !scheduled_date || !start_time || !end_time)
      return res.status(400).json({ error: 'title, scheduled_date, start_time, end_time are required' });
    try {
      const r = await pool.query(`
        UPDATE lms_physical_sessions SET
          title=$1, description=$2, location=$3,
          scheduled_date=$4, start_time=$5, end_time=$6,
          max_capacity=$7, updated_at=NOW()
        WHERE id=$8
        RETURNING *
      `, [title, description || null, location || null,
          scheduled_date, start_time, end_time, max_capacity || null, req.params.id]);
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/trainer/sessions/:id/enrollments ─────────────────────────────
  router.get('/sessions/:id/enrollments', ...guard, async (req, res) => {
    if (!(await ownSession(req.params.id, req.user.id)))
      return res.status(403).json({ error: 'Not your session' });
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

  // ── POST /api/trainer/sessions/:id/enroll — add learners ─────────────────
  // body: { user_ids: [uuid, ...] }  OR  { learner_type_id: number }
  router.post('/sessions/:id/enroll', ...guard, async (req, res) => {
    if (!(await ownSession(req.params.id, req.user.id)))
      return res.status(403).json({ error: 'Not your session' });

    const { user_ids, learner_type_id } = req.body;
    try {
      let ids = user_ids || [];

      if (learner_type_id) {
        const lt = await pool.query(
          `SELECT u.id FROM auth_users u
           JOIN lms_learner_profiles lp ON lp.user_id = u.id
           WHERE lp.learner_type_id = $1 AND u.is_active = true`,
          [learner_type_id]
        );
        ids = lt.rows.map(r => r.id);
      }

      if (!ids.length) return res.status(400).json({ error: 'No learners found to enroll' });

      let enrolled = 0;
      for (const uid of ids) {
        await pool.query(`
          INSERT INTO lms_physical_enrollments
            (session_id, user_id, learner_type_id, attendance_status, enrolled_by)
          VALUES ($1,$2,$3,'enrolled',$4)
          ON CONFLICT (session_id, user_id) DO NOTHING
        `, [req.params.id, uid, learner_type_id || null, req.user.id]);
        enrolled++;
      }
      res.json({ enrolled });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/trainer/sessions/:id/enrollments/:userId ─────────────────
  router.delete('/sessions/:id/enrollments/:userId', ...guard, async (req, res) => {
    if (!(await ownSession(req.params.id, req.user.id)))
      return res.status(403).json({ error: 'Not your session' });
    try {
      await pool.query(
        `DELETE FROM lms_physical_enrollments WHERE session_id=$1 AND user_id=$2`,
        [req.params.id, req.params.userId]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/trainer/sessions/:id/attendance ──────────────────────────────
  router.put('/sessions/:id/attendance', ...guard, async (req, res) => {
    if (!(await ownSession(req.params.id, req.user.id)))
      return res.status(403).json({ error: 'Not your session' });

    const { attendances } = req.body;
    if (!Array.isArray(attendances)) return res.status(400).json({ error: 'attendances array required' });
    try {
      for (const a of attendances) {
        await pool.query(`
          UPDATE lms_physical_enrollments
          SET attendance_status=$1, marked_at=NOW(), marked_by=$2
          WHERE session_id=$3 AND user_id=$4
        `, [a.status, req.user.id, req.params.id, a.user_id]);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/trainer/learners — all learners trainer can enroll ───────────
  router.get('/learners', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT u.id, u.email, u.display_name, u.staff_id, lt.name AS learner_type
        FROM auth_users u
        JOIN lms_learner_profiles lp ON lp.user_id = u.id
        JOIN lms_learner_types lt    ON lt.id = lp.learner_type_id
        WHERE u.role = 'learner' AND u.is_active = true
        ORDER BY u.display_name
      `);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/trainer/learner-types ───────────────────────────────────────
  router.get('/learner-types', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT lt.*, COUNT(lp.user_id)::int AS learner_count
        FROM lms_learner_types lt
        LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
        WHERE lt.is_active = true
        GROUP BY lt.id ORDER BY lt.name
      `);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/trainer/profile ─────────────────────────────────────────────
  router.get('/profile', ...guard, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, email, display_name, staff_id FROM auth_users WHERE id = $1`,
        [req.user.id]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}