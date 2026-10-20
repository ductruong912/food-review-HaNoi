'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Compass, MapPin, Bookmark, User, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import LoginModal from '@/components/LoginModal';
import { BrandLogo } from '@/components/Icons';
import ThemeToggle from '@/components/ThemeToggle';
import { buildFilterHref, parseRestaurantFilters } from '@/lib/filters';
import { rememberPostLoginDestination } from '@/lib/authIntent';

const navItems = [
  { href: '/', icon: Compass, label: 'Khám phá' },
  { href: '/map', icon: MapPin, label: 'Bản đồ' },
  { href: '/saved', icon: Bookmark, label: 'Đã lưu' },
  { href: '/profile', icon: User, label: 'Cá nhân' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, canContribute, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [currentSearch, setCurrentSearch] = useState('');
  const hideMobileNavigation = pathname === '/restaurant/new' || pathname.endsWith('/edit');

  useEffect(() => {
    const sync = () => setCurrentSearch(window.location.search);
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('restaurant-filters-updated', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('restaurant-filters-updated', sync);
    };
  }, [pathname]);

  const currentFilters = parseRestaurantFilters(new URLSearchParams(currentSearch));
  const fromSearch = pathname === '/search' || new URLSearchParams(currentSearch).get('from') === 'search';
  const navHref = (href: string) => {
    if (href === '/map') return buildFilterHref('/map', currentFilters, pathname === '/search' ? { from: 'search' } : undefined);
    if (href === '/' && pathname === '/map' && fromSearch) return buildFilterHref('/search', currentFilters);
    if (href === '/') return buildFilterHref('/', currentFilters);
    return href;
  };

  const handleAddClick = () => {
    if (!isAuthenticated) {
      rememberPostLoginDestination('/restaurant/new');
      setShowLogin(true);
    }
  };

  return (
    <>
      {/* Desktop Top Navbar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-[4.5rem] items-center justify-between px-6 lg:px-12 bg-background/90 backdrop-blur-lg border-b border-border shadow-sm">
        <Link href={navHref('/')} className="flex items-center gap-3 group">
          <BrandLogo size={18} />
          <span className="font-editorial font-semibold text-lg tracking-tight text-foreground group-hover:text-accent transition-colors">Food <span className="text-accent">Hà Nội</span></span>
        </Link>

        <nav className="flex items-center gap-1.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={navHref(href)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-accent font-bold'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="desktop-nav-indicator"
                    className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                  />
                )}
              </Link>
            );
          })}

          <div className="ml-1">
            <ThemeToggle />
          </div>

          {/* Add Button - Show on main pages for authenticated users */}
          {!loading && (!isAuthenticated || canContribute) && (pathname === '/' || pathname === '/profile' || pathname === '/map' || pathname === '/saved') && (
            isAuthenticated ? (
              <Link
                href="/restaurant/new"
                className="ml-2 flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-xl gradient-warm text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <Plus size={18} />
                Thêm quán
              </Link>
            ) : (
              <button
                onClick={handleAddClick}
                className="ml-2 flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-xl gradient-warm text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Plus size={18} />
                Thêm quán
              </button>
            )
          )}
        </nav>
      </header>

      {/* Mobile Bottom Navigation */}
      {!hideMobileNavigation && <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={navHref(href)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex min-h-12 min-w-[64px] flex-col items-center justify-center gap-0.5 px-2"
              >
                <div className="relative">
                  <Icon
                    size={22}
                    className={`transition-colors ${
                      isActive ? 'text-accent' : 'text-text-muted'
                    }`}
                  />
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-dot"
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"
                      transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                    />
                  )}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isActive ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>}

      {/* Floating Action Button (Mobile) - Show on main pages */}
      {!loading && (!isAuthenticated || canContribute) && (pathname === '/' || pathname === '/profile') && (
        isAuthenticated ? (
          <Link
            href="/restaurant/new"
            aria-label="Thêm quán"
            className="md:hidden fab gradient-warm text-white glow-accent"
          >
            <Plus size={24} />
          </Link>
        ) : (
          <button
            aria-label="Đăng nhập để thêm quán"
            onClick={handleAddClick}
            className="md:hidden fab gradient-warm text-white glow-accent"
          >
            <Plus size={24} />
          </button>
        )
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
