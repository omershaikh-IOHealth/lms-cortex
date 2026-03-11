// frontend/app/lms/layout.js
"use client";
import { useEffect, useState, useMemo } from "react";
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

const Icon = ({ name, size = 16, className = "" }) => {
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
    "sidebar-toggle": (<><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></>),
    "chevron-right": (<><polyline points="9 18 15 12 9 6"/></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

export default function LMSLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const { setTheme, isDark } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [companies,   setCompanies]   = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('lms_sidebar_collapsed');
    if (saved !== null) setIsCollapsed(saved === 'true');
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('lms_sidebar_collapsed', String(newState));
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const isAdmin   = !loading && user && user.role === "admin";
  const isTrainer = !loading && user && user.role === "trainer";

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

  // Breadcrumbs logic
  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(p => p && p !== 'lms');
    return parts.map((p, i) => ({
      label: p.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      href: '/lms/' + parts.slice(0, i + 1).join('/')
    }));
  }, [pathname]);

  if (loading || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-cortex-bg text-cortex-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Initializing Workspace...</span>
        </div>
      </div>
    );

  const nav = isAdmin ? ADMIN_NAV : isTrainer ? TRAINER_NAV : LEARNER_NAV;

  // Admin sidebar is dark only in LIGHT mode. In dark mode, ALL sidebars stay light (white)
  // to create an inverse/contrast effect against the dark main content area.
  const isDarkSidebar = user.role === 'admin' && !isDark;

  const roleStyles = {
    admin: {
      accent: "#1e293b",
      accentRgb: "30 41 59",
      bg: isDark ? "bg-cortex-bg" : "bg-slate-50",
      navActive: isDarkSidebar ? "bg-white/10 text-white" : "bg-slate-900 text-white",
      navInactive: isDarkSidebar ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-700 hover:text-slate-900 hover:bg-blue-50",
    },
    trainer: {
      accent: "#2563eb",
      accentRgb: "37 99 235",
      bg: isDark ? "bg-cortex-bg" : "bg-[#f8fafc]",
      navActive: "bg-blue-600 text-white shadow-sm",
      navInactive: "text-slate-500 hover:text-blue-600 hover:bg-blue-50",
    },
    learner: {
      accent: "#3b82f6",
      accentRgb: "59 130 246",
      bg: isDark ? "bg-cortex-bg" : "bg-[#f1f5f9]",
      navActive: "bg-blue-500 text-white shadow-md",
      navInactive: "text-slate-500 hover:text-blue-500 hover:bg-blue-50",
    }
  };

  const style = roleStyles[user.role] || roleStyles.learner;
  // sidebar-light-theme class keeps sidebar white even in dark mode (CSS isolation)
  const sidebarCls = isDarkSidebar ? "bg-slate-900" : "sidebar-light-theme";

  return (
    <div className={`flex h-screen overflow-hidden ${style.bg}`} style={{ "--cortex-accent": style.accentRgb }}>
      {/* ── Sidebar ── */}
      <aside className={`relative h-screen transition-all duration-300 ease-in-out border-r border-cortex-border flex flex-col ${isCollapsed ? 'w-16' : 'w-64'} ${sidebarCls}`}>
        
        {/* Logo Section */}
        <div className={`px-4 py-6 flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-cortex-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-cortex-accent/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <div className={`font-bold text-lg leading-tight ${isDarkSidebar ? 'text-white' : 'text-cortex-text'}`}>Cortex</div>
              <div className={`text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 ${isDarkSidebar ? 'text-slate-400' : 'text-cortex-muted'}`}>{user.role}</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/lms/admin" && item.href !== "/lms/learn" && item.href !== "/lms/trainer" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  active ? style.navActive : style.navInactive
                }`}>
                <Icon name={item.icon} size={18} className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                {!isCollapsed && <span className="truncate animate-fade-in">{item.label}</span>}
                {isCollapsed && (
                  <div className={`absolute left-14 shadow-md px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 ${
                    isDark ? 'bg-white text-slate-900 border border-slate-200' : 'bg-slate-800 text-white border border-slate-700'
                  }`}>
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t ${isDarkSidebar ? 'border-white/10' : 'border-cortex-border'} space-y-1`}>
          <button onClick={toggleSidebar}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
              isDarkSidebar ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50'
            }`}>
            <Icon name="sidebar-toggle" size={16} className={isCollapsed ? 'rotate-180' : ''} />
            {!isCollapsed && <span className="animate-fade-in">Collapse Sidebar</span>}
          </button>

          <Link href="/lms/settings"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
              pathname === '/lms/settings'
                ? 'bg-cortex-accent text-white'
                : isDarkSidebar ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50'
            }`}>
            <Icon name="settings" size={16} />
            {!isCollapsed && <span className="animate-fade-in">Settings</span>}
          </Link>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition relative group ${
              isDarkSidebar ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50'
            }`}>
            <Icon name={isDark ? 'sun' : 'moon'} size={16} />
            {!isCollapsed && <span className="animate-fade-in">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
            {isCollapsed && (
              <div className={`absolute left-14 shadow-md px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 ${
                isDark ? 'bg-white text-slate-900 border border-slate-200' : 'bg-slate-800 text-white border border-slate-700'
              }`}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </div>
            )}
          </button>

          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 transition">
            <Icon name="log-out" size={16} />
            {!isCollapsed && <span className="animate-fade-in">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-cortex-border flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm">
              <Link href="/lms" className="text-cortex-muted hover:text-cortex-accent transition">LMS</Link>
              {breadcrumbs.map((bc, i) => (
                <div key={bc.href} className="flex items-center gap-2">
                  <Icon name="chevron-right" size={12} className="text-cortex-border" />
                  <Link href={bc.href} className={`transition ${i === breadcrumbs.length - 1 ? 'font-semibold text-cortex-text pointer-events-none' : 'text-cortex-muted hover:text-cortex-accent'}`}>
                    {bc.label}
                  </Link>
                </div>
              ))}
            </div>

            {/* Org Switcher (Admin only) */}
            {isAdmin && !isCollapsed && (
              <div className="ml-4 pl-4 border-l border-cortex-border animate-fade-in">
                <select
                  value={selectedOrg}
                  onChange={e => changeOrg(e.target.value)}
                  className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-cortex-accent/20 cursor-pointer"
                >
                  <option value="">All Organisations</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-5">
            {/* Dark / Light mode toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-cortex-muted hover:text-cortex-text hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
            >
              <Icon name={isDark ? 'sun' : 'moon'} size={16} />
            </button>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-cortex-text leading-tight">{user.display_name || user.email.split('@')[0]}</span>
              <span className="text-[10px] font-bold text-cortex-accent uppercase tracking-wider">{user.role}</span>
            </div>
            {(user.role === "learner" || user.role === "trainer") && <NotificationBell />}
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cortex-accent to-blue-600 p-[2px] shadow-lg shadow-cortex-accent/20">
              <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-sm font-bold text-cortex-accent">
                {(user.display_name || user.email)[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto relative scroll-smooth bg-transparent">
          <div className="max-w-[1400px] mx-auto p-8 animate-slide-up">
            {children}
          </div>
        </main>
      </div>
      <AICompanion />
    </div>
  );
}
