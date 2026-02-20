import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

async function ownSession(pool, sessionId, userId) {
  const r = await pool.query(
    `SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2`,
    [sessionId, userId]
  );
  return r.rows.length > 0;
}

export async function DELETE(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pool = getPool();
  if (!(await ownSession(pool, params.id, user.id)))
    return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  try {
    await pool.query(
      `DELETE FROM lms_physical_enrollments WHERE session_id=$1 AND user_id=$2`,
      [params.id, params.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
