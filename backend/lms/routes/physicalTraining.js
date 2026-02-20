// backend/lms/routes/physicalTraining.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Compute effective status from date/time — never trust stored value except 'cancelled'
const STATUS_QUERY = `
  CASE
    WHEN ps.status = 'cancelled' THEN 'cancelled'
    WHEN ps.scheduled_date > CURRENT_DATE THEN 'scheduled'
    WHEN ps.scheduled_date = CURRENT_DATE
         AND CURRENT_TIME < ps.start_time THEN 'scheduled'
    WHEN ps.scheduled_date = CURRENT_DATE
         AND CURRENT_TIME BETWEEN ps.start_time AND ps.end_time THEN 'ongoing'
    WHEN (ps.scheduled_date < CURRENT_DATE)
         OR (ps.scheduled_date = CURRENT_DATE AND CURRENT_TIME > ps.end_time)
    THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM lms_physical_enrollments pe2
          WHERE pe2.session_id = ps.id
            AND pe2.attendance_status IN ('present','absent')
        ) THEN 'completed'
        ELSE 'scheduled'
      END
    ELSE 'scheduled'
  END
`;

export default function physicalTrainingRoutes(pool) {
  const router = Router();
  const adminGuard = [requireAuth, requireRole('admin', 'training')];

  // ─── SESSIONS ────────────────────────────────────────────────────────────

  // GET /api/lms/admin/physical-sessions
  router.get('/', ...adminGuard, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          ps.*,
          (${STATUS_QUERY})                                                               AS computed_status,
          u.display_name   AS trainer_name,
          u.email          AS trainer_email,
          cb.display_name  AS created_by_name,
          COUNT(DISTINCT pe.id)::int                                                      AS enrolled_count,
          COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'present')::int     AS present_count,
          COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int      AS absent_count,
          COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'enrolled')::int    AS pending_count,
          COUNT(DISTINCT pe.id) FILTER (WHERE pe.acknowledged_at IS NOT NULL)::int       AS acknowledged_count
        FROM lms_physical_sessions ps
        LEFT JOIN auth_users u  ON ps.trainer_id = u.id
        LEFT JOIN auth_users cb ON ps.created_by  = cb.id
        LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
        GROUP BY ps.id, u.display_name, u.email, cb.display_name
        ORDER BY ps.scheduled_date DESC, ps.start_time DESC
      `);
      // Override stored status with computed
      const rows = result.rows.map(r => ({ ...r, status: r.computed_status }));
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/physical-sessions
  router.post('/', ...adminGuard, async (req, res) => {
    const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity } = req.body;
    if (!title?.trim() || !scheduled_date || !start_time || !end_time)
      return res.status(400).json({ error: 'title, scheduled_date, start_time, end_time are required' });
    try {
      const result = await pool.query(`
        INSERT INTO lms_physical_sessions
          (title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, created_by, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled') RETURNING *
      `, [title.trim(), description || null, location || null,
          trainer_id || null, scheduled_date, start_time, end_time,
          max_capacity || null, req.user.id]);
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PUT /api/lms/admin/physical-sessions/:id  (edit/reschedule)
  router.put('/:id', ...adminGuard, async (req, res) => {
    const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status } = req.body;
    try {
      const result = await pool.query(`
        UPDATE lms_physical_sessions SET
          title          = COALESCE($1, title),
          description    = COALESCE($2, description),
          location       = COALESCE($3, location),
          trainer_id     = COALESCE($4, trainer_id),
          scheduled_date = COALESCE($5, scheduled_date),
          start_time     = COALESCE($6, start_time),
          end_time       = COALESCE($7, end_time),
          max_capacity   = COALESCE($8, max_capacity),
          status         = COALESCE($9, status),
          updated_at     = NOW()
        WHERE id = $10 RETURNING *
      `, [title?.trim(), description, location, trainer_id,
          scheduled_date, start_time, end_time, max_capacity, status,
          req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Session not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/lms/admin/physical-sessions/:id  (hard delete)
  router.delete('/:id', ...adminGuard, async (req, res) => {
    try {
      // enrollments cascade-delete via FK
      await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/lms/admin/physical-sessions/:id/cancel  (soft cancel)
  router.patch('/:id/cancel', ...adminGuard, async (req, res) => {
    try {
      await pool.query(
        `UPDATE lms_physical_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /api/lms/admin/physical-sessions/:id/reset
  // Reschedules a past/cancelled session: resets attendance + status to 'scheduled'
  // Optionally pass new date/time in body to reschedule in one call
  router.patch('/:id/reset', ...adminGuard, async (req, res) => {
    const { scheduled_date, start_time, end_time } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Reset all attendance to 'enrolled'
      await client.query(
        `UPDATE lms_physical_enrollments SET attendance_status = 'enrolled', marked_at = NULL, marked_by = NULL WHERE session_id = $1`,
        [req.params.id]
      );
      // Update session with new date if provided, always set status = 'scheduled'
      await client.query(`
        UPDATE lms_physical_sessions SET
          status         = 'scheduled',
          scheduled_date = COALESCE($1, scheduled_date),
          start_time     = COALESCE($2, start_time),
          end_time       = COALESCE($3, end_time),
          updated_at     = NOW()
        WHERE id = $4
      `, [scheduled_date || null, start_time || null, end_time || null, req.params.id]);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  });

  // ─── ENROLLMENTS ─────────────────────────────────────────────────────────

  // GET /api/lms/admin/physical-sessions/:id/enrollments
  router.get('/:id/enrollments', ...adminGuard, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          pe.*,
          u.email, u.display_name,
          lt.name AS learner_type_name
        FROM lms_physical_enrollments pe
        JOIN auth_users u ON pe.user_id = u.id
        LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
        WHERE pe.session_id = $1
        ORDER BY u.display_name
      `, [req.params.id]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/physical-sessions/:id/enroll
  router.post('/:id/enroll', ...adminGuard, async (req, res) => {
    const { user_ids = [], learner_type_id } = req.body;
    const sessionId = req.params.id;

    const sessionRes = await pool.query(
      `SELECT title, scheduled_date, start_time, location FROM lms_physical_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!sessionRes.rows[0]) return res.status(404).json({ error: 'Session not found' });
    const s = sessionRes.rows[0];
    const dateStr   = new Date(s.scheduled_date).toDateString();
    const notifBody = `You have been enrolled in "${s.title}" on ${dateStr} at ${s.start_time}${s.location ? `, ${s.location}` : ''}.`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const toEnroll = [];
      if (learner_type_id) {
        const r = await client.query(`
          SELECT u.id FROM auth_users u
          JOIN lms_learner_profiles lp ON lp.user_id = u.id
          WHERE lp.learner_type_id = $1 AND u.is_active = true AND u.role = 'learner'
        `, [learner_type_id]);
        r.rows.forEach(row => toEnroll.push({ userId: row.id, learnerTypeId: learner_type_id }));
      }
      user_ids.forEach(uid => {
        if (!toEnroll.find(e => e.userId === uid))
          toEnroll.push({ userId: uid, learnerTypeId: null });
      });

      let enrolled = 0;
      for (const e of toEnroll) {
        const ins = await client.query(`
          INSERT INTO lms_physical_enrollments (session_id, user_id, enrolled_by, learner_type_id)
          VALUES ($1,$2,$3,$4) ON CONFLICT (session_id, user_id) DO NOTHING RETURNING id
        `, [sessionId, e.userId, req.user.id, e.learnerTypeId]);
        if (ins.rowCount > 0) {
          await client.query(`
            INSERT INTO lms_notifications (user_id, type, title, body, reference_type, reference_id)
            VALUES ($1,'physical_training_scheduled',$2,$3,'physical_session',$4)
          `, [e.userId, `Training Scheduled: ${s.title}`, notifBody, sessionId]);
          enrolled++;
        }
      }
      await client.query('COMMIT');
      res.json({ ok: true, enrolled });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  });

  // DELETE /api/lms/admin/physical-sessions/:id/enrollments/:userId
  router.delete('/:id/enrollments/:userId', ...adminGuard, async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM lms_physical_enrollments WHERE session_id = $1 AND user_id = $2`,
        [req.params.id, req.params.userId]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── ATTENDANCE ───────────────────────────────────────────────────────────

  // PUT /api/lms/admin/physical-sessions/:id/attendance
  router.put('/:id/attendance', ...adminGuard, async (req, res) => {
    const { attendances } = req.body;
    if (!Array.isArray(attendances) || !attendances.length)
      return res.status(400).json({ error: 'attendances array required' });
    try {
      for (const a of attendances) {
        await pool.query(`
          UPDATE lms_physical_enrollments
          SET attendance_status = $1, marked_at = NOW(), marked_by = $2
          WHERE session_id = $3 AND user_id = $4
        `, [a.status, req.user.id, req.params.id, a.user_id]);
      }
      // Only auto-complete if session is past AND all enrolled users have been marked
      await pool.query(`
        UPDATE lms_physical_sessions
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
          AND status NOT IN ('cancelled','completed')
          AND (scheduled_date < CURRENT_DATE
               OR (scheduled_date = CURRENT_DATE AND end_time < CURRENT_TIME))
          AND (SELECT COUNT(*) FROM lms_physical_enrollments WHERE session_id = $1) > 0
          AND NOT EXISTS (
            SELECT 1 FROM lms_physical_enrollments
            WHERE session_id = $1 AND attendance_status = 'enrolled'
          )
      `, [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET trainers dropdown
  router.get('/meta/trainers', ...adminGuard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT id, email, display_name FROM auth_users
        WHERE role IN ('admin','training','trainer') AND is_active = true
        ORDER BY display_name
      `);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}