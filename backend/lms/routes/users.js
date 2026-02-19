import { Router } from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function usersRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin')];

  // GET /api/lms/admin/users
  router.get('/', ...guard, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT id, email, display_name, role, staff_id, departments, specialties, is_active, created_at
        FROM auth_users
        WHERE role != 'learner'
        ORDER BY display_name
      `);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/users
  router.post('/', ...guard, async (req, res) => {
    const { email, password, display_name, role, staff_id, departments = [], specialties = [] } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: 'email, password, role required' });
    const validRoles = ['admin', 'training', 'trainer', 'support'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    try {
      const hash = await bcrypt.hash(password, 12);
      const r = await pool.query(`
        INSERT INTO auth_users (email, password_hash, role, display_name, staff_id, departments, specialties)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, display_name, role, staff_id, is_active
      `, [email.toLowerCase().trim(), hash, role, display_name || null, staff_id || null, departments, specialties]);
      res.status(201).json(r.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/lms/admin/users/:id
  router.put('/:id', ...guard, async (req, res) => {
    const { display_name, role, staff_id, departments, specialties, is_active, password } = req.body;
    try {
      let hashClause = '';
      const params = [display_name, role, staff_id, departments, specialties, is_active, req.params.id];
      if (password) {
        const hash = await bcrypt.hash(password, 12);
        hashClause = ', password_hash = $8';
        params.push(hash);
      }
      await pool.query(`
        UPDATE auth_users SET
          display_name = COALESCE($1, display_name),
          role         = COALESCE($2, role),
          staff_id     = COALESCE($3, staff_id),
          departments  = COALESCE($4, departments),
          specialties  = COALESCE($5, specialties),
          is_active    = COALESCE($6, is_active),
          updated_at   = NOW()
          ${hashClause}
        WHERE id = $7
      `, params);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}