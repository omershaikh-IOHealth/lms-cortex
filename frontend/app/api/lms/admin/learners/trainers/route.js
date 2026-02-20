import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
             COUNT(DISTINCT ps.id)::int AS session_count
      FROM auth_users u
      LEFT JOIN lms_physical_sessions ps ON ps.trainer_id = u.id
      WHERE u.role = 'trainer'
      GROUP BY u.id
      ORDER BY u.display_name
    `);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, password, display_name } = await request.json();
  if (!email || !password)
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });

  try {
    const pool = getPool();
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name)
      VALUES ($1, $2, 'trainer', $3) RETURNING id, email, display_name, role, is_active
    `, [email.toLowerCase().trim(), hash, display_name || null]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
