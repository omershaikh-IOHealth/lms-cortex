import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function PUT(request, { params }) {
  const { error } = await guard(request);
  if (error) return error;
  const { id } = await params;
  const { display_name, is_active, learner_type_id, password } = await request.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let hashClause = '';
    const p = [display_name, is_active, id];
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash = $4';
      p.push(hash);
    }
    await client.query(`
      UPDATE auth_users
      SET display_name = COALESCE($1, display_name),
          is_active = COALESCE($2, is_active),
          updated_at = NOW()
          ${hashClause}
      WHERE id = $3 AND role = 'learner'
    `, p);
    if (learner_type_id) {
      await client.query(
        'UPDATE lms_learner_profiles SET learner_type_id = $1, updated_at = NOW() WHERE user_id = $2',
        [learner_type_id, id]
      );
    }
    await client.query('COMMIT');
    return Response.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
