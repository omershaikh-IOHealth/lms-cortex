import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PATCH(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { ids } = await request.json().catch(() => ({}));
  try {
    const pool = getPool();
    if (ids?.length) {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::int[])`,
        [user.id, ids]
      );
    } else {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1`,
        [user.id]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
