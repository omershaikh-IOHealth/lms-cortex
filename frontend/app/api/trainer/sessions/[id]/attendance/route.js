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

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pool = getPool();
  if (!(await ownSession(pool, params.id, user.id)))
    return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  const { attendances } = await request.json();
  if (!Array.isArray(attendances)) return NextResponse.json({ error: 'attendances array required' }, { status: 400 });

  try {
    for (const a of attendances) {
      await pool.query(`
        UPDATE lms_physical_enrollments
        SET attendance_status=$1, marked_at=NOW(), marked_by=$2
        WHERE session_id=$3 AND user_id=$4
      `, [a.status, user.id, params.id, a.user_id]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
