import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT id, email, display_name, role, staff_id, departments, specialties, is_active, created_at
      FROM auth_users WHERE role != 'learner' ORDER BY display_name
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, password, display_name, role, staff_id, departments = [], specialties = [] } = await request.json();
  if (!email || !password || !role)
    return NextResponse.json({ error: 'email, password, role required' }, { status: 400 });
  const validRoles = ['admin', 'training', 'trainer', 'support'];
  if (!validRoles.includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  try {
    const pool = getPool();
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name, staff_id, departments, specialties)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, display_name, role, staff_id, is_active
    `, [email.toLowerCase().trim(), hash, role, display_name || null, staff_id || null, departments, specialties]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
