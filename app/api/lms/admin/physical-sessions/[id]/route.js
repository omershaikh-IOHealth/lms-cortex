import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { updateCalendarEvent, deleteCalendarEvent, deleteChatSpace } from '@/lib/google-apis';

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status } = await request.json();
  const pool = getPool();
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
        params.id]);

    if (!result.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = result.rows[0];

    // Sync Google Calendar event if it exists
    if (session.google_calendar_event_id) {
      updateCalendarEvent(user.id, session.google_calendar_event_id, session).catch(console.error);
    }

    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(
      'SELECT google_calendar_event_id, google_chat_space_id FROM lms_physical_sessions WHERE id = $1',
      [params.id]
    );
    const session = r.rows[0];

    await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [params.id]);

    // Clean up Google resources (best effort, don't block)
    if (session?.google_calendar_event_id) {
      deleteCalendarEvent(user.id, session.google_calendar_event_id).catch(console.error);
    }
    if (session?.google_chat_space_id) {
      deleteChatSpace(user.id, session.google_chat_space_id).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
