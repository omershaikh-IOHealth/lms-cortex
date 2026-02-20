import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

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

export async function GET(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        ps.*,
        (${STATUS_QUERY}) AS computed_status,
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
    const rows = result.rows.map(r => ({ ...r, status: r.computed_status }));
    return Response.json(rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity } = await request.json();
  if (!title?.trim() || !scheduled_date || !start_time || !end_time)
    return Response.json({ error: 'title, scheduled_date, start_time, end_time are required' }, { status: 400 });
  try {
    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO lms_physical_sessions
        (title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, created_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled') RETURNING *
    `, [title.trim(), description || null, location || null,
        trainer_id || null, scheduled_date, start_time, end_time,
        max_capacity || null, auth.user.id]);
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
