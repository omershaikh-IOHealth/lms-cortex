import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PATCH(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { total_active_seconds, total_idle_seconds } = await request.json();
  try {
    const pool = getPool();
    await pool.query(`
      UPDATE lms_learning_sessions
      SET session_ended_at     = NOW(),
          total_active_seconds = COALESCE($1, total_active_seconds),
          total_idle_seconds   = COALESCE($2, total_idle_seconds)
      WHERE id = $3 AND user_id = $4
    `, [total_active_seconds, total_idle_seconds, params.id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
