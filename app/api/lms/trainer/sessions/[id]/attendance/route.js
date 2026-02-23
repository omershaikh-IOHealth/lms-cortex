import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  if (user.role === 'trainer') {
    const check = await pool.query('SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2', [params.id, user.id]);
    if (!check.rows.length) return NextResponse.json({ error: 'Not your session' }, { status: 403 });
  }

  const { attendances } = await request.json();
  if (!Array.isArray(attendances)) return NextResponse.json({ error: 'attendances array required' }, { status: 400 });

  try {
    for (const { user_id, status } of attendances) {
      await pool.query(`
        UPDATE lms_physical_enrollments
        SET attendance_status = $1, marked_at = NOW(), marked_by = $2
        WHERE session_id = $3 AND user_id = $4
      `, [status, user.id, params.id, user_id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
