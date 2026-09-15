'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LogOut, Store, User, Sparkles, ShieldCheck, UtensilsCrossed, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import RestaurantCard from '@/components/RestaurantCard';
import LoginModal from '@/components/LoginModal';

export default function ProfilePage() {
  const { user, profile, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [myRestaurants, setMyRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchMyData() {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });

      setMyRestaurants((data as Restaurant[]) || []);
      setLoading(false);
    }

    fetchMyData();
  }, [user]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full skeleton" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 skeleton" />
              <div className="h-3 w-48 skeleton" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
            <User size={30} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Đăng nhập để xem profile
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Quản lý quán đã thêm
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="px-8 py-3 rounded-2xl gradient-warm text-white font-semibold hover:opacity-90 transition-opacity glow-accent"
          >
            Đăng nhập ngay
          </button>
          <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5BAF8A] to-[#82B8D0] flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : profile?.avatar_url ? (
              <span className="text-2xl font-bold">{profile.avatar_url}</span>
            ) : (
              (profile?.display_name || user?.email || 'U')[0].toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {profile?.display_name || user?.display_name || 'Người dùng'}
            </h2>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
            <div className="mt-1">
              {user?.isGuest ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/25">
                  <Sparkles size={10} />
                  <span>Khách tạm</span>
                </span>
              ) : profile?.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent border border-accent/25">
                  <ShieldCheck size={10} />
                  <span>Quản trị viên</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-text-secondary border border-border">
                  <User size={10} />
                  <span>Thành viên</span>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={signOut}
            className="p-2.5 rounded-xl bg-card border border-border hover:border-accent-red/50 text-text-muted hover:text-accent-red transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="mt-5 p-3 rounded-xl bg-secondary/50 text-center">
          <p className="text-2xl font-bold text-white">{myRestaurants.length}</p>
          <p className="text-[11px] text-text-muted font-medium flex items-center justify-center gap-1">
            <Store size={12} /> Quán đã thêm
          </p>
        </div>
      </motion.div>

      {/* My Restaurants */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-accent" />
          <h3 className="text-base font-bold text-white">
            Quán đã thêm ({myRestaurants.length})
          </h3>
        </div>
        <Link
          href="/restaurant/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl gradient-warm text-white font-semibold text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>Thêm quán mới</span>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      ) : myRestaurants.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/60">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary flex items-center justify-center text-text-muted">
            <UtensilsCrossed size={24} className="text-accent" />
          </div>
          <p className="text-sm text-white font-medium mb-1">Bạn chưa thêm quán nào</p>
          <p className="text-xs text-text-muted mb-4">Lưu lại những quán ăn yêu thích để tiện tìm lại</p>
          <Link
            href="/restaurant/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-warm text-white font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Thêm quán đầu tiên</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {myRestaurants.map((r, i) => (
            <RestaurantCard key={r.id} restaurant={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
