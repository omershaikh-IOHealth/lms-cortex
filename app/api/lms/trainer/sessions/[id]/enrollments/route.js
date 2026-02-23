import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const { authError, user } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    // Verify trainer owns this session (or is admin/training)
    if (user.role === 'trainer') {
      const check = await pool.query('SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2', [params.id, user.id]);
      if (!check.rows.length) return NextResponse.json({ error: 'Not your session' }, { status: 403 });
    }

    const r = await pool.query(`
      SELECT pe.*, u.email, u.display_name, lt.name as learner_type_name,
             ulp.percent_watched, ulp.completed, ulp.last_activity_at
      FROM lms_physical_enrollments pe
      JOIN auth_users u ON pe.user_id = u.id
      LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = pe.user_id
      WHERE pe.session_id = $1
      ORDER BY u.display_name
    `, [params.id]);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
