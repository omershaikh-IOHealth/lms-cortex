import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { lesson_id } = await request.json();
  if (!lesson_id) return NextResponse.json({ error: 'lesson_id required' }, { status: 400 });
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO lms_learning_sessions (user_id, lesson_id) VALUES ($1,$2) RETURNING id`,
      [user.id, lesson_id]
    );
    return NextResponse.json({ session_id: result.rows[0].id }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
