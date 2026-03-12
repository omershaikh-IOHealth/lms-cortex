import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { createCalendarEvent } from '@/lib/google-apis';

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
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
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
    const rows = result.rows.map(r => ({ ...r, status: r.computed_status }));
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const body = await request.json();
  const { title, description, location, facility, scheduled_date, start_time, end_time } = body;
  const trainer_id   = body.trainer_id   || null;
  const max_capacity = body.max_capacity ? Number(body.max_capacity) : null;
  const session_mode = body.session_mode || 'in_person';
  if (!title?.trim() || !scheduled_date || !start_time || !end_time) {
    return NextResponse.json({ error: 'title, scheduled_date, start_time, end_time are required' }, { status: 400 });
  }
  if (end_time <= start_time) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Insert session first to get the ID
    const result = await pool.query(`
      INSERT INTO lms_physical_sessions
        (title, description, location, facility, trainer_id, scheduled_date, start_time, end_time, max_capacity, created_by, status, session_mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled',$11) RETURNING *
    `, [title.trim(), description || null, location || null, facility || null,
        trainer_id, scheduled_date, start_time, end_time,
        max_capacity, user.id, session_mode]);

    const session = result.rows[0];

    // Create Google Calendar event (best effort, don't block on failure)
    const cal = await createCalendarEvent(session).catch(() => null);

    // Update session with Google links if available
    if (cal) {
      const updated = await pool.query(`
        UPDATE lms_physical_sessions SET
          google_calendar_event_id = COALESCE($1, google_calendar_event_id),
          google_calendar_link     = COALESCE($2, google_calendar_link),
          google_meet_link         = COALESCE($3, google_meet_link)
        WHERE id = $4 RETURNING *
      `, [
        cal.event_id      || null,
        cal.calendar_link || null,
        cal.meet_link     || null,
        session.id,
      ]);
      return NextResponse.json(updated.rows[0], { status: 201 });
    }

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
