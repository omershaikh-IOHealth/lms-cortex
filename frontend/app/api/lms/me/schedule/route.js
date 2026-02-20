import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        pe.attendance_status, pe.acknowledged_at,
        ps.id AS session_id, ps.title, ps.description,
        ps.scheduled_date, ps.start_time, ps.end_time,
        ps.location, ps.status AS session_status,
        trainer.display_name AS trainer_name, trainer.email AS trainer_email
      FROM lms_physical_enrollments pe
      JOIN lms_physical_sessions ps ON pe.session_id = ps.id
      LEFT JOIN auth_users trainer ON ps.trainer_id = trainer.id
      WHERE pe.user_id = $1 AND ps.status != 'cancelled'
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
    `, [user.id]);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
