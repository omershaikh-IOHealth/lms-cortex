import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, role, display_name, is_active FROM auth_users WHERE id = $1',
      [user.id]
    );
    if (!result.rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
