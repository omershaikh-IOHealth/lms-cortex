import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(`
      SELECT id, email, display_name, role, staff_id, departments, specialties,
             is_active, can_upload_content, registration_status, created_at
      FROM auth_users
      ORDER BY created_at DESC
    `);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { email, password, display_name, role, staff_id, departments = [], specialties = [] } = await request.json();
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, role required' }, { status: 400 });
  }
  const validRoles = ['admin', 'training', 'trainer', 'support', 'learner'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const pool = getPool();
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name, staff_id, departments, specialties, registration_status, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'active',true) RETURNING id, email, display_name, role, staff_id, is_active, registration_status
    `, [email.toLowerCase().trim(), hash, role, display_name || null, staff_id || null, departments, specialties]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
