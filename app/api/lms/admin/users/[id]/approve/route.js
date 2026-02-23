import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { role, learner_type_id } = await request.json();
  if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 });

  const validRoles = ['admin', 'training', 'trainer', 'learner', 'support'];
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE auth_users SET role = $1, registration_status = 'active', is_active = true, updated_at = NOW()
      WHERE id = $2
    `, [role, params.id]);

    if (role === 'learner' && learner_type_id) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
      `, [params.id, learner_type_id]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
