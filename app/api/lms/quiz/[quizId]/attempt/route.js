import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// POST /api/lms/quiz/[quizId]/attempt
// Body: { answers: { [questionId]: optionId } }
// Returns: { score, passed, attempt_id, correct_options (for review) }
export async function POST(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin');
  if (authError) return authError;

  const { answers } = await request.json();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const qr = await client.query('SELECT * FROM lms_quizzes WHERE id = $1 AND is_active = true', [params.quizId]);
    if (!qr.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Quiz not found' }, { status: 404 }); }
    const quiz = qr.rows[0];

    // Check attempt count
    const attemptCount = await client.query(
      'SELECT COUNT(*) FROM lms_quiz_attempts WHERE quiz_id = $1 AND user_id = $2',
      [quiz.id, user.id]
    );
    if (parseInt(attemptCount.rows[0].count) >= quiz.max_attempts) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Max attempts reached' }, { status: 400 });
    }

    // Fetch all correct options for this quiz
    const correctOpts = await client.query(`
      SELECT qo.id AS option_id, qo.question_id, qo.is_correct
      FROM lms_quiz_options qo
      JOIN lms_quiz_questions qq ON qq.id = qo.question_id
      WHERE qq.quiz_id = $1
    `, [quiz.id]);

    const correctMap = {}; // question_id -> Set of correct option ids
    for (const o of correctOpts.rows) {
      if (!correctMap[o.question_id]) correctMap[o.question_id] = { correct: new Set(), all: [] };
      if (o.is_correct) correctMap[o.question_id].correct.add(String(o.option_id));
      correctMap[o.question_id].all.push(o.option_id);
    }

    const questionIds = Object.keys(correctMap);
    let correctCount = 0;
    for (const qid of questionIds) {
      const selected = answers?.[qid];
      if (!selected) continue;
      const selectedSet = new Set(Array.isArray(selected) ? selected.map(String) : [String(selected)]);
      const correctSet = correctMap[qid].correct;
      // Correct if selected exactly matches correct options
      if (selectedSet.size === correctSet.size && [...selectedSet].every(v => correctSet.has(v))) {
        correctCount++;
      }
    }

    const score = questionIds.length > 0 ? Math.round((correctCount / questionIds.length) * 100) : 0;
    const passed = score >= quiz.pass_threshold;

    const ar = await client.query(
      `INSERT INTO lms_quiz_attempts (quiz_id, user_id, score, passed, started_at, submitted_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
      [quiz.id, user.id, score, passed]
    );
    const attemptId = ar.rows[0].id;

    // Store individual answers
    for (const [qid, selected] of Object.entries(answers || {})) {
      const options = Array.isArray(selected) ? selected : [selected];
      for (const optId of options) {
        await client.query(
          'INSERT INTO lms_quiz_answers (attempt_id, question_id, selected_option_id) VALUES ($1,$2,$3)',
          [attemptId, qid, optId]
        );
      }
    }

    await client.query('COMMIT');

    // Return correct options for review
    const correctOptionsForReview = {};
    for (const [qid, data] of Object.entries(correctMap)) {
      correctOptionsForReview[qid] = [...data.correct];
    }

    return NextResponse.json({ score, passed, attempt_id: attemptId, correct_options: correctOptionsForReview });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
