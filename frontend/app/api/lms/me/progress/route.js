import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

const COMPLETION_THRESHOLD = 80;

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT ulp.*, l.title AS lesson_title
      FROM lms_user_lesson_progress ulp
      JOIN lms_lessons l ON ulp.lesson_id = l.id
      WHERE ulp.user_id = $1
    `, [user.id]);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { lesson_id, percent_watched, last_position_seconds, total_watch_seconds_delta } = await request.json();
  if (!lesson_id) return NextResponse.json({ error: 'lesson_id required' }, { status: 400 });

  try {
    const pool = getPool();
    const completed = percent_watched >= COMPLETION_THRESHOLD;
    await pool.query(`
      INSERT INTO lms_user_lesson_progress
        (user_id, lesson_id, percent_watched, last_position_seconds,
         total_watch_seconds, completed, completed_at, watch_count, last_activity_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,NOW())
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        percent_watched       = GREATEST(lms_user_lesson_progress.percent_watched, EXCLUDED.percent_watched),
        last_position_seconds = EXCLUDED.last_position_seconds,
        total_watch_seconds   = lms_user_lesson_progress.total_watch_seconds + COALESCE($5, 0),
        completed             = CASE WHEN EXCLUDED.percent_watched >= ${COMPLETION_THRESHOLD}
                                     THEN true ELSE lms_user_lesson_progress.completed END,
        completed_at          = CASE WHEN EXCLUDED.percent_watched >= ${COMPLETION_THRESHOLD}
                                      AND lms_user_lesson_progress.completed = false
                                     THEN NOW() ELSE lms_user_lesson_progress.completed_at END,
        watch_count           = CASE WHEN EXCLUDED.percent_watched <= 20
                                      AND lms_user_lesson_progress.percent_watched > 80
                                     THEN lms_user_lesson_progress.watch_count + 1
                                     ELSE lms_user_lesson_progress.watch_count END,
        last_activity_at      = NOW()
    `, [user.id, lesson_id, percent_watched, last_position_seconds,
        total_watch_seconds_delta || 0, completed, completed ? new Date() : null]);
    return NextResponse.json({ ok: true, completed });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
