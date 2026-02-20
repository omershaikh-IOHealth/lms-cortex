import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const [sessionRes, eventsRes] = await Promise.all([
      pool.query(`
        SELECT s.*, u.display_name, l.title AS lesson_title
        FROM lms_learning_sessions s
        JOIN auth_users u ON s.user_id   = u.id
        JOIN lms_lessons l ON s.lesson_id = l.id
        WHERE s.id = $1
      `, [params.sessionId]),
      pool.query(`
        SELECT event_type, event_payload, client_ts, server_ts
        FROM lms_event_logs WHERE session_id = $1 ORDER BY client_ts ASC
      `, [params.sessionId]),
    ]);
    return NextResponse.json({ session: sessionRes.rows[0], events: eventsRes.rows });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
