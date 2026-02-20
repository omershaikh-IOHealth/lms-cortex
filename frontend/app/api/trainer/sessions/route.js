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
    const r = await pool.query(`
      SELECT ps.*,
        COUNT(pe.id)::int                                                    AS enrolled_count,
        COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'present')::int   AS present_count,
        COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int    AS absent_count
      FROM lms_physical_sessions ps
      LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
      WHERE ps.trainer_id = $1
      GROUP BY ps.id
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
    `, [user.id]);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['trainer', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, location, scheduled_date, start_time, end_time, max_capacity } = await request.json();
  if (!title || !scheduled_date || !start_time || !end_time)
    return NextResponse.json({ error: 'title, scheduled_date, start_time, end_time are required' }, { status: 400 });

  try {
    const pool = getPool();
    const r = await pool.query(`
      INSERT INTO lms_physical_sessions
        (title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$4) RETURNING *
    `, [title, description || null, location || null, user.id,
        scheduled_date, start_time, end_time, max_capacity || null]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
