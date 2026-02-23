import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { role, is_active, can_upload_content } = await request.json();
  const pool = getPool();
  try {
    await pool.query(`
      UPDATE auth_users SET
        role               = COALESCE($1, role),
        is_active          = COALESCE($2, is_active),
        can_upload_content = COALESCE($3, can_upload_content),
        updated_at         = NOW()
      WHERE id = $4
    `, [role || null, is_active ?? null, can_upload_content ?? null, params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
