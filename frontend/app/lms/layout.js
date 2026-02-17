// frontend/app/lms/layout.js
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const ADMIN_NAV = [
  { href: '/lms/admin',              label: 'Overview',         icon: '📊' },
  { href: '/lms/admin/learner-types',label: 'Learner Types',    icon: '🏷️' },
  { href: '/lms/admin/learners',     label: 'Learners',         icon: '👥' },
  { href: '/lms/admin/content',      label: 'Content',          icon: '📚' },
  { href: '/lms/admin/assignments',  label: 'Assignments',      icon: '🔗' },
  { href: '/lms/admin/analytics',    label: 'Analytics',        icon: '📈' },
];

const LEARNER_NAV = [
  { href: '/lms/learn',              label: 'My Learning',      icon: '🎓' },
  { href: '/lms/learn/progress',     label: 'My Progress',      icon: '✅' },
];

export default function LMSLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user?.role === 'support') router.push('/dashboard');
  }, [user, loading, router]);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
      Loading...
    </div>
  );

  const isAdmin = user.role === 'admin' || user.role === 'training';
  const nav = isAdmin ? ADMIN_NAV : LEARNER_NAV;

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="text-white font-bold text-sm">Cortex LMS</div>
          <div className="text-gray-500 text-xs mt-0.5">{user.role.toUpperCase()}</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {/* Support module link for admin */}
          {user.role === 'admin' && (
            <Link href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition mb-2">
              ← Support Module
            </Link>
          )}
          {nav.map(item => {
            const active = pathname === item.href || (item.href !== '/lms/admin' && item.href !== '/lms/learn' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="text-xs text-gray-500 px-2 mb-2 truncate">{user.email}</div>
          <button onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
