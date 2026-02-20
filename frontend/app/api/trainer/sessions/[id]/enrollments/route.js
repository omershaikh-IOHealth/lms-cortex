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

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pool = getPool();
  if (!(await ownSession(pool, params.id, user.id)))
    return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  try {
    const r = await pool.query(`
      SELECT pe.*, u.email, u.display_name, u.staff_id, lt.name AS learner_type_name
      FROM lms_physical_enrollments pe
      JOIN auth_users u ON pe.user_id = u.id
      LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
      WHERE pe.session_id = $1 ORDER BY u.display_name
    `, [params.id]);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
