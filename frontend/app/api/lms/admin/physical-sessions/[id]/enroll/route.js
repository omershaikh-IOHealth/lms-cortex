import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function POST(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { user_ids = [], learner_type_id } = await request.json();
  const sessionId = params.id;
  const pool = getPool();

  const sessionRes = await pool.query(
    `SELECT title, scheduled_date, start_time, location FROM lms_physical_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!sessionRes.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const s = sessionRes.rows[0];
  const dateStr   = new Date(s.scheduled_date).toDateString();
  const notifBody = `You have been enrolled in "${s.title}" on ${dateStr} at ${s.start_time}${s.location ? `, ${s.location}` : ''}.`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const toEnroll = [];
    if (learner_type_id) {
      const r = await client.query(`
        SELECT u.id FROM auth_users u
        JOIN lms_learner_profiles lp ON lp.user_id = u.id
        WHERE lp.learner_type_id = $1 AND u.is_active = true AND u.role = 'learner'
      `, [learner_type_id]);
      r.rows.forEach(row => toEnroll.push({ userId: row.id, learnerTypeId: learner_type_id }));
    }
    user_ids.forEach(uid => {
      if (!toEnroll.find(e => e.userId === uid))
        toEnroll.push({ userId: uid, learnerTypeId: null });
    });

    let enrolled = 0;
    for (const e of toEnroll) {
      const ins = await client.query(`
        INSERT INTO lms_physical_enrollments (session_id, user_id, enrolled_by, learner_type_id)
        VALUES ($1,$2,$3,$4) ON CONFLICT (session_id, user_id) DO NOTHING RETURNING id
      `, [sessionId, e.userId, user.id, e.learnerTypeId]);
      if (ins.rowCount > 0) {
        await client.query(`
          INSERT INTO lms_notifications (user_id, type, title, body, reference_type, reference_id)
          VALUES ($1,'physical_training_scheduled',$2,$3,'physical_session',$4)
        `, [e.userId, `Training Scheduled: ${s.title}`, notifBody, sessionId]);
        enrolled++;
      }
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, enrolled });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
