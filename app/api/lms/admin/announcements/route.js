import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(`
      SELECT a.*, u.display_name AS created_by_name
      FROM lms_announcements a
      LEFT JOIN auth_users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { title, body, target_roles, target_org_id, is_active } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const pool = getPool();
  try {
    const r = await pool.query(`
      INSERT INTO lms_announcements (title, body, created_by, target_roles, target_org_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [
      title.trim(),
      body || null,
      user.id,
      target_roles?.length ? target_roles : null,
      target_org_id || null,
      is_active !== false,
    ]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
