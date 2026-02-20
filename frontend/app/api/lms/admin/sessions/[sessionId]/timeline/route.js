import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

export async function GET(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorized();
  if (!['admin', 'training'].includes(user.role)) return forbidden();
  const { sessionId } = await params;
  try {
    const pool = getPool();
    const [sessionRes, eventsRes] = await Promise.all([
      pool.query(`
        SELECT s.*, u.display_name, l.title AS lesson_title
        FROM lms_learning_sessions s
        JOIN auth_users u ON s.user_id   = u.id
        JOIN lms_lessons l ON s.lesson_id = l.id
        WHERE s.id = $1
      `, [sessionId]),
      pool.query(`
        SELECT event_type, event_payload, client_ts, server_ts
        FROM lms_event_logs
        WHERE session_id = $1
        ORDER BY client_ts ASC
      `, [sessionId])
    ]);
    return Response.json({ session: sessionRes.rows[0], events: eventsRes.rows });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
