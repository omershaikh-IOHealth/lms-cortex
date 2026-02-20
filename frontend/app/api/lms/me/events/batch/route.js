import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { session_id, lesson_id, events } = await request.json();
  if (!Array.isArray(events) || !events.length) return Response.json({ ok: true, count: 0 });
  try {
    const pool = getPool();
    // Insert events one at a time for simplicity/correctness
    for (const e of events) {
      await pool.query(`
        INSERT INTO lms_event_logs (session_id, user_id, lesson_id, event_type, event_payload, client_ts)
        VALUES ($1,$2,$3,$4,$5,NOW())
      `, [session_id, auth.user.id, lesson_id, e.event_type, JSON.stringify(e.payload || {})]);
    }

    // Increment active seconds from video heartbeats
    const heartbeats = events.filter(e => e.event_type === 'video_progress_heartbeat');
    if (heartbeats.length > 0 && session_id) {
      await pool.query(`
        UPDATE lms_learning_sessions
        SET total_active_seconds = total_active_seconds + $1
        WHERE id = $2
      `, [heartbeats.length * 5, session_id]);
    }

    return Response.json({ ok: true, count: events.length });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
