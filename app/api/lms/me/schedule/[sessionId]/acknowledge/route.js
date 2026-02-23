import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query(`
      UPDATE lms_physical_enrollments
      SET acknowledged_at = NOW()
      WHERE session_id = $1 AND user_id = $2 AND acknowledged_at IS NULL
    `, [params.sessionId, user.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    // Only allow un-acknowledge for future sessions
    await pool.query(`
      UPDATE lms_physical_enrollments
      SET acknowledged_at = NULL
      WHERE session_id = $1 AND user_id = $2
        AND (SELECT scheduled_date FROM lms_physical_sessions WHERE id = $1) >= CURRENT_DATE
    `, [params.sessionId, user.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
