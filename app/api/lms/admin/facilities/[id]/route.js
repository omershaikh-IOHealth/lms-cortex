import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// PUT /api/lms/admin/facilities/:id
export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { name, location, facility_type, facility_code } = await request.json();
  const pool = getPool();
  try {
    const r = await pool.query(`
      UPDATE lms_facilities SET
        name          = COALESCE($1, name),
        location      = COALESCE($2, location),
        facility_type = COALESCE($3, facility_type),
        facility_code = COALESCE($4, facility_code),
        updated_at    = NOW()
      WHERE id = $5 RETURNING *
    `, [name?.trim() || null, location || null, facility_type || null, facility_code || null, params.id]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/lms/admin/facilities/:id  (soft delete)
export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query(
      'UPDATE lms_facilities SET is_active = false, updated_at = NOW() WHERE id = $1',
      [params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
