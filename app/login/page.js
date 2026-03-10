// frontend/app/login/page.js
'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const GOOGLE_ERROR_MESSAGES = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_token:     'Could not complete Google sign-in. Please try again.',
  google_no_email:  'Your Google account did not provide an email address.',
  google_rejected:  'Your account request was not approved.',
  google_error:     'An error occurred during Google sign-in. Please try again.',
};

// Separated into its own component so useSearchParams is inside Suspense
function LoginForm() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const googleParam = searchParams.get('google');
  const errorParam  = searchParams.get('error');

  useEffect(() => {
    if (!loading && user) {
      redirectByRole(user.role, router);
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(identifier, password);
      redirectByRole(u.role, router);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cortex-bg">
      <div className="text-cortex-muted">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-cortex-bg">
      <div className="w-full max-w-md">
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-cortex-text">Cortex 2.0</h1>
            <p className="text-cortex-muted text-sm mt-1">Sign in to continue</p>
          </div>

          {/* Google OAuth status messages */}
          {googleParam === 'pending' && (
            <div className="mb-4 bg-blue-900/30 border border-blue-700 text-blue-300 rounded-lg px-4 py-3 text-sm">
              <div className="font-medium mb-0.5">Registration request submitted</div>
              Your Google account has been registered and is pending admin approval. You&apos;ll be able to sign in once approved.
            </div>
          )}
          {errorParam && GOOGLE_ERROR_MESSAGES[errorParam] && (
            <div className="mb-4 bg-cortex-danger/10 border border-cortex-danger text-cortex-danger rounded-lg px-4 py-2.5 text-sm">
              {GOOGLE_ERROR_MESSAGES[errorParam]}
            </div>
          )}

          {/* Google Sign-In */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg py-2.5 transition mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Sign in with Google
          </a>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-cortex-border" />
            <span className="text-cortex-muted text-xs">or</span>
            <div className="flex-1 h-px bg-cortex-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-cortex-muted mb-1">Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-4 py-2.5 text-cortex-text placeholder-cortex-muted focus:outline-none focus:border-cortex-accent transition"
                placeholder="ann or ann@support.com"
              />
            </div>

            <div>
              <label className="block text-sm text-cortex-muted mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-4 py-2.5 text-cortex-text placeholder-cortex-muted focus:outline-none focus:border-cortex-accent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-cortex-danger/10 border border-cortex-danger text-cortex-danger rounded-lg px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cortex-accent hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-cortex-muted text-xs mt-6">
            Don&apos;t have an account?{' '}
            <a href="/register" className="text-cortex-accent hover:opacity-80 transition">Request access</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cortex-bg">
        <div className="text-cortex-muted">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function redirectByRole(role, router) {
  switch (role) {
    case 'admin':
    case 'training': router.push('/lms/admin'); break;
    case 'learner':  router.push('/lms/learn'); break;
    case 'support':  router.push('/lms/admin'); break;
    case 'trainer':  router.push('/lms/trainer'); break;
    default:         router.push('/lms/admin');
  }
}
