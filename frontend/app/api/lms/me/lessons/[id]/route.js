import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const profileRes = await pool.query(
      'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
      [user.id]
    );
    const learnerTypeId = profileRes.rows[0]?.learner_type_id;

    const accessCheck = await pool.query(`
      SELECT l.* FROM lms_lessons l
      JOIN lms_lesson_assignments la ON la.lesson_id = l.id
      WHERE l.id = $1 AND la.learner_type_id = $2 AND l.is_active = true
    `, [params.id, learnerTypeId]);

    if (!accessCheck.rows[0] && user.role !== 'admin')
      return NextResponse.json({ error: 'Access denied to this lesson' }, { status: 403 });

    const lesson = accessCheck.rows[0];
    const progressRes = await pool.query(
      'SELECT * FROM lms_user_lesson_progress WHERE user_id=$1 AND lesson_id=$2',
      [user.id, params.id]
    );
    return NextResponse.json({ lesson, progress: progressRes.rows[0] || null });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
