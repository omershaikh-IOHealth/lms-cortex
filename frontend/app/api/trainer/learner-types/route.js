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
      SELECT lt.*, COUNT(lp.user_id)::int AS learner_count
      FROM lms_learner_types lt
      LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
      WHERE lt.is_active = true
      GROUP BY lt.id ORDER BY lt.name
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
