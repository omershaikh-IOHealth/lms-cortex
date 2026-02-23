import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

async function checkAccess(pool, userId, role, sessionId) {
  if (role === 'admin' || role === 'training') return true;
  if (role === 'trainer') {
    const r = await pool.query('SELECT id FROM lms_physical_sessions WHERE id = $1 AND trainer_id = $2', [sessionId, userId]);
    return r.rows.length > 0;
  }
  // learner: must be enrolled
  const r = await pool.query('SELECT id FROM lms_physical_enrollments WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
  return r.rows.length > 0;
}

export async function GET(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  const hasAccess = await checkAccess(pool, user.id, user.role, params.id);
  if (!hasAccess) return NextResponse.json({ error: 'Not enrolled in this session' }, { status: 403 });

  try {
    const r = await pool.query(`
      SELECT m.id, m.user_id, m.message, m.created_at, u.display_name, u.email
      FROM lms_session_messages m
      JOIN auth_users u ON m.user_id = u.id
      WHERE m.session_id = $1
      ORDER BY m.created_at ASC
      LIMIT 100
    `, [params.id]);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  const hasAccess = await checkAccess(pool, user.id, user.role, params.id);
  if (!hasAccess) return NextResponse.json({ error: 'Not enrolled in this session' }, { status: 403 });

  const { message } = await request.json();
  if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 });

  try {
    const r = await pool.query(`
      INSERT INTO lms_session_messages (session_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, session_id, user_id, message, created_at
    `, [params.id, user.id, message.trim()]);
    return NextResponse.json({ ...r.rows[0], display_name: user.display_name, email: user.email }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
