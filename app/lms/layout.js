// frontend/app/lms/layout.js
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, apiFetch } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import NotificationBell from "@/components/NotificationBell";
import AICompanion from "@/components/AICompanion";

const ADMIN_NAV = [
  { href: "/lms/admin",                   label: "Overview",          icon: "grid" },
  { href: "/lms/admin/companies",         label: "Organisations",     icon: "building" },
  { href: "/lms/admin/departments",       label: "Departments",       icon: "sitemap" },
  { href: "/lms/admin/users",             label: "Users",             icon: "user-cog" },
  { href: "/lms/admin/learner-types",     label: "Learner Types",     icon: "tag" },
  { href: "/lms/admin/content",           label: "Content",           icon: "book" },
  { href: "/lms/admin/physical-training", label: "Training Sessions", icon: "calendar" },
  { href: "/lms/admin/learners",          label: "Learner Progress",  icon: "users" },
  { href: "/lms/admin/analytics",         label: "Analytics",         icon: "bar-chart" },
  { href: "/lms/admin/announcements",     label: "Announcements",     icon: "announcement" },
];

const LEARNER_NAV = [
  { href: "/lms/learn",          label: "My Learning", icon: "play-circle" },
  { href: "/lms/learn/progress", label: "My Progress", icon: "check-circle" },
  { href: "/lms/learn/schedule", label: "My Schedule", icon: "calendar" },
];

const TRAINER_NAV = [
  { href: "/lms/trainer",          label: "My Sessions", icon: "calendar" },
  { href: "/lms/trainer/messages", label: "Messages",    icon: "message-circle" },
];

// ── SVG Icon set ─────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    grid: (<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
    tag: (<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
    users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
    book: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>),
    link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>),
    calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
    "bar-chart": (<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>),
    announcement: (<><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>),
    "play-circle": (<><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>),
    "check-circle": (<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
    sun: (<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>),
    moon: (<><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>),
    "log-out": (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>),
    "arrow-left": (<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
    "user-cog": (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><circle cx="19" cy="11" r="2"/><path d="M19 9v.01M19 13v.01"/></>),
    "message-circle": (<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>),
    building: (<><rect x="2" y="3" width="20" height="18" rx="1"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/><rect x="5" y="12" width="2" height="2"/><rect x="11" y="12" width="2" height="2"/><rect x="17" y="12" width="2" height="2"/><rect x="5" y="16" width="2" height="2"/><rect x="17" y="16" width="2" height="2"/></>),
    sitemap: (<><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="2" y="17" width="6" height="4" rx="1"/><rect x="9" y="17" width="6" height="4" rx="1"/><rect x="16" y="17" width="6" height="4" rx="1"/><path d="M5 17v-3h14v3"/><line x1="12" y1="7" x2="12" y2="14"/></>),
    settings: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
    "chevron-down": (<><polyline points="6 9 12 15 18 9"/></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

export default function LMSLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  // Org switcher — only for admin/training roles
  const [companies,   setCompanies]   = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user?.role === "support") router.push("/lms/admin");
    if (!loading && user?.role === "trainer" && pathname === "/lms") router.push("/lms/trainer");
  }, [user, loading, router, pathname]);

  const isAdmin   = !loading && user && user.role === "admin";
  const isTrainer = !loading && user && user.role === "trainer";

  // Load companies for org switcher (admin/training only)
  useEffect(() => {
    if (!isAdmin) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lms_selectedOrg') || '' : '';
    setSelectedOrg(saved);
    apiFetch('/api/lms/admin/companies').then(r => r?.json()).then(d => {
      if (Array.isArray(d)) setCompanies(d);
    });
  }, [isAdmin]);

  const changeOrg = (id) => {
    setSelectedOrg(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_selectedOrg', id);
      window.dispatchEvent(new CustomEvent('lms-org-change', { detail: id }));
    }
  };

  if (loading || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-cortex-bg text-cortex-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );

  const nav = isAdmin ? ADMIN_NAV : isTrainer ? TRAINER_NAV : LEARNER_NAV;

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };
  const themeIcon  = theme === "dark" ? "moon" : theme === "light" ? "sun" : isDark ? "moon" : "sun";
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  const selectedOrgName = companies.find(c => String(c.id) === selectedOrg)?.company_name;

  return (
    <div className="flex h-screen bg-cortex-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-cortex-surface border-r border-cortex-border flex flex-col">

        {/* Logo + Org Switcher */}
        <div className="px-4 py-3 border-b border-cortex-border">
          {/* App identity */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cortex-accent flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="text-cortex-text font-semibold text-sm leading-tight">Cortex LMS</div>
              <div className="text-cortex-muted text-[10px] uppercase tracking-wider">{user.role}</div>
            </div>
          </div>

          {/* Org Switcher — admin/training only */}
          {isAdmin && (
            <div className="relative">
              <select
                value={selectedOrg}
                onChange={e => changeOrg(e.target.value)}
                className="w-full appearance-none bg-cortex-bg border border-cortex-border rounded-lg pl-3 pr-8 py-1.5 text-cortex-text text-xs focus:outline-none focus:border-cortex-accent cursor-pointer truncate"
              >
                <option value="">All Organisations</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-cortex-muted">
                <Icon name="chevron-down" size={12} />
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/lms/admin" &&
               item.href !== "/lms/learn" &&
               item.href !== "/lms/trainer" &&
               pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-cortex-accent text-white shadow-sm"
                    : "text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg"
                }`}>
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-cortex-border space-y-1">
          <button onClick={cycleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
            <Icon name={themeIcon} size={14} />
            <span>{themeLabel} mode</span>
          </button>
          <div className="px-3 py-1 text-[11px] text-cortex-muted truncate">{user.email}</div>
          <Link href="/lms/settings"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              pathname === '/lms/settings'
                ? 'text-cortex-accent bg-cortex-accent/10'
                : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg'
            }`}>
            <Icon name="settings" size={14} />
            Settings
          </Link>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-cortex-muted hover:text-cortex-danger hover:bg-cortex-danger/10 transition">
            <Icon name="log-out" size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-12 bg-cortex-surface border-b border-cortex-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-cortex-muted">
            {nav.find(n => pathname === n.href || (n.href !== '/lms/admin' && n.href !== '/lms/learn' && n.href !== '/lms/trainer' && pathname.startsWith(n.href)))?.label || 'LMS'}
            {isAdmin && selectedOrgName && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cortex-accent/15 text-cortex-accent font-medium">
                {selectedOrgName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(user.role === "learner" || user.role === "trainer") && <NotificationBell />}
            <div className="h-7 w-7 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-xs font-bold">
              {(user.display_name || user.email)[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-cortex-bg">{children}</main>
      </div>
      <AICompanion />
    </div>
  );
}
