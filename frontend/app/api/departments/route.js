import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pool = getPool();
    const [depts, specs] = await Promise.all([
      pool.query('SELECT * FROM lms_departments WHERE is_active=true ORDER BY name'),
      pool.query('SELECT * FROM lms_specialties WHERE is_active=true ORDER BY name'),
    ]);
    return NextResponse.json({ departments: depts.rows, specialties: specs.rows });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_departments (name, description) VALUES ($1,$2) RETURNING *',
      [name.trim(), description || null]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Department already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
