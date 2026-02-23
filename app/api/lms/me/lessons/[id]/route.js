import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
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

    if (!accessCheck.rows[0] && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied to this lesson' }, { status: 403 });
    }

    const lesson = accessCheck.rows[0];
    const progressRes = await pool.query(
      'SELECT * FROM lms_user_lesson_progress WHERE user_id=$1 AND lesson_id=$2',
      [user.id, params.id]
    );

    // Set first_viewed_at on first visit (clears NEW badge)
    if (progressRes.rows[0]) {
      if (!progressRes.rows[0].first_viewed_at) {
        await pool.query(
          'UPDATE lms_user_lesson_progress SET first_viewed_at = NOW() WHERE user_id=$1 AND lesson_id=$2',
          [user.id, params.id]
        );
      }
    } else {
      // Create a progress row with first_viewed_at set
      await pool.query(
        'INSERT INTO lms_user_lesson_progress (user_id, lesson_id, first_viewed_at) VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING',
        [user.id, params.id]
      );
    }

    return NextResponse.json({ lesson, progress: progressRes.rows[0] || null });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
