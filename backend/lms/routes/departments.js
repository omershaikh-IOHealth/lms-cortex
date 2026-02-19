import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function departmentsRoutes(pool) {
  const router = Router();
  const guard = [requireAuth, requireRole('admin', 'training')];

  // GET /api/departments — list all departments + specialties
  router.get('/', requireAuth, async (req, res) => {
    try {
      const [depts, specs] = await Promise.all([
        pool.query('SELECT * FROM lms_departments WHERE is_active=true ORDER BY name'),
        pool.query('SELECT * FROM lms_specialties WHERE is_active=true ORDER BY name'),
      ]);
      res.json({ departments: depts.rows, specialties: specs.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/departments
  router.post('/', ...guard, async (req, res) => {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    try {
      const r = await pool.query(
        'INSERT INTO lms_departments (name, description) VALUES ($1,$2) RETURNING *',
        [name.trim(), description || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Department already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/departments/:id
  router.delete('/:id', ...guard, async (req, res) => {
    try {
      await pool.query('UPDATE lms_departments SET is_active=false WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/departments/specialties
  router.post('/specialties', ...guard, async (req, res) => {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    try {
      const r = await pool.query(
        'INSERT INTO lms_specialties (name, description) VALUES ($1,$2) RETURNING *',
        [name.trim(), description || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Specialty already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/departments/specialties/:id
  router.delete('/specialties/:id', ...guard, async (req, res) => {
    try {
      await pool.query('UPDATE lms_specialties SET is_active=false WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}