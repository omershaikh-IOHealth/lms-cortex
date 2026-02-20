import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT id, email, display_name, staff_id FROM auth_users WHERE id = $1`,
      [user.id]
    );
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
