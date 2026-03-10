import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/courses/[id]/quiz
// Returns the active quiz id + user's pass status for a course
export async function GET(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const qr = await pool.query(
      'SELECT id, title, pass_threshold, max_attempts FROM lms_quizzes WHERE course_id = $1 AND is_active = true LIMIT 1',
      [params.id]
    );
    if (!qr.rows[0]) return NextResponse.json(null);
    const quiz = qr.rows[0];

    const attempts = await pool.query(
      'SELECT score, passed FROM lms_quiz_attempts WHERE quiz_id = $1 AND user_id = $2 ORDER BY submitted_at DESC',
      [quiz.id, user.id]
    );

    const passed = attempts.rows.some(a => a.passed);
    const attempt_count = attempts.rows.length;

    return NextResponse.json({ ...quiz, passed, attempt_count });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
