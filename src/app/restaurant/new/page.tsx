'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import LoginModal from '@/components/LoginModal';
import RestaurantForm from '@/components/RestaurantForm';
import Link from 'next/link';

export default function NewRestaurantPage() {
  const { user, canContribute, loading, refreshProfile, profileError } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  if (loading) return <p role="status" className="p-6 text-center">Đang kiểm tra tài khoản…</p>;
  if (!user || !canContribute) return <div className="mx-auto max-w-md p-6 space-y-4">
    <h1 className="font-editorial text-2xl">Cùng đóng góp quán ngon</h1>
    <p>{profileError || (user ? `Tài khoản ${user.email} đang có quyền xem. Nhắn chủ nhóm cấp quyền đóng góp, sau đó kiểm tra lại tại đây.` : 'Đăng nhập để thêm quán vào danh sách của nhóm.')}</p>
    <button onClick={() => user ? refreshProfile() : setShowLogin(true)} className="gradient-warm rounded-xl px-4 py-3">{user ? 'Kiểm tra lại quyền' : 'Đăng nhập'}</button>
    <Link href="/" className="block text-accent py-3">Về danh sách quán</Link>
    <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
  </div>;
  return <RestaurantForm key={user.id} user={user} />;
}
