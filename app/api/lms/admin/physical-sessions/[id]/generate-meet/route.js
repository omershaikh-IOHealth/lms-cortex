import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { createCalendarEvent } from '@/lib/google-apis';

export async function POST(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query('SELECT * FROM lms_physical_sessions WHERE id = $1', [params.id]);
    const session = r.rows[0];
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const cal = await createCalendarEvent(session);
    if (!cal) {
      return NextResponse.json({ error: 'Could not create Google Calendar event. Check GOOGLE_SERVICE_ACCOUNT_JSON configuration.' }, { status: 400 });
    }

    const updated = await pool.query(`
      UPDATE lms_physical_sessions SET
        google_calendar_event_id = $1,
        google_calendar_link     = $2,
        google_meet_link         = $3,
        updated_at               = NOW()
      WHERE id = $4 RETURNING *
    `, [cal.event_id, cal.calendar_link, cal.meet_link, params.id]);

    return NextResponse.json(updated.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
