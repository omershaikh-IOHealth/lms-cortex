import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

async function ownSession(pool, sessionId, userId) {
  const r = await pool.query(
    `SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2`,
    [sessionId, userId]
  );
  return r.rows.length > 0;
}

export async function POST(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pool = getPool();
  if (!(await ownSession(pool, params.id, user.id)))
    return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  const { user_ids, learner_type_id } = await request.json();
  try {
    let ids = user_ids || [];
    if (learner_type_id) {
      const lt = await pool.query(`
        SELECT u.id FROM auth_users u
        JOIN lms_learner_profiles lp ON lp.user_id = u.id
        WHERE lp.learner_type_id = $1 AND u.is_active = true
      `, [learner_type_id]);
      ids = lt.rows.map(r => r.id);
    }
    if (!ids.length) return NextResponse.json({ error: 'No learners found to enroll' }, { status: 400 });

    let enrolled = 0;
    for (const uid of ids) {
      await pool.query(`
        INSERT INTO lms_physical_enrollments
          (session_id, user_id, learner_type_id, attendance_status, enrolled_by)
        VALUES ($1,$2,$3,'enrolled',$4) ON CONFLICT (session_id, user_id) DO NOTHING
      `, [params.id, uid, learner_type_id || null, user.id]);
      enrolled++;
    }
    return NextResponse.json({ enrolled });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
