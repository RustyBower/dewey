import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Camera,
  Search,
  Upload,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/scan', label: 'Scan', icon: Camera },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/import', label: 'Import', icon: Upload },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link
                to="/"
                className="text-lg font-semibold tracking-tight text-rose-600 dark:text-rose-400"
              >
                Dewey
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <User size={14} className="inline mr-1" />
                {user?.display_name || user?.username}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pb-3 pt-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-2 mt-2">
              <div className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
                <User size={14} className="inline mr-1" />
                {user?.display_name || user?.username}
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
