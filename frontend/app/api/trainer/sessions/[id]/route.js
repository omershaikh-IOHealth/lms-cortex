import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

async function ownSession(pool, sessionId, userId) {
  const r = await pool.query(
    `SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2`,
    [sessionId, userId]
  );
  return r.rows.length > 0;
}

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pool = getPool();
  if (!(await ownSession(pool, params.id, user.id)))
    return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  const { title, description, location, scheduled_date, start_time, end_time, max_capacity } = await request.json();
  if (!title || !scheduled_date || !start_time || !end_time)
    return NextResponse.json({ error: 'title, scheduled_date, start_time, end_time are required' }, { status: 400 });

  try {
    const r = await pool.query(`
      UPDATE lms_physical_sessions SET
        title=$1, description=$2, location=$3,
        scheduled_date=$4, start_time=$5, end_time=$6,
        max_capacity=$7, updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [title, description || null, location || null,
        scheduled_date, start_time, end_time, max_capacity || null, params.id]);
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
