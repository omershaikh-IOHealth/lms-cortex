import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { session_id, lesson_id, events } = await request.json();
  if (!Array.isArray(events) || !events.length) return NextResponse.json({ ok: true, count: 0 });

  try {
    const pool = getPool();
    // Build parameterized values — no string manipulation on SQL
    const valuePlaceholders = events.map((_, i) => {
      const b = i * 5;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},NOW())`;
    }).join(',');
    const queryParams = events.flatMap(e => [
      session_id, user.id, lesson_id,
      e.event_type, JSON.stringify(e.payload || {})
    ]);
    await pool.query(`
      INSERT INTO lms_event_logs (session_id, user_id, lesson_id, event_type, event_payload, client_ts)
      VALUES ${valuePlaceholders}
    `, queryParams);

    const heartbeats = events.filter(e => e.event_type === 'video_progress_heartbeat');
    if (heartbeats.length > 0 && session_id) {
      await pool.query(`
        UPDATE lms_learning_sessions
        SET total_active_seconds = total_active_seconds + $1
        WHERE id = $2
      `, [heartbeats.length * 5, session_id]);
    }

    return NextResponse.json({ ok: true, count: events.length });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
