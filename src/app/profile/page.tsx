'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LogOut,
  Store,
  User,
  ShieldCheck,
  UtensilsCrossed,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import RestaurantCard from '@/components/RestaurantCard';
import LoginModal from '@/components/LoginModal';
import { toast } from 'sonner';

export default function ProfilePage() {
  const {
    user,
    profile,
    signOut,
    isAuthenticated,
    isAdmin,
    canContribute,
    profileError,
    refreshProfile,
    loading: authLoading,
  } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [myRestaurants, setMyRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setMyRestaurants([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true); setFetchError(false);
    supabase.from('restaurants').select('*').eq('created_by', userId).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        setFetchError(!!error); setMyRestaurants(error ? [] : data || []); setLoading(false);
      }, () => { if (active) { setFetchError(true); setLoading(false); } });
    return () => { active = false; };
  }, [userId, attempt]);

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

  if (!isAuthenticated && !isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center text-text-muted">
            <User size={26} />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            Đăng nhập tài khoản
          </h2>
          <p className="text-xs text-text-secondary mb-5">
            Đăng nhập để đồng bộ quán ăn bạn đã review
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="w-full py-2.5 rounded-xl gradient-warm text-foreground font-semibold text-xs hover:opacity-90 transition-opacity glow-accent cursor-pointer"
          >
            Đăng nhập ngay
          </button>
        </motion.div>

        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-24">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5BAF8A] to-[#82B8D0] flex items-center justify-center text-xl font-bold text-foreground shrink-0">
            {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : profile?.avatar_url ? (
              <span className="text-xl font-bold">{profile.avatar_url}</span>
            ) : (
              (profile?.display_name || user?.email || (isAdmin ? 'Admin' : 'U'))[0].toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {profile?.display_name || user?.display_name || (isAdmin ? 'Chủ sở hữu (Admin)' : 'Người dùng')}
            </h2>
            <p className="text-xs text-text-muted truncate">{user?.email || 'Quản trị viên thiết bị'}</p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold/15 text-gold border border-gold/30">
                  <ShieldCheck size={10} />
                  <span>Quản trị viên</span>
                </span>
              )}

            </div>
          </div>

          {user && (
            <button
              onClick={() => void signOut().catch(() => toast.error('Chưa đăng xuất được, hãy thử lại.'))}
              className="p-2.5 rounded-xl bg-card border border-border hover:border-accent-red/50 text-text-muted hover:text-accent-red transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </motion.div>

      <div className="glass-card p-4 text-sm" role="status">
        {isAdmin ? 'Bạn là quản trị viên: có thể sửa và xóa mọi quán.' : canContribute
          ? 'Bạn có thể thêm quán và sửa/xóa những quán mình đã đăng.'
          : 'Tài khoản đang có quyền xem. Nhắn chủ nhóm cấp quyền để thêm quán nhé.'}
      </div>
      {profileError && <p role="alert" className="text-sm text-accent-red">{profileError}</p>}
      <button onClick={refreshProfile} className="rounded-xl border border-border px-4 py-3 text-sm">Kiểm tra lại quyền</button>

      {/* My Restaurants Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-accent" />
          <h3 className="text-base font-bold text-foreground">
            Quán đã thêm ({myRestaurants.length})
          </h3>
        </div>
        {canContribute && <Link
          href="/restaurant/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl gradient-warm text-foreground font-semibold text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>Thêm quán mới</span>
        </Link>}
      </div>

      {fetchError ? <div className="p-4 space-y-3"><p role="alert">Chưa tải được danh sách quán của bạn.</p><button onClick={() => setAttempt(n => n + 1)} className="rounded-xl border border-border p-3">Thử lại</button></div> : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      ) : myRestaurants.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border/60">
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-secondary flex items-center justify-center text-text-muted">
            <UtensilsCrossed size={22} className="text-accent" />
          </div>
          <p className="text-sm text-foreground font-medium mb-1">Bạn chưa thêm quán nào</p>
          <p className="text-xs text-text-muted mb-4">Lưu lại những quán ăn yêu thích để tiện tìm lại</p>
          {canContribute && <Link
            href="/restaurant/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-warm text-foreground font-semibold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Thêm quán đầu tiên</span>
          </Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {myRestaurants.map((r, i) => (
            <RestaurantCard key={r.id} restaurant={r} index={i} viewMode="compact" />
          ))}
        </div>
      )}
    </div>
  );
}
