import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

function guard(request, ...roles) {
  const user = getUser(request);
  if (!user) return [null, NextResponse.json({ error: 'Unauthorized' }, { status: 401 })];
  if (roles.length && !roles.includes(user.role))
    return [null, NextResponse.json({ error: 'Forbidden' }, { status: 403 })];
  return [user, null];
}

export async function GET(request) {
  const [user, err] = guard(request, 'admin', 'training');
  if (err) return err;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT lt.*, u.display_name as created_by_name,
        COUNT(lp.id)::int as learner_count
      FROM lms_learner_types lt
      LEFT JOIN auth_users u ON lt.created_by = u.id
      LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
      GROUP BY lt.id, u.display_name
      ORDER BY lt.name
    `);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const [user, err] = guard(request, 'admin', 'training');
  if (err) return err;
  const { name, description } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO lms_learner_types (name, description, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), description, user.id]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Learner type name already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
