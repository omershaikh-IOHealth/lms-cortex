import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { title, body, target_roles, target_org_id, is_active } = await request.json();
  const pool = getPool();
  try {
    const r = await pool.query(`
      UPDATE lms_announcements SET
        title         = COALESCE($1, title),
        body          = $2,
        target_roles  = $3,
        target_org_id = $4,
        is_active     = COALESCE($5, is_active),
        updated_at    = NOW()
      WHERE id = $6 RETURNING *
    `, [
      title?.trim() || null,
      body ?? null,
      target_roles?.length ? target_roles : null,
      target_org_id || null,
      is_active,
      params.id,
    ]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query('DELETE FROM lms_announcements WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
