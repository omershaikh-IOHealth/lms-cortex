// backend/lms/routes/calendar.js
// Calendar events management — Google Calendar-style scheduling
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function calendarRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin', 'training', 'trainer')];

  // GET /api/lms/admin/calendar — list events with optional filters
  router.get('/', ...guard, async (req, res) => {
    try {
      const { department, month, year, status } = req.query;
      let whereExtra = '';
      const params = [];
      if (department) {
        params.push(department);
        whereExtra += ` AND ce.department = $${params.length}`;
      }
      if (month && year) {
        params.push(parseInt(year), parseInt(month));
        whereExtra += ` AND EXTRACT(YEAR FROM ce.event_date) = $${params.length - 1} AND EXTRACT(MONTH FROM ce.event_date) = $${params.length}`;
      }
      if (status) {
        params.push(status);
        whereExtra += ` AND ce.status = $${params.length}`;
      }
      const result = await pool.query(`
        SELECT ce.*,
               u.display_name AS created_by_name,
               u.email AS created_by_email,
               COUNT(ca.id)::int AS attendee_count
        FROM lms_calendar_events ce
        LEFT JOIN auth_users u ON ce.created_by = u.id
        LEFT JOIN lms_calendar_attendees ca ON ca.event_id = ce.id
        WHERE 1=1 ${whereExtra}
        GROUP BY ce.id, u.display_name, u.email
        ORDER BY ce.event_date, ce.start_time
      `, params);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/calendar — create event
  router.post('/', ...guard, async (req, res) => {
    const { title, description, event_date, start_time, end_time, location,
            event_type, department, specialty, attendee_user_ids,
            google_calendar_link, is_recurring, recurrence_rule } = req.body;
    if (!title?.trim() || !event_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'title, event_date, start_time, end_time are required' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventRes = await client.query(`
        INSERT INTO lms_calendar_events
          (title, description, event_date, start_time, end_time, location, event_type,
           department, specialty, google_calendar_link, is_recurring, recurrence_rule, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [title.trim(), description || null, event_date, start_time, end_time,
          location || null, event_type || 'training', department || null, specialty || null,
          google_calendar_link || null, is_recurring || false, recurrence_rule || null,
          req.user.id]);

      const event = eventRes.rows[0];

      // Add attendees
      if (attendee_user_ids?.length) {
        for (const uid of attendee_user_ids) {
          await client.query(`
            INSERT INTO lms_calendar_attendees (event_id, user_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
          `, [event.id, uid]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json(event);
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  });

  // PUT /api/lms/admin/calendar/:id — update event
  router.put('/:id', ...guard, async (req, res) => {
    const { title, description, event_date, start_time, end_time, location,
            event_type, department, specialty, status,
            google_calendar_link, is_recurring, recurrence_rule } = req.body;
    try {
      const result = await pool.query(`
        UPDATE lms_calendar_events SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          event_date = COALESCE($3, event_date),
          start_time = COALESCE($4, start_time),
          end_time = COALESCE($5, end_time),
          location = COALESCE($6, location),
          event_type = COALESCE($7, event_type),
          department = COALESCE($8, department),
          specialty = COALESCE($9, specialty),
          status = COALESCE($10, status),
          google_calendar_link = COALESCE($11, google_calendar_link),
          is_recurring = COALESCE($12, is_recurring),
          recurrence_rule = COALESCE($13, recurrence_rule),
          updated_at = NOW()
        WHERE id = $14 RETURNING *
      `, [title?.trim(), description, event_date, start_time, end_time,
          location, event_type, department, specialty, status,
          google_calendar_link, is_recurring, recurrence_rule, req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /api/lms/admin/calendar/:id
  router.delete('/:id', ...guard, async (req, res) => {
    try {
      await pool.query('DELETE FROM lms_calendar_events WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET /api/lms/admin/calendar/:id/attendees
  router.get('/:id/attendees', ...guard, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ca.*, u.email, u.display_name, u.staff_id, u.departments, u.specialties
        FROM lms_calendar_attendees ca
        JOIN auth_users u ON ca.user_id = u.id
        WHERE ca.event_id = $1
        ORDER BY u.display_name
      `, [req.params.id]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/calendar/:id/attendees — add attendees
  router.post('/:id/attendees', ...guard, async (req, res) => {
    const { user_ids } = req.body;
    if (!user_ids?.length) return res.status(400).json({ error: 'user_ids required' });
    try {
      let added = 0;
      for (const uid of user_ids) {
        const r = await pool.query(`
          INSERT INTO lms_calendar_attendees (event_id, user_id)
          VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id
        `, [req.params.id, uid]);
        if (r.rowCount > 0) added++;
      }
      res.json({ ok: true, added });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Learner-facing: my calendar events
  router.get('/my-events', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ce.*, u.display_name AS organizer_name, ca.response_status
        FROM lms_calendar_attendees ca
        JOIN lms_calendar_events ce ON ca.event_id = ce.id
        LEFT JOIN auth_users u ON ce.created_by = u.id
        WHERE ca.user_id = $1 AND ce.status != 'cancelled'
        ORDER BY ce.event_date, ce.start_time
      `, [req.user.id]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
