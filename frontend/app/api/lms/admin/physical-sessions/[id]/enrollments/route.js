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
    const result = await pool.query(`
      SELECT pe.*, u.email, u.display_name, lt.name AS learner_type_name
      FROM lms_physical_enrollments pe
      JOIN auth_users u ON pe.user_id = u.id
      LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
      WHERE pe.session_id = $1 ORDER BY u.display_name
    `, [params.id]);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
