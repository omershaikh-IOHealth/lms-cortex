import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { display_name, is_active, password } = await request.json();
  try {
    const pool = getPool();
    let hashClause = '';
    const queryParams = [display_name, is_active, params.id];
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash = $4';
      queryParams.push(hash);
    }
    await pool.query(`
      UPDATE auth_users
      SET display_name = COALESCE($1, display_name),
          is_active    = COALESCE($2, is_active),
          updated_at   = NOW()
          ${hashClause}
      WHERE id = $3 AND role = 'trainer'
    `, queryParams);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
