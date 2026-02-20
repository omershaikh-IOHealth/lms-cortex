import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function DELETE(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    await pool.query(
      `DELETE FROM lms_physical_enrollments WHERE session_id = $1 AND user_id = $2`,
      [params.id, params.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
