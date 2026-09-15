'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LogOut,
  Store,
  User,
  Sparkles,
  ShieldCheck,
  UtensilsCrossed,
  Plus,
  KeyRound,
  Lock,
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
    unlockAdmin,
    lockAdmin,
    loading: authLoading,
  } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [myRestaurants, setMyRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      toast.error('Vui lòng nhập mã PIN');
      return;
    }
    if (unlockAdmin(pinInput)) {
      toast.success('Đã mở khóa quyền Quản trị viên (Master Admin)!');
      setPinInput('');
    } else {
      toast.error('Mã PIN không chính xác');
    }
  };

  useEffect(() => {
    if (!user && !isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchMyData() {
      let query = supabase.from('restaurants').select('*');
      if (user) {
        query = query.eq('created_by', user.id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      setMyRestaurants((data as Restaurant[]) || []);
      setLoading(false);
    }

    fetchMyData();
  }, [user, isAdmin]);

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
          <h2 className="text-lg font-bold text-white mb-1">
            Đăng nhập tài khoản
          </h2>
          <p className="text-xs text-text-secondary mb-5">
            Đăng nhập để đồng bộ quán ăn bạn đã review
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="w-full py-2.5 rounded-xl gradient-warm text-white font-semibold text-xs hover:opacity-90 transition-opacity glow-accent cursor-pointer"
          >
            Đăng nhập ngay
          </button>
        </motion.div>

        {/* Quick Admin PIN box for owner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 text-left border-border/80"
        >
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={16} className="text-gold" />
            <h3 className="text-sm font-bold text-white">
              Kích hoạt quyền Admin (Chủ app)
            </h3>
          </div>
          <p className="text-xs text-text-muted mb-3 leading-relaxed">
            Nhập mã PIN bí mật của bạn để mở quyền Sửa/Xóa mọi quán ăn ngay trên thiết bị này:
          </p>
          <form onSubmit={handleUnlockPin} className="flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Nhập mã PIN..."
              className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-accent text-bg-primary font-bold text-xs hover:bg-accent-hover transition-colors cursor-pointer shrink-0"
            >
              Mở khóa
            </button>
          </form>
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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5BAF8A] to-[#82B8D0] flex items-center justify-center text-xl font-bold text-white shrink-0">
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
            <h2 className="text-base font-bold text-white truncate">
              {profile?.display_name || user?.display_name || (isAdmin ? 'Chủ sở hữu (Admin)' : 'Người dùng')}
            </h2>
            <p className="text-xs text-text-muted truncate">{user?.email || 'Quản trị viên thiết bị'}</p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold border border-gold/30">
                  <ShieldCheck size={10} />
                  <span>Master Admin</span>
                </span>
              )}
              {user?.isGuest && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/25">
                  <Sparkles size={10} />
                  <span>Khách tạm</span>
                </span>
              )}
            </div>
          </div>

          {user && (
            <button
              onClick={signOut}
              className="p-2.5 rounded-xl bg-card border border-border hover:border-accent-red/50 text-text-muted hover:text-accent-red transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Admin Privilege Status & Lock/Unlock Card */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 border-border/80"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-gold/15 text-gold' : 'bg-secondary text-text-muted'}`}>
              <KeyRound size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">
                {isAdmin ? 'Quyền Admin đang KÍCH HOẠT' : 'Chưa kích hoạt quyền Admin'}
              </h3>
              <p className="text-[11px] text-text-muted">
                {isAdmin ? 'Bạn có quyền Sửa và Xóa mọi quán trên hệ thống' : 'Nhập mã PIN để có quyền Sửa/Xóa quán'}
              </p>
            </div>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                lockAdmin();
                toast.info('Đã khóa quyền Admin');
              }}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:border-accent-red/40 text-text-muted hover:text-accent-red text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Lock size={12} />
              <span>Khóa lại</span>
            </button>
          ) : (
            <form onSubmit={handleUnlockPin} className="flex items-center gap-1.5">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Mã PIN..."
                className="w-24 bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-accent text-bg-primary font-bold text-xs hover:bg-accent-hover transition-colors cursor-pointer"
              >
                Mở
              </button>
            </form>
          )}
        </div>
      </motion.div>

      {/* My Restaurants Section Header */}
      <div className="flex items-center justify-between pt-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {myRestaurants.map((r, i) => (
            <RestaurantCard key={r.id} restaurant={r} index={i} viewMode="compact" />
          ))}
        </div>
      )}
    </div>
  );
}
