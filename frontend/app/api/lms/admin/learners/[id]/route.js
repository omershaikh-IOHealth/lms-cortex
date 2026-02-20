import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { display_name, is_active, learner_type_id, password } = await request.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let hashClause = '';
    const queryParams = [display_name, is_active, params.id];
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash = $4';
      queryParams.push(hash);
    }
    await client.query(`
      UPDATE auth_users
      SET display_name = COALESCE($1, display_name),
          is_active    = COALESCE($2, is_active),
          updated_at   = NOW()
          ${hashClause}
      WHERE id = $3 AND role = 'learner'
    `, queryParams);
    if (learner_type_id) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2, updated_at = NOW()
      `, [params.id, learner_type_id]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
