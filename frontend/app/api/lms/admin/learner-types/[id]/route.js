import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description, is_active } = await request.json();
  try {
    const pool = getPool();
    const result = await pool.query(`
      UPDATE lms_learner_types
      SET name        = COALESCE($1, name),
          description = COALESCE($2, description),
          is_active   = COALESCE($3, is_active),
          updated_at  = NOW()
      WHERE id = $4 RETURNING *
    `, [name?.trim(), description, is_active, params.id]);
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
