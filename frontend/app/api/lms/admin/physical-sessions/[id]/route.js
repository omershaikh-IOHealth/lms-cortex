import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status } = await request.json();
  try {
    const pool = getPool();
    const result = await pool.query(`
      UPDATE lms_physical_sessions SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        location       = COALESCE($3, location),
        trainer_id     = COALESCE($4, trainer_id),
        scheduled_date = COALESCE($5, scheduled_date),
        start_time     = COALESCE($6, start_time),
        end_time       = COALESCE($7, end_time),
        max_capacity   = COALESCE($8, max_capacity),
        status         = COALESCE($9, status),
        updated_at     = NOW()
      WHERE id = $10 RETURNING *
    `, [title?.trim(), description, location, trainer_id,
        scheduled_date, start_time, end_time, max_capacity, status, params.id]);
    if (!result.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
