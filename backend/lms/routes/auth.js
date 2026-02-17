// backend/lms/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { signToken, requireAuth } from '../middleware/auth.js';

export default function authRoutes(pool) {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Username/email and password required' });
    try {
      const identifier = email.toLowerCase().trim();
      const result = await pool.query(`SELECT *
           FROM auth_users
          WHERE is_active = true
            AND (lower(email) = $1 OR split_part(lower(email), '@', 1) = $1)`,
        [identifier]
      );
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.display_name });

      // httpOnly cookie + also return in body for localStorage fallback
      res.cookie('lms_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000 // 8h
      });

      res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.display_name } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    res.clearCookie('lms_token');
    res.json({ ok: true });
  });

  // GET /api/auth/me
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, email, role, display_name, is_active FROM auth_users WHERE id = $1',
        [req.user.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
