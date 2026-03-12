import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/content/courses/[id]/quiz
// Returns the quiz (with questions + options) for a course
export async function GET(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const quiz = await pool.query(
      'SELECT * FROM lms_quizzes WHERE course_id = $1 ORDER BY created_at DESC LIMIT 1',
      [params.id]
    );
    if (!quiz.rows[0]) return NextResponse.json(null);

    const questions = await pool.query(
      'SELECT * FROM lms_quiz_questions WHERE quiz_id = $1 ORDER BY sort_order, id',
      [quiz.rows[0].id]
    );

    const options = questions.rows.length
      ? await pool.query(
          'SELECT * FROM lms_quiz_options WHERE question_id = ANY($1) ORDER BY sort_order, id',
          [questions.rows.map(q => q.id)]
        )
      : { rows: [] };

    const optsByQuestion = {};
    for (const o of options.rows) {
      if (!optsByQuestion[o.question_id]) optsByQuestion[o.question_id] = [];
      optsByQuestion[o.question_id].push(o);
    }

    return NextResponse.json({
      ...quiz.rows[0],
      questions: questions.rows.map(q => ({ ...q, options: optsByQuestion[q.id] || [] })),
    });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

// POST /api/lms/admin/content/courses/[id]/quiz
// Creates or replaces the quiz for a course
export async function POST(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { title, pass_threshold, max_attempts, is_active, is_mandatory, questions } = await request.json();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete existing quiz for this course (cascade deletes questions/options/attempts)
    await client.query('DELETE FROM lms_quizzes WHERE course_id = $1', [params.id]);

    const qr = await client.query(
      `INSERT INTO lms_quizzes (course_id, title, pass_threshold, max_attempts, is_active, is_mandatory, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [params.id, title || 'Course Quiz', pass_threshold ?? 70, max_attempts ?? 3, is_active !== false, is_mandatory === true, user.id]
    );
    const quiz = qr.rows[0];

    for (let qi = 0; qi < (questions || []).length; qi++) {
      const q = questions[qi];
      const qqr = await client.query(
        `INSERT INTO lms_quiz_questions (quiz_id, question_text, question_type, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [quiz.id, q.question_text, q.question_type || 'single', qi]
      );
      const qid = qqr.rows[0].id;
      for (let oi = 0; oi < (q.options || []).length; oi++) {
        const o = q.options[oi];
        await client.query(
          `INSERT INTO lms_quiz_options (question_id, option_text, is_correct, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [qid, o.option_text, !!o.is_correct, oi]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, quiz_id: quiz.id });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}

// DELETE /api/lms/admin/content/courses/[id]/quiz
export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query('DELETE FROM lms_quizzes WHERE course_id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
