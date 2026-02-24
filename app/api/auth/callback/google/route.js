import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/server-auth';

const ROLE_DESTINATIONS = {
  admin:    '/lms/admin',
  training: '/lms/admin',
  learner:  '/lms/learn',
  trainer:  '/lms/trainer',
  support:  '/dashboard',
};

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback/google`;
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  const state = searchParams.get('state') || '';

  if (error || !code) {
    // If this was a connect flow, redirect back to the page they came from
    if (state.startsWith('connect:')) {
      return NextResponse.redirect(`${origin}/lms/admin/physical-training?google_error=cancelled`);
    }
    return NextResponse.redirect(`${origin}/login?error=google_cancelled`);
  }

  // ── Connect flow: just store tokens for existing logged-in user ──────────
  if (state.startsWith('connect:')) {
    const userId = state.replace('connect:', '');
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          code,
          client_id:     process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (tokenRes.ok && tokens.access_token) {
        const expiry = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
        const pool = getPool();
        await pool.query(`
          INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO UPDATE SET
            access_token  = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
            expiry        = EXCLUDED.expiry,
            updated_at    = NOW()
        `, [userId, tokens.access_token, tokens.refresh_token || null, expiry]);
      }
    } catch (err) {
      console.error('Google connect token error:', err);
    }
    return NextResponse.redirect(`${origin}/lms/admin/physical-training?google_connected=1`);
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', tokens);
      return NextResponse.redirect(`${origin}/login?error=google_token`);
    }

    // 2. Fetch Google user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json();
    const email = googleUser.email?.toLowerCase();
    const name  = googleUser.name || googleUser.email;

    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=google_no_email`);
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM auth_users WHERE lower(email) = $1',
      [email]
    );
    const existing = result.rows[0];

    // 3a. Existing user — check status
    if (existing) {
      if (existing.registration_status === 'pending') {
        return NextResponse.redirect(`${origin}/login?google=pending`);
      }
      if (existing.registration_status === 'rejected' || !existing.is_active) {
        return NextResponse.redirect(`${origin}/login?error=google_rejected`);
      }

      // Store Google tokens for Calendar/Chat API use
      if (tokens.access_token) {
        const expiry = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
        await pool.query(`
          INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
            expiry = EXCLUDED.expiry,
            updated_at = NOW()
        `, [existing.id, tokens.access_token, tokens.refresh_token || null, expiry]);
      }

      // Active — issue JWT and redirect
      const token = await signToken({
        id:   existing.id,
        email: existing.email,
        role:  existing.role,
        name:  existing.display_name,
      });
      const destination = ROLE_DESTINATIONS[existing.role] || '/dashboard';
      const response = NextResponse.redirect(`${origin}${destination}`);
      setAuthCookie(response, token);
      return response;
    }

    // 3b. New user — create as pending, notify admins
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generate a random unusable password so the NOT NULL constraint is satisfied.
      // Google users cannot log in with a password since the plaintext is discarded.
      const randomHash = await bcrypt.hash(crypto.randomUUID(), 10);

      await client.query(`
        INSERT INTO auth_users (email, password_hash, role, display_name, registration_status, is_active)
        VALUES ($1, $2, 'learner', $3, 'pending', false)
      `, [email, randomHash, name]);

      const admins = await client.query(
        `SELECT id FROM auth_users WHERE role = 'admin' AND is_active = true`
      );
      for (const admin of admins.rows) {
        await client.query(`
          INSERT INTO lms_notifications (user_id, title, body, type)
          VALUES ($1, 'New user registration request', $2, 'new_user_request')
        `, [admin.id, `${name} (${email}) has requested access via Google Sign-In.`]);
      }

      await client.query('COMMIT');
      return NextResponse.redirect(`${origin}/login?google=pending`);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        // Race condition — email was just registered; redirect to pending
        return NextResponse.redirect(`${origin}/login?google=pending`);
      }
      console.error('Google register error:', err);
      return NextResponse.redirect(`${origin}/login?error=google_error`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/login?error=google_error`);
  }
}
