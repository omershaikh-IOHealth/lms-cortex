import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/quiz/[quizId]
// Returns quiz with questions + options (no is_correct flags) and user's attempt history
export async function GET(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const qr = await pool.query('SELECT * FROM lms_quizzes WHERE id = $1 AND is_active = true', [params.quizId]);
    if (!qr.rows[0]) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    const quiz = qr.rows[0];

    const questions = await pool.query(
      'SELECT id, question_text, question_type, sort_order FROM lms_quiz_questions WHERE quiz_id = $1 ORDER BY sort_order, id',
      [quiz.id]
    );

    const options = questions.rows.length
      ? await pool.query(
          'SELECT id, question_id, option_text, sort_order FROM lms_quiz_options WHERE question_id = ANY($1) ORDER BY sort_order, id',
          [questions.rows.map(q => q.id)]
        )
      : { rows: [] };

    const optsByQuestion = {};
    for (const o of options.rows) {
      if (!optsByQuestion[o.question_id]) optsByQuestion[o.question_id] = [];
      optsByQuestion[o.question_id].push(o);
    }

    // Fetch user's past attempts
    const attempts = await pool.query(
      'SELECT id, score, passed, started_at, submitted_at FROM lms_quiz_attempts WHERE quiz_id = $1 AND user_id = $2 ORDER BY started_at DESC',
      [quiz.id, user.id]
    );

    return NextResponse.json({
      ...quiz,
      questions: questions.rows.map(q => ({ ...q, options: optsByQuestion[q.id] || [] })),
      attempts: attempts.rows,
    });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
