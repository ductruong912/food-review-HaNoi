'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, MapPin, User, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import LoginModal from '@/components/LoginModal';
import { BrandLogo } from '@/components/Icons';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { href: '/', icon: Home, label: 'Trang chủ' },
  { href: '/map', icon: MapPin, label: 'Bản đồ' },
  { href: '/profile', icon: User, label: 'Cá nhân' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const handleAddClick = () => {
    if (!isAuthenticated) {
      setShowLogin(true);
    }
  };

  return (
    <>
      {/* Desktop Top Navbar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-16 items-center justify-between px-6 lg:px-12 glass-card rounded-none border-x-0 border-t-0">
        <Link href="/" className="flex items-center gap-3 group">
          <BrandLogo size={18} />
          <span className="font-bold text-lg gradient-text group-hover:opacity-90 transition-opacity">Food Hà Nội</span>
        </Link>

        <nav className="flex items-center gap-1.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
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
          {(pathname === '/' || pathname === '/profile' || pathname === '/map') && (
            isAuthenticated ? (
              <Link
                href="/restaurant/new"
                className="ml-2 flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-warm text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <Plus size={18} />
                Thêm quán
              </Link>
            ) : (
              <button
                onClick={handleAddClick}
                className="ml-2 flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-warm text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Plus size={18} />
                Thêm quán
              </button>
            )
          )}
        </nav>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px]"
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
                  className={`text-[10px] font-semibold ${
                    isActive ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button (Mobile) - Show on main pages */}
      {(pathname === '/' || pathname === '/profile' || pathname === '/map') && (
        isAuthenticated ? (
          <Link
            href="/restaurant/new"
            className="md:hidden fab gradient-warm text-white glow-accent"
          >
            <Plus size={24} />
          </Link>
        ) : (
          <button
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
