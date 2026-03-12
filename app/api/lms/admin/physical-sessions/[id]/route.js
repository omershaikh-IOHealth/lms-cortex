import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-apis';

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const body = await request.json();
  const { title, description, location, facility, scheduled_date, start_time, end_time, status } = body;
  const trainer_id   = body.trainer_id   || null;
  const max_capacity = body.max_capacity ? Number(body.max_capacity) : null;
  const session_mode = body.session_mode || null;
  const pool = getPool();
  try {
    const result = await pool.query(`
      UPDATE lms_physical_sessions SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        location       = COALESCE($3, location),
        facility       = COALESCE($4, facility),
        trainer_id     = COALESCE($5, trainer_id),
        scheduled_date = COALESCE($6, scheduled_date),
        start_time     = COALESCE($7, start_time),
        end_time       = COALESCE($8, end_time),
        max_capacity   = COALESCE($9, max_capacity),
        status         = COALESCE($10, status),
        session_mode   = COALESCE($12, session_mode),
        updated_at     = NOW()
      WHERE id = $11 RETURNING *
    `, [title?.trim() || null, description || null, location || null, facility || null,
        trainer_id, scheduled_date || null, start_time || null, end_time || null,
        max_capacity, status || null, params.id, session_mode]);

    if (!result.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = result.rows[0];

    // Sync Google Calendar event if it exists
    if (session.google_calendar_event_id) {
      updateCalendarEvent(session.google_calendar_event_id, session).catch(console.error);
    }

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(
      'SELECT google_calendar_event_id FROM lms_physical_sessions WHERE id = $1',
      [params.id]
    );
    const session = r.rows[0];

    await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [params.id]);

    // Clean up Google Calendar event (best effort, don't block)
    if (session?.google_calendar_event_id) {
      deleteCalendarEvent(session.google_calendar_event_id).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
