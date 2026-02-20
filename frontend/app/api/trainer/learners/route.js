import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.staff_id, lt.name AS learner_type
      FROM auth_users u
      JOIN lms_learner_profiles lp ON lp.user_id = u.id
      JOIN lms_learner_types lt    ON lt.id = lp.learner_type_id
      WHERE u.role = 'learner' AND u.is_active = true
      ORDER BY u.display_name
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
